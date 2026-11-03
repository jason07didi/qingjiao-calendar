// tools/probe_official2.js — 第二轮：补齐第一轮没找到的栏目页
const fs = require('fs')
const path = require('path')

const CAND = [
  ['国家自然科学基金委', [
    'https://www.nsfc.gov.cn/',
    'https://www.nsfc.gov.cn/publish/portal0/tab442/info1.htm',
    'http://www.nsfc.gov.cn/publish/portal0/tab442/'
  ]],
  ['住建部', [
    'https://www.mohurd.gov.cn/gongkai/zhengce/index.html',
    'https://www.mohurd.gov.cn/xinwen/gzdt/index.html',
    'https://www.mohurd.gov.cn/gongkai/fdzdgknr/index.html',
    'https://www.mohurd.gov.cn/gongkai/zc/wjk/index.html'
  ]],
  ['中国科协', [
    'https://www.cast.org.cn/xw/tzgg/index.html',
    'https://www.cast.org.cn/col/col1189/index.html',
    'https://www.cast.org.cn/xw/index.html'
  ]],
  ['中国风景园林学会', [
    'https://www.chsla.org.cn/notice',
    'https://www.chsla.org.cn/news',
    'https://www.chsla.org.cn/col/col1001/index.html',
    'https://www.chsla.org.cn/index.html'
  ]],
  ['中国城市科学研究会', [
    'https://www.chinasus.org/chinasus/c/2020-01-01/1.shtml',
    'https://www.chinasus.org/index.html',
    'https://www.chinasus.org/tzgg/'
  ]],
  ['教育部社科司', [
    'http://www.moe.gov.cn/srcsite/A13/',
    'http://www.moe.gov.cn/srcsite/A08/',
    'http://www.moe.gov.cn/srcsite/A16/'
  ]],
  ['共青团中央', [
    'http://www.gqt.org.cn/tzgg/',
    'http://www.gqt.org.cn/'
  ]],
  ['陕西省科学技术协会', [
    'https://www.sxstcc.com/',
    'http://www.sxkx.org.cn/',
    'https://www.sxskx.org.cn/'
  ]],
  ['陕西省生态环境厅', [
    'https://sthjt.shaanxi.gov.cn/',
    'https://sthjt.shaanxi.gov.cn/zwgk/tzgg/'
  ]],
  ['陕西省人社厅', [
    'https://rst.shaanxi.gov.cn/',
    'https://rst.shaanxi.gov.cn/zfxxgk/tzgg/'
  ]],
  ['陕西省住建厅', [
    'https://js.shaanxi.gov.cn/',
    'https://js.shaanxi.gov.cn/zfxxgk/tzgg/'
  ]],
  ['陕西省自然资源厅', [
    'https://zrzyt.shaanxi.gov.cn/',
    'https://zrzyt.shaanxi.gov.cn/zwgk/tzgg/'
  ]]
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const out = []

async function probe (url) {
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, 15000)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    })
    const buf = Buffer.from(await res.arrayBuffer())
    clearTimeout(timer)
    // 手工按 meta charset 解码，避免 GBK 站乱码
    let body = buf.toString('utf8')
    const cs = (body.match(/charset\s*=\s*["']?([\w-]+)/i) || [])[1] || ''
    if (/gb|gbk|gb2312/i.test(cs)) {
      try { body = new TextDecoder('gbk').decode(buf) } catch (e) {}
    }
    const titleM = body.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)
    const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : ''
    const links = (body.match(/<a\s/gi) || []).length
    const hit = /通知|公告|公示|申报|征集|征稿/.test(body) ? 'Y' : 'N'
    return {
      status: res.status, finalUrl: res.url, title: title.slice(0, 40), links, hit,
      kb: (buf.length / 1024).toFixed(0)
    }
  } catch (e) {
    clearTimeout(timer)
    return { status: 'ERR', err: (e && e.message ? e.message : 'fail').slice(0, 40) }
  }
}

;(async function () {
  for (const [name, urls] of CAND) {
    out.push('\n=== ' + name)
    for (const u of urls) {
      const r = await probe(u)
      if (r.status === 'ERR') {
        out.push('  x ' + u + '   ' + r.err)
      } else {
        const ok = r.status === 200 && r.hit === 'Y' && r.links > 30
        out.push('  ' + (ok ? 'OK' : '? ') + ' ' + r.status + ' ' + String(r.links).padStart(4) +
          'L ' + r.kb + 'KB ' + r.title + '  <- ' + u + (r.finalUrl !== u ? ' => ' + r.finalUrl : ''))
      }
    }
  }
  fs.writeFileSync(path.join(__dirname, 'probe_out2.txt'), out.join('\n'), 'utf8')
  console.log(out.join('\n'))
})()
