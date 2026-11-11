#!/usr/bin/env node
/**
 * preview_filter.js —— 只做「预演」，不改任何数据文件。
 *
 * 目的：验证 cloudfunctions/spider/classify.js 里的 judge() 规则
 * 若接到 tools/build_pack.js 上，会把多少条噪音挡在门外。
 *
 * 用法：node tools/preview_filter.js
 * 输入：data/crawl_candidates.json
 * 输出：终端统计 + data/filter_preview.md（仅供参考，不参与打包）
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const cl = require(path.join(ROOT, 'cloudfunctions/spider/classify.js'))

const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/crawl_candidates.json'), 'utf8'))
const items = Array.isArray(raw) ? raw : (raw.items || [])

const keep = []
const drop = {}
const reasons = {}

items.forEach(function (it) {
  const j = cl.judge(it, it.disciplines)
  if (j.keep) {
    keep.push({
      title: it.title,
      org: it.org,
      publishedAt: it.publishedAt || '',
      type: j.type,
      url: it.sourceUrl || ''
    })
  } else {
    reasons[j.reason] = (reasons[j.reason] || 0) + 1
    if (!drop[j.reason]) drop[j.reason] = []
    drop[j.reason].push(it.title)
  }
})

const lines = []
lines.push('# 过滤规则预演（不影响线上数据）')
lines.push('')
lines.push('候选总数：' + items.length + ' 条；按 classify.judge 保留 ' + keep.length + ' 条，剔除 ' + (items.length - keep.length) + ' 条。')
lines.push('')
lines.push('## 剔除原因分布')
lines.push('')
Object.keys(reasons).sort(function (a, b) { return reasons[b] - reasons[a] }).forEach(function (k) {
  lines.push('- `' + k + '`：' + reasons[k] + ' 条')
})
lines.push('')
lines.push('## 保留条目（' + keep.length + ' 条）')
lines.push('')
keep.forEach(function (k, i) {
  lines.push((i + 1) + '. [' + k.type + '] ' + k.title + ' — ' + k.org + ' · ' + k.publishedAt)
  lines.push('   ' + k.url)
})
lines.push('')
lines.push('## 各原因剔除样例（每类最多 5 条）')
lines.push('')
Object.keys(drop).forEach(function (k) {
  lines.push('### ' + k + '（' + reasons[k] + ' 条）')
  drop[k].slice(0, 5).forEach(function (t) { lines.push('- ' + t) })
  lines.push('')
})

fs.writeFileSync(path.join(ROOT, 'data', 'filter_preview.md'), lines.join('\n'), 'utf8')

console.log('候选总数:', items.length)
console.log('保留    :', keep.length)
console.log('剔除    :', items.length - keep.length)
console.log('原因分布:', JSON.stringify(reasons))
console.log('输出    : data/filter_preview.md')
