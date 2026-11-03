// 列表页通用解析器：从 HTML 里抽「标题 + 链接 + 发布日期」。
// 抽成独立模块，供 云函数 spider/index.js 与 本机 tools/local_spider.js 共用同一份逻辑。
//
// ⚠️ 日期铁律：列表页上那个日期是「通知发布日期」，不是「申报截止日」。
//    因此 deadline 一律留空，只把发布日写进 deadlineText 作为线索，
//    真正的截止日必须来自详情页原文或人工核实后才可写入。
//
// 两道降噪（2026-11-03 实跑后补）：
//  1) 必须能定位到发布日期（正文附近 or 从 URL 的 t20261029_ 模式里取），
//     —— 导航入口/栏目页没有日期，靠这条挡掉；
//  2) 发布日期必须在最近 RECENT_DAYS 天内（取不到日则要求年份 >= 今年），
//     —— 政府站栏目页常年挂着 2023/2024 的旧文，靠这条挡掉。

const RECENT_DAYS = 150

// 第三道降噪：政府站栏目里混着大量「行政审批结果公示」，对申报毫无价值，
// 实跑发现生态环境部 31 条里约 25 条都是这类，会把真正可申报的通知挤掉。
const NOISE = /审批决定|审批意见|拟作出|拟进行审查|受理情况|拟审查|审批结果|办理结果|准予|不予许可|中标|成交|政府采购|招标公告|注销|吊销|行政处罚|听证|送达|行政复议|信访|拟聘|考察对象|体检|笔试|面试/

function parseDateFromText (s) {
  const m = s.match(/(\d{4})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/)
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3] }
}

function parseDateFromUrl (u) {
  const m = u.match(/t(\d{4})(\d{2})(\d{2})[_./-]/)
  if (!m) return null
  return { y: +m[1], mo: +m[2], d: +m[3] }
}

function parseYearFromUrl (u) {
  let m = u.match(/\/art\/(\d{4})\//)
  if (m) return +m[1]
  m = u.match(/\/(\d{4})(\d{2})\//)
  if (m) return +m[1]
  return 0
}

function toStr (o) {
  return o.y + '-' + ('0' + o.mo).slice(-2) + '-' + ('0' + o.d).slice(-2)
}

// 标题前的「2024.07.16 」这类日期前缀去掉，避免污染卡片标题
function cleanTitle (t) {
  return t.replace(/^\s*\d{4}\s*[.\-年\/]\s*\d{1,2}\s*[.\-月\/]\s*\d{1,2}\s*日?\s*/, '').trim()
}

function makeParseList (TRUST_KEYWORDS) {
  const kwRe = new RegExp(TRUST_KEYWORDS.join('|'))
  const now = Date.now()
  const cutoff = now - RECENT_DAYS * 86400000
  const thisYear = new Date(now).getFullYear()

  return function parseList (html, src) {
    const out = []
    const re = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let m
    const seenUrl = {}
    const seenTitle = {}

    while ((m = re.exec(html))) {
      let title = cleanTitle(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      if (title.length < 4 || title.length > 60) continue
      if (!kwRe.test(title)) continue
      if (NOISE.test(title)) continue

      let href = m[1]
      if (/^(javascript:|#|mailto:)/i.test(href)) continue
      if (href.indexOf('http') !== 0) {
        try { href = new URL(href, src.base).href } catch (e) { continue }
      }
      // 登录页 / 带端口的内网入口，不是通知
      if (/\/login|:9092|:\d{4,5}\//i.test(href)) continue
      // 源级路径规则：有的站首页混着大量新闻稿，靠 URL 路径排除掉
      if (src.excludeUrl && src.excludeUrl.test(href)) continue
      if (src.includeUrl && !src.includeUrl.test(href)) continue
      if (seenUrl[href]) continue
      seenUrl[href] = true
      if (seenTitle[title]) continue

      const near = html.slice(Math.max(0, m.index - 300), m.index + 300)
      let d = parseDateFromText(near) || parseDateFromUrl(href)
      let publishedAt = ''
      let deadlineText = ''

      if (d) {
        const ts = new Date(d.y + '-' + ('0' + d.mo).slice(-2) + '-' + ('0' + d.d).slice(-2) + 'T00:00:00+08:00').getTime()
        if (!(ts >= cutoff)) continue
        publishedAt = toStr(d)
        deadlineText = '通知发布日 ' + d.y + '年' + d.mo + '月' + d.d + '日（截止日待核实）'
      } else {
        // 取不到完整日期时，退一步看 URL 里的年份；今年及以后才留（政府站 /art/2026/ 这种）
        const y = parseYearFromUrl(href)
        if (!(y >= thisYear)) continue
        publishedAt = y + '-??-??'
        deadlineText = y + ' 年发布（月日待核实 · 截止日待核实）'
      }

      seenTitle[title] = true
      out.push({
        type: src.type,
        title: title,
        org: src.name,
        region: src.region,
        level: src.level,
        disciplines: src.disciplines,
        deadline: '',
        deadlineText: deadlineText,
        deadlineEstimated: true,
        publishedAt: publishedAt,
        sourceUrl: href,
        sourceName: src.name,
        source: 'crawl',
        status: 'raw',
        createdAt: now
      })
    }
    return out
  }
}

module.exports = { makeParseList }
