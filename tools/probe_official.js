// tools/probe_official.js
// 目的：实测各机构「通知公告」栏目的真实地址。
// 只认 HTTP 200 + 页面里出现「通知/公告/申报」等字样的，拒绝把首页当栏目。

const CAND = [
  ['国家自然科学基金委', [
    'https://www.nsfc.gov.cn/publish/portal0/tab442/',
    'https://www.nsfc.gov.cn/publish/portal0/tab434/',
    'https://www.nsfc.gov.cn/publish/portal0/tab440/',
    'https://www.nsfc.gov.cn/p86/index.html'
  ]],
  ['全国社科工作办', [
    'http://www.nopss.gov.cn/GB/219469/index.html',
    'http://www.nopss.gov.cn/'
  ]],
  ['教育部', [
    'http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/',
    'http://www.moe.gov.cn/srcsite/',
    'http://www.moe.gov.cn/jyb_xxgk/moe_1777/moe_1778/'
  ]],
  ['科技部', [
    'https://www.most.gov.cn/tztg/',
    'https://www.most.gov.cn/xxgk/xinxifenlei/fdzdgknr/qtwj/'
  ]],
  ['住建部', [
    'https://www.mohurd.gov.cn/gongkai/zhengce/zhengcefilelib/index.html',
    'https://www.mohurd.gov.cn/gongkai/fdzdgknr/tzgg/index.html',
    'https://www.mohurd.gov.cn/'
  ]],
  ['中国科协', [
    'https://www.cast.org.cn/col/col1186/index.html',
    'https://www.cast.org.cn/'
  ]],
  ['文旅部科技教育司', [
    'https://www.mct.gov.cn/whzx/bnsj/whkjs/',
    'https://www.mct.gov.cn/'
  ]],
  ['陕西省科技厅', [
    'https://kjt.shaanxi.gov.cn/kjdt/tzgg/',
    'https://kjt.shaanxi.gov.cn/'
  ]],
  ['陕西省教育厅', [
    'http://jyt.shaanxi.gov.cn/gk/fdnr/gsgggk/',
    'http://jyt.shaanxi.gov.cn/'
  ]],
  ['陕西省社科联', [
    'http://www.sxsskw.org.cn/sy2/tzgg2/',
    'http://www.sxsskw.org.cn/'
  ]],
  ['中国建筑学会', [
    'https://www.chinaasc.org.cn/news/tongzhigonggao/',
    'https://www.chinaasc.org.cn/'
  ]],
  ['中国城市规划学会', [
    'https://www.planning.org.cn/news/tzgg',
    'https://www.planning.org.cn/news/',
    'https://www.planning.cn/'
  ]],
  ['中国风景园林学会', [
    'https://www.chsla.org.cn/news/tzgg',
    'https://www.chsla.org.cn/'
  ]],
  ['中国环境科学学会', [
    'https://www.chinacses.org.cn/tzgg',
    'https://www.chinacses.org/'
  ]],
  ['中国城市科学研究会', [
    'http://www.chinasus.org/news/',
    'http://www.chinasus.org/'
  ]],
  ['中国土木工程学会', [
    'http://www.cces.net.cn/html/tzgg/',
    'http://www.cces.net.cn/'
  ]],
  ['教育部学位中心', [
    'https://www.cdgdc.edu.cn/',
    'https://www.cdgdc.edu.cn/xwyyjsjyxx/'
  ]]
]

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

async function probe (url) {
  const ctrl = new AbortController()
  const timer = setTimeout(function () { ctrl.abort() }, 15000)
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: ctrl.signal,
      headers: { 'User-Agent': UA, 'Accept-Language': 'zh-CN,zh;q=0.9' }
    })
    const body = await res.text()
    clearTimeout(timer)
    const mb = Buffer.byteLength(body, 'utf8') / 1024
    // 标题与关键词命中，判断是不是真的栏目页
    const titleM = body.match(/<title[^>]*>([\s\S]{0,120}?)<\/title>/i)
    const title = titleM ? titleM[1].replace(/\s+/g, ' ').trim() : ''
    const hitNotice = /通知|公告|公示|申报|征集|征稿|招标/.test(body) ? 'Y' : 'N'
    // 列表密度：页面里链接数，栏目页普遍 60+
    const links = (body.match(/<a\s/gi) || []).length
    return {
      ok: res.status === 200,
      status: res.status,
      finalUrl: res.url,
      title: title.slice(0, 46),
      hitNotice: hitNotice,
      links: links,
      kb: mb.toFixed(0)
    }
  } catch (e) {
    clearTimeout(timer)
    return { ok: false, status: 'ERR', err: (e && e.message ? e.message : 'fail').slice(0, 40) }
  }
}

;(async function () {
  for (let i = 0; i < CAND.length; i++) {
    const name = CAND[i][0]
    const urls = CAND[i][1]
    console.log('\n=== ' + name)
    for (let j = 0; j < urls.length; j++) {
      const r = await probe(urls[j])
      if (r.status === 'ERR') {
        console.log('  ✗ ' + urls[j] + '   ' + r.err)
      } else {
        const tag = r.ok ? (r.hitNotice === 'Y' && r.links > 40 ? '✓' : '?') : '✗'
        console.log('  ' + tag + ' ' + r.status + ' ' + String(r.links).padStart(4) + '链接 ' +
          r.title + '  <- ' + urls[j] + (r.finalUrl !== urls[j] ? ' => ' + r.finalUrl : ''))
      }
    }
  }
})()
