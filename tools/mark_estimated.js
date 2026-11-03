// 给手工整理条目的 deadlineText 统一补「（预估）」标记。
// 规则：截止文本里没有「参考/预估/为准/常年/换届/滚动/公告/已截止」等
// 诚实标记的，一律视为推算日期，追加「（预估）」。
// 例外 = 有真实通知依据的条目，不改。
'use strict'
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const MARK_RE = /参考|预估|为准|常年|换届|滚动|公告|已截止|按专题|随专题/

// id -> 有真实依据，不标记
const EXCEPTIONS = {
  'utils/notices.js': ['3', '4', '8', '9', '19'],
  'utils/notices_extra.js': ['q01', 'q03', 's01', 's02']
}

let changed = 0
;['utils/notices.js', 'utils/notices_extra.js'].forEach(function (rel) {
  const p = path.join(ROOT, rel)
  const lines = fs.readFileSync(p, 'utf8').split('\n')
  let curId = ''
  const skip = EXCEPTIONS[rel] || []
  const out = lines.map(function (line) {
    const idm = line.match(/\bid:\s*'?([A-Za-z]?\d+)'?,/)
    if (idm) curId = idm[1]
    const tm = line.match(/(deadlineText:\s*')([^']+)('\s*,)/)
    if (!tm) return line
    if (MARK_RE.test(tm[2])) return line
    if (skip.indexOf(curId) > -1) return line
    changed++
    return line.replace(tm[0], tm[1] + tm[2] + '（预估）' + tm[3])
  })
  fs.writeFileSync(p, out.join('\n'))
})
console.log('marked:', changed)
