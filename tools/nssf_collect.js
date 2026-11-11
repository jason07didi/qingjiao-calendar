/**
 * 国社科（全国哲学社会科学工作办公室）立项名单采集 — 阶段1：发现 + 下载
 *
 * 用法：
 *   node tools/nssf_collect.js discover          # 枚举历年名单公告，写 data/_raw/nssf_announcements.json
 *   node tools/nssf_collect.js download          # 下载所有 PDF 到 data/_raw/pdf/
 *   node tools/nssf_collect.js download --year=2025
 *
 * 站点：www.nopss.gov.cn，立项名单以 PDF 附件发布。
 * 栏目：通知公告 > 年度项目 /GB/219469/431027/ （含重点项目、一般项目、青年项目、西部项目分册）
 */
const fs = require('fs');
const path = require('path');

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const BASE = 'http://www.nopss.gov.cn';
const LIST = `${BASE}/GB/219469/431027/`; // 年度项目栏目
const RAW = path.join(process.cwd(), 'data', '_raw');
const PDFDIR = path.join(RAW, 'pdf');
const ANN_FILE = path.join(RAW, 'nssf_announcements.json');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getHtml(url, ref) {
  const headers = { 'User-Agent': UA, 'Accept': 'text/html,*/*', 'Accept-Language': 'zh-CN,zh;q=0.9' };
  if (ref) headers.Referer = ref;
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(url, { headers, signal: ctl.signal, redirect: 'follow' });
    const buf = Buffer.from(await res.arrayBuffer());
    let html = buf.toString('utf8');
    if (/charset=["']?gb/i.test(html.slice(0, 3000))) {
      try { html = new TextDecoder('gbk').decode(buf); } catch {}
    }
    return { ok: res.status === 200, status: res.status, html, bytes: buf.length, url: res.url };
  } finally {
    clearTimeout(timer);
  }
}

/** 抓栏目所有分页，返回 {url,title,date} */
async function listPages(maxPages = 40) {
  const all = [];
  const seen = new Set();
  for (let p = 1; p <= maxPages; p++) {
    const url = p === 1 ? `${LIST}index.html` : `${LIST}index${p}.html`;
    let r;
    try { r = await getHtml(url, LIST); } catch (e) { console.log(`  分页${p} 失败 ${e.message}`); break; }
    if (!r.ok) { console.log(`  分页${p} HTTP ${r.status}，停止`); break; }

    const items = [...r.html.matchAll(/<a[^>]+href=["'](\/n1\/\d{4}\/[^"']+)["'][^>]*>([\s\S]{0,100}?)<\/a>/gi)]
      .map((m) => ({ url: BASE + m[1], title: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim() }))
      .filter((o) => o.title.length > 4);

    let added = 0;
    for (const o of items) {
      if (seen.has(o.url)) continue;
      seen.add(o.url);
      all.push(o);
      added++;
    }
    if (added === 0) { console.log(`  分页${p} 无新条目，停止`); break; }
    const years = items.map((o) => (o.url.match(/\/n1\/(\d{4})\//) || [])[1]).filter(Boolean).map(Number);
    const minYear = years.length ? Math.min(...years) : 9999;
    console.log(`  分页${p}: +${added} 条（最早 ${minYear}）`);
    if (minYear <= 1999) break;
    await sleep(300);
  }
  return all;
}

/** 判断是否为「年度项目立项名单」公告 */
function isAnnualList(title) {
  if (/结项|鉴定专家|申报公告|招标|选题|中期|检查|撤项|终止/.test(title)) return false;
  return /立项(结果|名单)|立项结果公布|立项名单公布/.test(title);
}

async function discover() {
  fs.mkdirSync(RAW, { recursive: true });
  console.log('枚举栏目分页…');
  const items = await listPages();
  console.log(`栏目共 ${items.length} 条`);

  fs.writeFileSync(path.join(RAW, 'nssf_items.json'), JSON.stringify(items, null, 2), 'utf8');
  const maybe = items.filter((o) => /立项/.test(o.title));
  console.log(`含「立项」字样的标题 ${maybe.length} 条：`);
  maybe.slice(0, 30).forEach((o) => console.log(`  · ${o.title}  [${(o.url.match(/\/n1\/(\d{4})\/(\d{2})(\d{2})\//) || []).slice(1).join('-')}]`));

  const hits = items.filter((o) => isAnnualList(o.title));
  console.log(`\n命中「立项名单」公告 ${hits.length} 条：`);
  hits.forEach((o) => console.log(`  ${o.url} | ${o.title}`));

  // 逐条抓附件
  const out = [];
  for (const o of hits) {
    const year = Number((o.url.match(/\/n1\/(\d{4})\//) || [])[1]);
    let r;
    try { r = await getHtml(o.url, LIST); } catch (e) { console.log(`  ! ${o.title} 失败 ${e.message}`); continue; }
    const pdfs = [...r.html.matchAll(/href=["']([^"']+\.pdf)["'][^>]*>([\s\S]{0,80}?)<\/a>/gi)]
      .map((m) => ({
        url: m[1].startsWith('http') ? m[1] : BASE + m[1],
        name: m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, '').trim(),
      }));
    if (!pdfs.length) { console.log(`  ? ${year} ${o.title} 无 PDF 附件`); }
    else console.log(`  ✓ ${year} ${o.title} → ${pdfs.length} 个附件`);
    out.push({ year, title: o.title, url: o.url, pdfs });
    await sleep(400);
  }
  fs.writeFileSync(ANN_FILE, JSON.stringify(out, null, 2), 'utf8');
  console.log(`\n已写 ${ANN_FILE}`);
}

async function download(onlyYear) {
  const anns = JSON.parse(fs.readFileSync(ANN_FILE, 'utf8'));
  fs.mkdirSync(PDFDIR, { recursive: true });
  let n = 0, fail = 0;
  for (const a of anns) {
    if (onlyYear && a.year !== onlyYear) continue;
    for (const p of a.pdfs) {
      const safe = p.name.replace(/[\\/:*?"<>|]/g, '_').slice(0, 80) || 'list';
      const file = path.join(PDFDIR, `${a.year}_${safe}.pdf`);
      if (fs.existsSync(file) && fs.statSync(file).size > 10000) { console.log(`  跳过 ${path.basename(file)}`); continue; }
      try {
        const ctl = new AbortController();
        const timer = setTimeout(() => ctl.abort(), 60000);
        const res = await fetch(p.url, { headers: { 'User-Agent': UA, Referer: a.url }, signal: ctl.signal });
        const buf = Buffer.from(await res.arrayBuffer());
        clearTimeout(timer);
        if (buf.slice(0, 4).toString() !== '%PDF') { console.log(`  ! 非PDF ${p.url} ${res.status}`); fail++; continue; }
        fs.writeFileSync(file, buf);
        console.log(`  ✓ ${path.basename(file)} ${(buf.length / 1024).toFixed(0)}KB`);
        n++;
      } catch (e) { console.log(`  ! ${p.url} ${e.message}`); fail++; }
      await sleep(400);
    }
  }
  console.log(`\n下载完成 ${n} 个，失败 ${fail} 个 → ${PDFDIR}`);
}

const cmd = process.argv[2];
const yearArg = (process.argv.find((s) => s.startsWith('--year=')) || '').split('=')[1];
(async () => {
  if (cmd === 'discover') await discover();
  else if (cmd === 'download') await download(yearArg ? Number(yearArg) : null);
  else console.log('用法: node tools/nssf_collect.js discover|download [--year=2025]');
})();
