// 第二遍：把预估条目同一行里的 startAt / deadline 日期清空。
// （第一遍只改了 deadlineText，同一行的日期字段没动。）
// 已是「官方通知待发布」的文本不再二次改写；例外条目整体跳过。
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MARK_RE = /预估|参考|官方通知待发布/
const EXCEPTIONS = {
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
    if (!/deadlineText:/.test(line) || !MARK_RE.test(line)) return line
    const next = line.replace(/(startAt)(:\s*)'[\d-]+[^']*'/, "$1$2''")
      .replace(/(deadline)(:\s*)'[\d-]+[^']*'/, "$1$2''")
    if (next !== line) n++
    return next
  })
  fs.writeFileSync(p, out.join('\n'))
})
console.log('lines fixed:', n)
