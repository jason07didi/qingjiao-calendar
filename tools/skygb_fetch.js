/**
 * 国家社科基金项目信息平台（人民网新版）数据采集
 *
 * 站点：https://skygb.people.com.cn  （旧址 fz.people.com.cn/skygb/sk 已 403）
 * 接口：POST /api/login  → token；GET /api/searchGb → 立项数据
 * 鉴权：Authorization: Bearer <token>，密码用 RSA(PKCS1 v1.5) 加密后提交
 *
 * 用法：
 *   node tools/skygb_fetch.js probe                       # 只验证接口连通（不登录）
 *   node tools/skygb_fetch.js login --u=邮箱 --p=密码      # 登录并把 token 存到 data/_raw/token.txt
 *   node tools/skygb_fetch.js pull --year=2025 --limit=100 # 拉某年数据（分页）
 *   node tools/skygb_fetch.js pull --all --limit=100       # 拉全部年份
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const BASE = 'https://skygb.people.com.cn';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
const RAW = path.join(process.cwd(), 'data', '_raw');
const TOKEN_FILE = path.join(RAW, 'token.txt');
const OUT_DIR = path.join(RAW, 'skygb');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const arg = (k, d) => {
  const hit = process.argv.find((s) => s.startsWith(`--${k}=`));
  return hit ? hit.split('=').slice(1).join('=') : d;
};
const flag = (k) => process.argv.includes(`--${k}`);

function readToken() {
  if (fs.existsSync(TOKEN_FILE)) return fs.readFileSync(TOKEN_FILE, 'utf8').trim();
  return '';
}

async function api(pathname, { method = 'GET', body, token } = {}) {
  const headers = { 'User-Agent': UA, Accept: 'application/json', Referer: BASE + '/' };
  if (body) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = 'Bearer ' + token;
  const res = await fetch(BASE + pathname, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch {}
  return { status: res.status, json, txt };
}

async function login(username, password) {
  const pk = await api('/api/rsaPublicKey');
  const pub = pk.json?.data;
  if (!pub) { console.log('取公钥失败', pk.status, pk.txt.slice(0, 200)); return ''; }
  const enc = crypto.publicEncrypt({ key: pub, padding: crypto.constants.RSA_PKCS1_PADDING }, Buffer.from(password, 'utf8')).toString('base64');
  const r = await api('/api/login', { method: 'POST', body: { username, password: enc } });
  if (r.json?.code === 0 && r.json?.data?.token) {
    fs.mkdirSync(RAW, { recursive: true });
    fs.writeFileSync(TOKEN_FILE, r.json.data.token, 'utf8');
    console.log('登录成功，token 已存', TOKEN_FILE);
    return r.json.data.token;
  }
  console.log('登录失败:', r.status, r.json?.message || r.txt.slice(0, 200));
  return '';
}

async function pull({ year, limit = 100 }) {
  const token = readToken();
  if (!token) { console.log('没有 token，先执行 login'); return; }
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = [];
  let page = 1, total = null;
  while (true) {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (year) qs.set('lxtime', String(year));
    const r = await api('/api/searchGb?' + qs.toString(), { token });
    if (r.status === 401) { console.log('token 失效（401），需要重新登录'); break; }
    if (r.json?.code !== 0) { console.log('接口返回异常:', r.status, r.txt.slice(0, 300)); break; }
    if (total === null) { total = r.json.total || 0; console.log(`共 ${total} 条`); }
    const list = r.json.data || [];
    if (!list.length) break;
    rows.push(...list);
    process.stdout.write(`\r  已取 ${rows.length}/${total}`);
    if (rows.length >= total) break;
    page++;
    await sleep(600); // 温和限速
    if (page > 5000) break;
  }
  console.log('');
  const name = year ? `nssf_${year}.json` : 'nssf_all.json';
  fs.writeFileSync(path.join(OUT_DIR, name), JSON.stringify(rows, null, 0), 'utf8');
  console.log(`写出 ${rows.length} 条 → ${path.join(OUT_DIR, name)}`);
}

(async () => {
  const cmd = process.argv[2];
  if (cmd === 'probe') {
    console.log('searchGb（无 token）:', (await api('/api/searchGb?page=1&limit=1')).status, '（401=需登录）');
    console.log('rsaPublicKey:', (await api('/api/rsaPublicKey')).status);
  } else if (cmd === 'login') {
    const u = arg('u'), p = arg('p');
    if (!u || !p) { console.log('用法: login --u=邮箱 --p=密码'); return; }
    await login(u, p);
  } else if (cmd === 'pull') {
    if (flag('all')) await pull({ year: null, limit: Number(arg('limit', 100)) });
    else {
      const y = Number(arg('year'));
      if (!y) { console.log('用法: pull --year=2025 或 pull --all'); return; }
      await pull({ year: y, limit: Number(arg('limit', 100)) });
    }
  } else {
    console.log('用法: node tools/skygb_fetch.js probe|login|pull');
  }
})();
