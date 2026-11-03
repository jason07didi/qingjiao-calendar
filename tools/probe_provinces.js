// tools/probe_provinces.js
// 目的：把「关注地区」里还没覆盖的省级科技厅挨个实测一遍：
//   1) 打开厅首页，从导航里抽出「通知公告」类栏目的真实地址
//   2) 逐个验证该栏目页（HTTP 200 + 出现通知/公告/申报字样 + 链接密度够）
// 结论写到 tools/_probe_prov.txt，供 sources.seed.json 与 PROVINCES 选用。
// 只用实测结果，不猜、不编。

const fs = require('fs')
const HOME = [
  ['北京市科委', 'https://kw.beijing.gov.cn/'],
  ['天津市科技局', 'https://kxj.tj.gov.cn/'],
  ['上海市科委', 'https://stcsm.sh.gov.cn/'],
  ['重庆市科技局', 'https://kjt.cq.gov.cn/'],
  ['广东省科技厅', 'https://gdstc.gd.gov.cn/'],
  ['浙江省科技厅', 'https://kjt.zj.gov.cn/'],
  ['江西省科技厅', 'https://kjt.jiangxi.gov.cn/'],
  ['山西省科技厅', 'https://kjt.shanxi.gov.cn/'],
  ['内蒙古科技厅', 'https://kjt.nmg.gov.cn/'],
  ['广西科技厅', 'https://kjt.gxzf.gov.cn/'],
  ['海南省科技厅', 'https://kjt.hainan.gov.cn/'],
  ['吉林省科技厅', 'https://kjt.jl.gov.cn/'],
  ['黑龙江省科技厅', 'https://kjt.hlj.gov.cn/'],
  ['甘肃省科技厅', 'https://kjt.gansu.gov.cn/'],
  ['青海省科技厅', 'https://kjt.qinghai.gov.cn/'],
  ['宁夏科技厅', 'https://kjt.nx.gov.cn/'],
  ['新疆科技厅', 'https://kjt.xinjiang.gov.cn/'],
  ['西藏科技厅', 'http://sti.xizang.gov.cn/']
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

// 从首页 HTML 里抽「通知公告」类栏目链接
function findSectionLinks (homeUrl, html) {
  const out = []
  const seen = {}
  const re = /<a[^>]+href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]{0,60}?)<\/a>/gi
  let m
  while ((m = re.exec(html))) {
    const href = m[1]
    const text = m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, '')
    if (!text || text.length > 12) continue
    if (!/通知公告|通知|公告公示|公示公告|科技通知|政务公开/.test(text)) continue
    let abs = href
    if (href.indexOf('//') === 0) abs = 'http:' + href
    else if (/^https?:/i.test(href) === false) {
      try { abs = new URL(href, homeUrl).href } catch (e) { continue }
    }
    if (seen[abs]) continue
    seen[abs] = 1
    out.push({ text: text, url: abs })
  }
  // 优先含 tzgg/tzwj/通知 的
  out.sort(function (a, b) {
    const sa = (/tzgg|tzwj|通知/.test(a.url + a.text) ? 0 : 1) + (a.text.indexOf('通知公告') > -1 ? 0 : 2)
    const sb = (/tzgg|tzwj|通知/.test(b.url + b.text) ? 0 : 1) + (b.text.indexOf('通知公告') > -1 ? 0 : 2)
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
  const hit = /通知|公告|公示|申报|征集|征集/.test(body) ? 'Y' : 'N'
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
      log('  ? 首页能打开，但没从导航里抽出通知公告栏目（可能 JS 渲染）')
      continue
    }
    for (let j = 0; j < secs.length; j++) {
      const s = await probeSection(secs[j].url)
      if (s.ok) {
        log('  ✓ ' + s.title + '  <- ' + s.url)
      } else {
        log('  ✗ [' + s.why + '] ' + secs[j].text + '  ' + secs[j].url)
      }
    }
  }
  fs.writeFileSync(__dirname + '/_probe_prov.txt', lines.join('\n'))
})()
