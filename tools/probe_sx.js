// tools/probe_sx.js
// 目的：陕西省内除科技厅/教育厅/社科联之外，还有哪些厅局的「通知公告」栏目真能抓。
// 做法同 probe_provinces.js：开首页 → 从导航抽通知公告类链接 → 验证栏目页。
// 结果写 tools/_probe_sx.txt，只认实测，不猜路径。

const fs = require('fs')
const HOME = [
  ['陕西省人社厅', 'http://rst.shaanxi.gov.cn/'],
  ['陕西省住建厅', 'http://js.shaanxi.gov.cn/'],
  ['陕西省生态环境厅', 'http://sthjt.shaanxi.gov.cn/'],
  ['陕西省文旅厅', 'http://whhlyt.shaanxi.gov.cn/'],
  ['陕西省发改委', 'http://sndrc.shaanxi.gov.cn/'],
  ['陕西省科协', 'http://www.sxkx.org.cn/'],
  ['陕西省教科院', 'http://www.sxjky.com/'],
  ['西安市住建局', 'http://zjj.xa.gov.cn/'],
  ['西安市自规局', 'http://ghzyj.xa.gov.cn/'],
  ['陕西省知识产权局', 'http://snipa.shaanxi.gov.cn/']
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'
const lines = []
function log (s) { lines.push(s); console.log(s) }

function fetchIt (url, timeout) {
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, timeout)
  return fetch(url, {
    redirect: 'follow',
    signal: ctrl.signal,
    headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
  }).then(function (res) {
    return res.text().then(function (body) {
      clearTimeout(timer)
      return { status: res.status, url: res.url, body: body }
    })
  }).catch(function (e) {
    clearTimeout(timer)
    return { status: 0, err: (e && e.message ? e.message : 'fail').slice(0, 50) }
  })
}

function findSectionLinks (homeUrl, html) {
  const out = []
  const seen = {}
  const re = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,60}?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, '')
    if (!text || text.length > 12) continue
    if (!/通知公告|通知|公告公示|公示公告|公示|政务公开|政策文件/.test(text)) continue
    let abs = href
    if (href.indexOf('//') === 0) abs = 'http:' + href
    else if (!/^https?:/i.test(href)) {
      try { abs = new URL(href, homeUrl).href } catch (e) { continue }
    }
    if (seen[abs]) continue
    seen[abs] = 1
    out.push({ text: text, url: abs })
  }
  out.sort(function (a, b) {
    const sa = (/tzgg|tzwj|通知公告/.test(a.url + a.text) ? 0 : 1)
    const sb = (/tzgg|tzwj|通知公告/.test(b.url + b.text) ? 0 : 1)
    return sa - sb
  })
  return out.slice(0, 3)
}

async function probeSection (url) {
  const r = await fetchIt(url, 15000)
  if (r.status === 0) return { ok: false, why: r.err }
  if (r.status !== 200) return { ok: false, why: 'HTTP ' + r.status }
  const body = r.body || ''
  const titleM = body.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)
  const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim().slice(0, 40) : ''
  const hit = /通知|公告|公示|申报|征集/.test(body) ? 'Y' : 'N'
  const links = (body.match(/<a\s/gi) || []).length
  return { ok: hit === 'Y' && links > 40, why: 'links=' + links + ' hit=' + hit, title: title, url: r.url }
}

;(async function () {
  for (let i = 0; i < HOME.length; i++) {
    const name = HOME[i][0]
    const home = HOME[i][1]
    log('\n=== ' + name + '  ' + home)
    const h = await fetchIt(home, 15000)
    if (h.status !== 200) {
      log('  ✗ 首页打不开 ' + (h.status === 0 ? h.err : 'HTTP ' + h.status))
      continue
    }
    const secs = findSectionLinks(h.url || home, h.body || '')
    if (secs.length === 0) {
      log('  ? 首页开了，但导航里没有通知公告类链接（可能 JS 渲染）')
      continue
    }
    for (let j = 0; j < secs.length; j++) {
      const s = await probeSection(secs[j].url)
      if (s.ok) log('  ✓ ' + s.title + '  <- ' + s.url)
      else log('  ✗ [' + s.why + '] ' + secs[j].text + '  ' + secs[j].url)
    }
  }
  fs.writeFileSync(__dirname + '/_probe_sx.txt', lines.join('\n'))
})()
