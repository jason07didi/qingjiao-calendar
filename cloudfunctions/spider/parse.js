// 列表页通用解析器：从 HTML 里抽「标题 + 链接 + 发布日期」。
// 抽成独立模块，供 云函数 spider/index.js 与 本机 tools/local_spider.js 共用同一份逻辑。
//
// ⚠️ 日期铁律：列表页上那个日期是「通知发布日期」，不是「申报截止日」。
//    因此 deadline 一律留空，只把发布日写进 deadlineText 作为线索。
//    真正的截止日由 cloudfunctions/spider/deadline.js 从详情页原文里摘取，
//    摘不到就是空，绝不推算、绝不猜测。
//
// 两道降噪（2026-11-03 实跑后补）：
//  1) 必须能定位到发布日期（正文附近 or 从 URL 的 t20261029_ 模式里取），
//     —— 导航入口/栏目页没有日期，靠这条挡掉；
//  2) 发布日期必须在最近 RECENT_DAYS 天内（取不到日则要求年份 >= 今年），
//     —— 政府站栏目页常年挂着 2023/2024 的旧文，靠这条挡掉。
//
// 2026-11-11 三处修正（接入省级源时暴露）：
//  1) 相对链接必须相对「列表页地址」解析。原来统一相对站点根，导致
//     教育厅 `./202611/t20261110_xxx.html` 被拼成 /202611/... 全部 404。
//  2) URL 里推年份原来用 /(\d{4})(\d{2})\//，把 /GB/219469/ 认成 2194 年，
//     给全国社科办造出一条 2194 年的假通知。现在要求 19xx/20xx 且月份合法。
//  3) 机构名优先取 src.org（种子源里 org 是干净的机构名）。

const RECENT_DAYS = 150

// 第三道降噪：政府站栏目里混着大量「行政审批结果公示」，对申报毫无价值，
// 实跑发现生态环境部 31 条里约 25 条都是这类，会把真正可申报的通知挤掉。
const NOISE = /审批决定|审批意见|拟作出|拟进行审查|受理情况|拟审查|审批结果|办理结果|准予|不予许可|中标|成交|政府采购|招标公告|注销|吊销|行政处罚|听证|送达|行政复议|信访|拟聘|招聘|招录|选调|考察对象|体检|笔试|面试|结项|获奖名单|拟资助人员|复核结果|公租房|保障性住房|轮候|摇号选房|物业费|房屋安全鉴定|公积金/

function parseDateFromText (s) {
  const m = s.match(/(\d{4})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/)
  if (!m) return null
  const y = +m[1]; const mo = +m[2]; const d = +m[3]
  if (y < 2000 || y > 2100 || mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y: y, mo: mo, d: d }
}

function parseDateFromUrl (u) {
  const m = u.match(/t((?:19|20)\d{2})(\d{2})(\d{2})[_./-]/)
  if (!m) return null
  const mo = +m[2]; const d = +m[3]
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return { y: +m[1], mo: mo, d: d }
}

function parseYearFromUrl (u) {
  let m = u.match(/\/art\/((?:19|20)\d{2})\//)
  if (m) return +m[1]
  // 只要 19xx/20xx，且后面月必须是 01-12，避免 /GB/219469/ 被读成 2194 年
  m = u.match(/\/((?:19|20)\d{2})(0[1-9]|1[0-2])\//)
  if (m) return +m[1]
  m = u.match(/\/n((?:19|20)\d{2})\/(0[1-9]|1[0-2])\//)
  if (m) return +m[1]
  return 0
}

function toStr (o) {
  return o.y + '-' + ('0' + o.mo).slice(-2) + '-' + ('0' + o.d).slice(-2)
}

// 标题上的日期噪声去掉：
//   前缀「2024.07.16 」、后缀「 2026-11-04」、以及列表页常见的「》 」残渣
function cleanTitle (t) {
  return String(t || '')
    .replace(/^[\s》»›]+/, '')
    .replace(/^\s*\d{4}\s*[.\-年\/]\s*\d{1,2}\s*[.\-月\/]\s*\d{1,2}\s*日?\s*/, '')
    .replace(/\s*\d{4}\s*[.\-年\/]\s*\d{1,2}\s*[.\-月\/]\s*\d{1,2}\s*日?\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
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
    // 相对链接以「列表页」为基准；没有 listUrl 才退回站点根
    const hrefBase = src.listUrl || src.base

    while ((m = re.exec(html))) {
      let title = cleanTitle(m[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim())
      if (title.length < 4 || title.length > 60) continue
      if (!kwRe.test(title)) continue
      if (NOISE.test(title)) continue

      let href = m[1]
      if (/^(javascript:|#|mailto:|tel:)/i.test(href)) continue
      if (href.indexOf('http') !== 0) {
        try { href = new URL(href, hrefBase).href } catch (e) { continue }
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
      const d = parseDateFromText(near) || parseDateFromUrl(href)
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
        org: src.org || src.name,
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
