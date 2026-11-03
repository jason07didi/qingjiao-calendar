// parser.js
// 不引 cheerio，纯正则 + 分块。目标是从各种「通知公告列表页」里稳住地抽出
// { title, url, date }，再从详情页正文里抽截止日期。
// 政府站结构千差万别，所以用「块法 + 窗口兜底」两段式，而不是精确 selector。

const ENTITY = {
  '&nbsp;': ' ', '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"',
  '&#39;': "'", '&apos;': "'", '&ldquo;': '“', '&rdquo;': '”',
  '&lsquo;': '‘', '&rsquo;': '’', '&hellip;': '…', '&mdash;': '—',
  '&middot;': '·', '&times;': '×'
}

function unescapeHtml (s) {
  let out = String(s || '')
  Object.keys(ENTITY).forEach(function (k) {
    out = out.split(k).join(ENTITY[k])
  })
  out = out.replace(/&#(\d{2,6});/g, function (m, code) {
    const n = parseInt(code, 10)
    try { return String.fromCharCode(n) } catch (e) { return '' }
  })
  return out
}

function stripTags (s) {
  return String(s || '').replace(/<[^>]*>/g, '')
}

function clean (s) {
  return unescapeHtml(stripTags(s)).replace(/[\s\u3000]+/g, ' ').trim()
}

// 标题里常见的噪声：日期前缀、"更多"、书名号外的括号备注
const TITLE_NOISE = [
  /^\s*[\[\(【（]\s*20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\s*[\]\)】）]\s*/,
  /\s*20\d{2}[-/.]\d{1,2}[-/.]\d{1,2}\s*$/,
  /^\s*[\[\(【（]\s*(置顶|推荐|新|hot|NEW)\s*[\]\)】）]\s*/i,
  /\s*[\[\(【（]\s*(点击查看|详情见附件|附名单)\s*[\]\)】）]\s*$/,
  // 列表页常把发布时间塞进 a 标签里：「…的通知 发布时间：2026-07-01 09:」
  /\s*(发布时间|发布于|来源)[:：][\s\S]*$/,
  /\s*\d{1,2}:\d{2}\s*$/
]

// 导航面包屑：形如「决策预公开/调查征集」，不是通知标题
const RE_NAV_CRUMB = /^[\u4e00-\u9fa5]{2,8}\/[\u4e00-\u9fa5]{2,8}$/

function cleanTitle (s) {
  let t = clean(s)
  TITLE_NOISE.forEach(function (re) { t = t.replace(re, '') })
  return t.replace(/\s+/g, ' ').trim()
}

const RE_DATE = /(20\d{2})\s*[-/年.]\s*(\d{1,2})\s*[-/月.]\s*(\d{1,2})/g

function pad (n) { return n < 10 ? '0' + n : '' + n }

function normDate (y, m, d) {
  const yy = parseInt(y, 10)
  const mm = parseInt(m, 10)
  const dd = parseInt(d, 10)
  if (yy < 2000 || yy > 2100) return ''
  if (mm < 1 || mm > 12) return ''
  if (dd < 1 || dd > 31) return ''
  return yy + '-' + pad(mm) + '-' + pad(dd)
}

function firstDate (text) {
  if (!text) return ''
  RE_DATE.lastIndex = 0
  const m = RE_DATE.exec(text)
  if (!m) return ''
  return normDate(m[1], m[2], m[3])
}

function allDates (text) {
  const out = []
  if (!text) return out
  RE_DATE.lastIndex = 0
  let m
  while ((m = RE_DATE.exec(text)) !== null) {
    const d = normDate(m[1], m[2], m[3])
    if (d) out.push(d)
  }
  return out
}

// 不可点击的锚文本：导航、翻页、更多
const BAD_ANCHOR = /^(更多|更多>>|more|下一页|上一页|首页|尾页|末页|登录|注册|返回|打印|关闭|分享|首页>|>>|>|<|)$/i

function isGoodHref (href) {
  if (!href) return false
  const h = href.trim()
  if (!h) return false
  if (h === '#' || h.charAt(0) === '#') return false
  if (/^javascript:/i.test(h)) return false
  return true
}

function absUrl (href, base) {
  try {
    return new URL(href, base).toString()
  } catch (e) {
    return ''
  }
}

const RE_A = /<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi

