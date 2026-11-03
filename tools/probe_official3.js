// tools/probe_official3.js — 第三轮：验证推断出的栏目页 + 期刊官网
const fs = require('fs')
const path = require('path')

const CAND = [
  ['生态环境部', [
    'https://www.mee.gov.cn/xxgk2018/xxgk/xxgk06/',
    'https://www.mee.gov.cn/xxgk2018/xxgk/',
    'https://www.mee.gov.cn/'
  ]],
  ['陕西省生态环境厅', [
    'https://sthjt.shaanxi.gov.cn/xxgk/fdnr/zcwj/',
    'https://sthjt.shaanxi.gov.cn/xxgk/fdnr/',
    'https://sthjt.shaanxi.gov.cn/'
  ]],
  ['共青团陕西省委', [
    'https://www.sxgqt.org.cn/',
    'https://www.sxgqt.org.cn/home/news/list.html'
  ]],
  ['陕西省人社厅', [
    'https://rst.shaanxi.gov.cn/zfxxgk/fdzdgknr/tzgg/',
    'https://rst.shaanxi.gov.cn/'
  ]],
  ['陕西省住建厅', [
    'https://js.shaanxi.gov.cn/zfxxgk/fdzdgknr/tzgg/',
    'https://js.shaanxi.gov.cn/'
  ]],
  ['陕西省自然资源厅', [
    'https://zrzyt.shaanxi.gov.cn/zwgk/tzgg/',
    'https://zrzyt.shaanxi.gov.cn/'
  ]],
  ['中国园林', [
    'http://www.jchla.com/',
    'https://www.jchla.com/'
  ]],
  ['国际城市规划', [
    'https://www.upiizheng.com/',
    'http://www.upiizheng.com/'
  ]],
  ['景观设计学LAF', [
    'https://www.lafrontiers.com/',
    'http://www.lafrontiers.com/'
  ]],
  ['城市规划学刊', [
    'https://www.planning.org.cn/',
    'https://caup.tongji.edu.cn/'
  ]],
  ['中国环境科学学会', [
    'https://www.chinacses.org/',
    'https://www.chinacses.org/cn/index.html'
  ]],
  ['中国气象学会', [
    'http://www.cms1924.org/',
    'https://www.cms1924.org/'
  ]],
  ['中国地理学会', [
    'http://www.gsc.org.cn/',
    'https://www.gsc.org.cn/'
  ]],
  ['中国生态学学会', [
    'http://www.esc.org.cn/',
    'https://www.esc.org.cn/'
  ]],
  ['中国风景园林学会', [
    'https://www.chsla.org.cn/',
    'https://www.chsla.org.cn/index'
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
  fs.writeFileSync(path.join(__dirname, 'probe_out3.txt'), out.join('\n'), 'utf8')
})()
