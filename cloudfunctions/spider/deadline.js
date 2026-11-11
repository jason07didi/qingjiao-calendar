// 详情页截止日提取器
// ---------------------------------------------------------------------------
// 列表页那个日期是「发布日」，不是「截止日」——所以 deadline 只能从详情页正文里摘。
// 本模块只做一件事：从通知原文里找出「请于 X 月 X 日 前报送 / 截止时间为 X 月 X 日」
// 这类明确表述，摘成 YYYY-MM-DD，并把命中的那句原文一并返回，供前端标注「参考截止」。
//
// 三条硬规则：
//  1) 摘不到就是 null，不推算、不用往年规律补；
//  2) 命中句必须落在「申报/报送/提交/申请」语境里，避开「发布时间/会议时间/有效期」；
//  3) 结果必须落在发布日之后、400 天之内，否则视为识别错误丢弃。
// 输出的日期一律带 deadlineEstimated=true —— 机器摘的，必须人工核。
// ---------------------------------------------------------------------------

// 全角转半角 + 去标签 + 压缩空白
function htmlToText (html) {
  let s = String(html || '')
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  s = s.replace(/<br\s*\/?>/gi, '\n')
  s = s.replace(/<\/(p|div|li|tr|h\d)>/gi, '\n')
  s = s.replace(/<[^>]+>/g, ' ')
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
  // 全角数字/冒号/斜杠 → 半角，正则只写一套
  s = s.replace(/[０-９]/g, function (c) { return String.fromCharCode(c.charCodeAt(0) - 65248) })
  s = s.replace(/[：]/g, ':').replace(/[／]/g, '/').replace(/[．]/g, '.')
  s = s.replace(/[\s\u3000]+/g, ' ')
  return s
}

// 语境词：命中这三个说明这句在讲「交材料」，不是讲「开会」
const CLUE_SUBMIT = /申报|报送|提交|递交|寄送|邮寄|反馈|报名|注册|申请|推荐|受理|填报|材料/
// 反向：这句在讲发布/会议/有效期 → 不是申报截止
const CLUE_NOT = /发布时间|发布日期|印发日期|成文日期|发文日期|签发日期|有效期至?|会议时间|会议日期|举办时间|活动时间|召开时间|考察时间|考试时间|开课时间/