// 从一个 html 片段里挑出"像正文标题"的链接
function pickLink (chunk, baseUrl) {
  RE_A.lastIndex = 0
  let m
  let best = null
  while ((m = RE_A.exec(chunk)) !== null) {
    const href = absUrl(m[1], baseUrl)
    const title = cleanTitle(m[2])
    if (!href) continue
    if (!title || title.length < 8 || title.length > 110) continue
    if (BAD_ANCHOR.test(title)) continue
    if (RE_NAV_CRUMB.test(title)) continue
    // 至少 6 个汉字，排除图片链接、英文导航
    if ((title.match(/[\u4e00-\u9fa5]/g) || []).length < 6) continue
    // title 属性里往往有更完整的标题
    const tm = /title\s*=\s*["']([^"']{8,120})["']/i.exec(m[0])
    let finalTitle = title
    if (tm) {
      const alt = cleanTitle(tm[1])
      if (alt.length > title.length && (alt.match(/[\u4e00-\u9fa5]/g) || []).length >= 6) {
        finalTitle = alt
      }
    }
    if (!best || finalTitle.length > best.title.length) {
      best = { title: finalTitle, url: href }
    }
  }
  return best
}

const RE_SPLIT_BLOCK = /<\/li>|<\/tr>|<\/dd>|<\/p>|<br\s*\/?>/i

function splitBlocks (html) {
  // 去掉脚本/样式，避免导航脚本污染
  const cleaned = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
  return cleaned.split(RE_SPLIT_BLOCK)
}

/**
 * 解析列表页
 * @param {string} html
 * @param {string} baseUrl 用于补全相对链接
 * @returns {Array<{title,url,date}>}
 */
function parseList (html, baseUrl) {
  const blocks = splitBlocks(html)
  const out = []
  const seenUrl = {}
  const seenTitle = {}

  function push (title, url, date) {
    if (!url || seenUrl[url]) return
    const key = title.replace(/\s/g, '')
    if (seenTitle[key]) return
    seenUrl[url] = 1
    seenTitle[key] = 1
    out.push({ title: title, url: url, date: date || '' })
  }

  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i]
    if (!b || b.length > 3000) continue
    const link = pickLink(b, baseUrl)
    if (!link) continue
    // 日期通常在同块的兄弟节点里；没有就看上一块尾部
    let date = firstDate(stripTags(b))
    if (!date && i > 0) {
      date = firstDate(stripTags(blocks[i - 1]).slice(-220))
    }
    push(link.title, link.url, date)
  }

  // 兜底：整体扫描 <a>，用前后窗口找日期（应对 div 平铺、无 li 的结构）
  const flat = blocks.join(' ')
  RE_A.lastIndex = 0
  let m
  let guard = 0
  while ((m = RE_A.exec(flat)) !== null && guard < 1500) {
    guard++
    const href = absUrl(m[1], baseUrl)
    const title = cleanTitle(m[2])
    if (!href || seenUrl[href]) continue
    if (!title || title.length < 8 || title.length > 110) continue
    if (BAD_ANCHOR.test(title)) continue
    if (RE_NAV_CRUMB.test(title)) continue
    if ((title.match(/[\u4e00-\u9fa5]/g) || []).length < 6) continue
    const start = Math.max(0, m.index - 160)
    const win = stripTags(flat.slice(start, m.index + m[0].length + 160))
    const date = firstDate(win)
    push(title, href, date)
  }

  return out
}

/**
 * 详情页正文提取：去掉导航/脚本/footer，保留主体文字
 */
