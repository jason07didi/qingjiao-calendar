// tools/probe_official4.js — 设计学口径的三个机构
const fs = require('fs')
const path = require('path')
const CAND = [
  ['中国建筑装饰协会', ['http://www.cbda.cn/', 'https://www.cbda.cn/']],
  ['光华设计基金会', ['http://www.ddfd.org.cn/', 'http://www.ddfchina.org/', 'https://www.ddfd.org.cn/']],
  ['装饰杂志', ['http://www.izhsh.com.cn/', 'https://www.izhsh.com.cn/']],
  ['中国美术家协会', ['https://www.caanet.org.cn/', 'http://www.caanet.org.cn/']]
]
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const out = []

async function probe (url) {
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, 15000)
  try {
    const res = await fetch(url, { redirect: 'follow', signal: ctrl.signal, headers: { 'User-Agent': UA } })
    const buf = Buffer.from(await res.arrayBuffer())
    clearTimeout(timer)
    let body = buf.toString('utf8')
    const cs = (body.match(/charset\s*=\s*["']?([\w-]+)/i) || [])[1] || ''
    if (/gb|gbk|gb2312/i.test(cs)) { try { body = new TextDecoder('gbk').decode(buf) } catch (e) {} }
    const m = body.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)
    return { status: res.status, title: m ? m[1].replace(/\s+/g, ' ').trim().slice(0, 40) : '', links: (body.match(/<a\s/gi) || []).length }
  } catch (e) {
    clearTimeout(timer)
    return { status: 'ERR', err: (e && e.message || 'fail').slice(0, 40) }
  }
}

;(async function () {
  for (const [name, urls] of CAND) {
    out.push('\n=== ' + name)
    for (const u of urls) {
      const r = await probe(u)
      out.push(r.status === 'ERR'
        ? '  x ' + u + '  ' + r.err
        : '  ' + (r.status === 200 ? 'OK' : '? ') + ' ' + r.status + ' ' + String(r.links).padStart(4) + 'L ' + r.title + '  <- ' + u)
    }
  }
  fs.writeFileSync(path.join(__dirname, 'probe_out4.txt'), out.join('\n'), 'utf8')
})()
