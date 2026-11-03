// 清除预估条目的虚构 deadline。
// 原则：精确截止日只能来自真实通知（爬虫抓取或人工核实）。
// deadlineText 带「预估/参考」标记的条目：
//   deadline / startAt 置空 → UI 显示「待定」，倒计时/日历不再出现假日期
//   deadlineText 改写为「官方通知待发布（往年约M月 · 原有说明）」
// 例外 = 已核实真实通知的条目，不动。
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MARK_RE = /预估|参考/
const EXCEPTIONS = {
  // 3/4/9 = 2027 年度省科技发展计划征集（2026-11-01 联网核实）
  // 19 = 2026 规划年会（此前核实）；q01 = 团省委通知（真实）
  'utils/notices.js': ['3', '4', '9', '19'],
  'utils/notices_extra.js': ['q01']
}

let n = 0
;['utils/notices.js', 'utils/notices_extra.js'].forEach(function (rel) {
  const p = path.join(ROOT, rel)
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  let curId = ''
  let skip = false
  const out = lines.map(function (line) {
    const idm = line.match(/\bid:\s*'?([A-Za-z]?\d+)'?,/)
    if (idm) { curId = idm[1]; skip = EXCEPTIONS[rel].indexOf(curId) > -1 }
    if (skip) return line

    // deadlineText：带预估/参考 → 改写为「待发布 + 往年月份」
    const tm = line.match(/(deadlineText:\s*')([^']+)('\s*,)/)
    if (tm && MARK_RE.test(tm[2])) {
      const monthM = tm[2].match(/(\d{4})年(\d{1,2})月/)
      const paren = tm[2].match(/（([^）]*)）/)
      let extra = paren ? paren[1].replace(/^参考，?|^参考/, '') : ''
      let text = '官方通知待发布'
      if (monthM) text += '（往年约 ' + parseInt(monthM[2], 10) + ' 月'
      else text += '（往年时间见说明'
      if (extra) text += ' · ' + extra
      text += '）'
      n++
      return line.replace(tm[0], tm[1] + text + tm[3])
    }

    // deadline / startAt：预估条目里的日期一律清空
    if (/(startAt|deadline):\s*'[\d-]+/.test(line)) {
      n++
      return line.replace(/(startAt|deadline)(:\s*)'[\d-]+[^']*'/, "$1$2''")
    }
    return line
  })
  fs.writeFileSync(p, out.join('\n'))
})
console.log('cleaned fields:', n)