function parseDetail (html) {
  if (!html) return { text: '', title: '' }

  const titleM = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)
  const pageTitle = titleM ? cleanTitle(titleM[1]) : ''

  let body = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<\/(p|div|tr|li|h[1-6]|br)>/gi, '</p>\n')

  // 常见正文容器优先
  const m = /<div[^>]+(?:id|class)\s*=\s*["'][^"']*(?:article|content|zoom|txt|main|detail|TRS_Editor)[^"']*["'][^>]*>([\s\S]{200,}?)<\/div>/i.exec(body)
  if (m) body = m[1]

  const text = unescapeHtml(stripTags(body))
    .replace(/\r/g, '')
    .replace(/[ \t\u3000]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim()

  return { text: text, title: pageTitle }
}

// ---------- 截止日期抽取 ----------
// 实战里踩过的坑：
//  1) 「申报时间：9月16日9:00至10月15日17:00」——取第一个日期就错了一个月，必须取区间末端
//  2) 「请于11月5日前报送」——没有「截止」二字，但就是截止日
//  3) 「截止目前已有…」——「截止」是连词，不是日期信号
// 所以按句切、按信号强度分级、区间取末端。

const RE_SIG_STRONG = /(截止|截稿|申报期限|受理期限|deadline)/i
const RE_SIG_WEAK = /(报送|提交|申报时间|受理时间|报名|投稿|寄送|邮寄|反馈|推荐|上报|申请时间|征集时间|接收时间)/
const RE_SIG_BEFORE = /(日前|之前|以前)/

// 同时支持「2026年9月16日」和「9月16日」
const RE_DATE_ANY = /(20\d{2})\s*[年\-/.]\s*(\d{1,2})\s*[月\-/.]\s*(\d{1,2})\s*日?|(\d{1,2})\s*月\s*(\d{1,2})\s*日/g

function datesIn (text, refYear) {
  const out = []
  RE_DATE_ANY.lastIndex = 0
  let m
  while ((m = RE_DATE_ANY.exec(text)) !== null) {
    let nd = ''
    if (m[1]) {
      nd = normDate(m[1], m[2], m[3])
    } else {
      nd = normDate(refYear, m[4], m[5])
    }
    if (nd) out.push({ date: nd, index: m.index })
  }
  return out
}

// 没写年份的日期（「11月5日」）默认按发布年，如果比发布日早太多，说明是次年
function resolveYear (dateStr, publishedAt) {
  if (!publishedAt || !dateStr) return dateStr
  const a = Date.parse(publishedAt + 'T00:00:00Z')
  const b = Date.parse(dateStr + 'T00:00:00Z')
  if (isNaN(a) || isNaN(b)) return dateStr
  if (b - a < -120 * 86400000) {
    const y = parseInt(dateStr.slice(0, 4), 10) + 1
    return y + dateStr.slice(4)
  }
  return dateStr
}

// 区间分隔符（不能把日期里的 "-" 算进去）
const RE_RANGE_SEP = /(至|到|—|－|~|～|起至)/

/**
 * 从正文里抽截止日期
 * @returns {{date:string, text:string, estimated:boolean}}
 */
function findDeadline (text, publishedAt) {
  const src = String(text || '')
  const refYear = publishedAt ? parseInt(String(publishedAt).slice(0, 4), 10) : new Date().getFullYear()

  const sents = src
    .split(/[。；;\n]/)
    .map(function (s) { return s.trim() })
    .filter(function (s) { return s.length > 3 && s.length < 500 })

  function scan (sigRe) {
    for (let i = 0; i < sents.length; i++) {
      const s = sents[i]
      sigRe.lastIndex = 0
      if (!sigRe.test(s)) continue
      const ds = datesIn(s, refYear)
      if (!ds.length) continue
      let chosen = ds[0].date
      if (ds.length >= 2) {
        const span = s.slice(ds[0].index, ds[ds.length - 1].index)
        if (RE_RANGE_SEP.test(span)) chosen = ds[ds.length - 1].date
      }
      return { date: resolveYear(chosen, publishedAt), text: s.slice(0, 80), estimated: false }
    }
    return null
  }

  // 强信号 → 弱信号（报送/提交/申报时间）→ 「X月X日前」
  const hit = scan(RE_SIG_STRONG) || scan(RE_SIG_WEAK) || scan(RE_SIG_BEFORE)
  if (hit) return hit

  // 兜底：正文里出现「截止」但结构怪，取该句最后一个日期，标记为推断
  for (let i = 0; i < sents.length; i++) {
    if (!/截止|截稿/.test(sents[i])) continue
    const ds = datesIn(sents[i], refYear)
    if (ds.length) {
      return {
        date: resolveYear(ds[ds.length - 1].date, publishedAt),
        text: '（正文推断）' + sents[i].slice(0, 60),
        estimated: true
      }
    }
  }

  // 找不到就返回空，交给人工，绝不编一个日期
  return { date: '', text: '', estimated: false }
}

// 从正文抽个摘要，用于 raw 条目的「一句话说明」
function summarize (text, limit) {
  const cap = limit || 110
  const t = String(text || '')
    .replace(/\n+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= cap) return t
  // 尽量在句号处截断
  const cut = t.slice(0, cap)
  const idx = Math.max(cut.lastIndexOf('。'), cut.lastIndexOf('；'), cut.lastIndexOf('，'))
  return (idx > cap * 0.5 ? cut.slice(0, idx) : cut) + '…'
}

module.exports = {
  parseList: parseList,
  parseDetail: parseDetail,
  findDeadline: findDeadline,
  summarize: summarize,
  firstDate: firstDate,
  allDates: allDates,
  clean: clean,
  cleanTitle: cleanTitle,
  unescapeHtml: unescapeHtml,
  stripTags: stripTags
}