const PATTERNS = [
  // 「请于 2026 年 11 月 15 日 17:00 前 报送/提交…」
  {
    name: 'before',
    weight: 3,
    re: /(?:请于|应于|须于|务必于|需要在|并于|于)\s*(?:(\d{4})\s*[年\-\/.]\s*)?(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日?\s*(?:[（(][^）)]{0,10}[）)])?\s*(?:\d{1,2}\s*[:时]\s*\d{0,2}\s*分?)?\s*(?:之前|以前|前)/g
  },
  // 「截止时间（日期）为 2026 年 11 月 15 日」「截至 11 月 15 日」
  {
    name: 'deadline',
    weight: 3,
    re: /(?:截止|截至)(?:时间|日期|日)?\s*(?:为|是|至|:)?\s*(?:(\d{4})\s*[年\-\/.]\s*)?(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日?/g
  },
  // 「申报时间：11 月 1 日至 11 月 20 日」→ 取区间末日
  {
    name: 'rangeEnd',
    weight: 2,
    re: /(?:申报|报名|填报|提交|受理|申请|推荐)(?:时间|日期|期限)?\s*(?:为|:)?\s*[^。；;]{0,30}?(?:至|到|—|－|-)\s*(?:(\d{4})\s*[年\-\/.]\s*)?(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日/g
  },
  // 「9 月 15 日 16 时截止」——日期在前、截止在后（评审结果通告常用这种写法）
  {
    name: 'dateThenDeadline',
    weight: 3,
    re: /(?:(\d{4})\s*[年\-\/.]\s*)?(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日\s*(?:\d{1,2}\s*[:时]\s*\d{0,2}\s*分?)?\s*(?:截止|截至)/g
  },
  // 「系统将于 7 月 31 日至 8 月 10 日 17 时开放」——窗口结束即截止
  {
    name: 'untilEnd',
    weight: 2,
    re: /(?:至|到)\s*(?:(\d{4})\s*[年\-\/.]\s*)?(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})\s*日?\s*(?:\d{1,2}\s*[:时]\s*\d{0,2}\s*分?)?\s*(?:开放|结束|关停|关闭|止)/g
  },
  // 「2026-11-15 前」「2026.11.15 截止」
  {
    name: 'isoBefore',
    weight: 2,
    re: /((?:19|20)\d{2})\s*[\-\/.]\s*(\d{1,2})\s*[\-\/.]\s*(\d{1,2})\s*(?:日)?\s*(?:之前|以前|前|截止|24:00|23:59)/g
  }
]

function pad (n) { return ('0' + n).slice(-2) }

function iso (y, mo, d) {
  if (y < 2000 || y > 2100) return null
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  const dt = new Date(y + '-' + pad(mo) + '-' + pad(d) + 'T00:00:00+08:00')
  if (isNaN(dt.getTime())) return null
  // 2 月 31 日这类会被 Date 顺延，用回读校验挡掉
  if (dt.getUTCMonth() + 1 !== mo && dt.getMonth() + 1 !== mo) return null
  return y + '-' + pad(mo) + '-' + pad(d)
}

function parsePublished (s) {
  const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return null
  const t = new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T00:00:00+08:00').getTime()
  return isNaN(t) ? null : t
}

// 主函数：返回 { deadline, snippet, method, score } 或 null
function extractDeadline (html, opts) {
  opts = opts || {}
  const text = htmlToText(html)
  if (text.length < 80) return null

  const pubTs = parsePublished(opts.publishedAt)
  const pubYear = pubTs ? new Date(pubTs + 8 * 3600 * 1000).getUTCFullYear() : new Date().getFullYear()
  const baseYear = pubTs ? pubYear : new Date().getFullYear()
  const minTs = pubTs ? pubTs - 2 * 86400000 : Date.now() - 400 * 86400000
  const maxTs = pubTs ? pubTs + 400 * 86400000 : Date.now() + 400 * 86400000

  const cands = []
  for (let i = 0; i < PATTERNS.length; i++) {
    const p = PATTERNS[i]
    p.re.lastIndex = 0
    let m
    while ((m = p.re.exec(text))) {
      const yRaw = m[1]
      const mo = +m[2]
      const d = +m[3]
      if (!mo || !d) continue

      let y = yRaw ? +yRaw : 0
      if (!y) {
        // 没有年份：按发布年推；推出来比发布日早两个月以上，说明跨年了
        y = baseYear
        let ts = new Date(y + '-' + pad(mo) + '-' + pad(d) + 'T00:00:00+08:00').getTime()
        if (pubTs && ts < pubTs - 60 * 86400000) {
          y = baseYear + 1
          ts = new Date(y + '-' + pad(mo) + '-' + pad(d) + 'T00:00:00+08:00').getTime()
        }
      }
      const ds = iso(y, mo, d)
      if (!ds) continue
      const ts = new Date(ds + 'T00:00:00+08:00').getTime()
      if (ts < minTs || ts > maxTs) continue

      const from = Math.max(0, m.index - 60)
      const to = Math.min(text.length, m.index + m[0].length + 40)
      const ctx = text.slice(from, to).trim()

      let sc = p.weight
      if (CLUE_SUBMIT.test(ctx)) sc += 2
      if (CLUE_NOT.test(ctx)) sc -= 5
      // 「截止」+「申报/报送」同时出现，可信度最高
      if (p.name === 'deadline' && /申报|报送|提交|申请/.test(ctx)) sc += 1

      cands.push({ deadline: ds, ts: ts, score: sc, snippet: ctx, method: p.name })
    }
  }

  const good = cands.filter(function (c) { return c.score >= 3 })
  if (!good.length) return null

  // 同一篇里有多轮截止（如「系统填报 11/15，纸质材料 11/20」）→ 取最晚的那天，
  // 保证用户看到的是「还来得及」的最后期限，而不是最早那一关。
  good.sort(function (a, b) {
    if (b.ts !== a.ts) return b.ts - a.ts
    return b.score - a.score
  })
  const best = good[0]
  // 命中句压缩成一行，最长 60 字，便于直接展示
  let snip = best.snippet.replace(/\s+/g, ' ').replace(/^[，,。;；]/, '').trim()
  if (snip.length > 60) snip = '…' + snip.slice(-58)
  return { deadline: best.deadline, snippet: snip, method: best.method, score: best.score }
}

module.exports = { extractDeadline, htmlToText }
