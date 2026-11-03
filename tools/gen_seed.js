#!/usr/bin/env node
/**
 * tools/gen_seed.js
 *
 * 生成云开发数据库的导入文件 data/seed_notices.jsonl
 * （微信云开发控制台「数据库 → notices → 导入」要求每行一个 JSON 对象，即 JSON Lines）
 *
 * 用途：开通云开发后，把现有 305 条（245 人工 + 60 自动）一次性导进 notices 集合，
 *       之后由 spider 云函数每天自动增量抓取，不需要再导入第二次。
 *
 * 字段与 utils/api.js 的 mapCloud() 对齐，status 只取 curated / raw
 * （fetchCloudList 的 where 条件依赖这两个值，写错会导致云端一条都查不出来）。
 */

const fs = require('fs')
const path = require('path')
const notices = require('../utils/notices.js')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'data', 'seed_notices.jsonl')

function toDoc (n) {
  const isCrawl = !!(n.auto || n.source === 'crawl')
  return {
    _id: 'jq_' + String(n.id),
    type: n.type || 'project',
    title: n.title || '',
    org: n.org || '',
    region: n.region || '',
    level: n.level || '',
    rank: n.rank || null,
    disciplines: n.disciplines || [],
    startAt: n.startAt || '',
    deadline: n.deadline || '',
    deadlineText: n.deadlineText || '',
    deadlineEstimated: !!n.deadlineEstimated,
    openApply: !!n.openApply,
    info: n.info || {},
    conditions: n.conditions || [],
    files: n.files || [],
    summary: n.summary || '',
    curated: n.curated || '',
    peerNote: n.peerNote || '',
    freq: n.freq || '',
    sourceUrl: n.sourceUrl || '',
    sourceName: n.sourceName || '',
    publishedAt: n.publishedAt || '',
    source: n.source || (isCrawl ? 'crawl' : 'curated'),
    status: isCrawl ? 'raw' : 'curated'
  }
}

function main () {
  const all = notices.getAll()
  const lines = []
  const seen = {}
  let dup = 0

  all.forEach(function (n) {
    const d = toDoc(n)
    if (seen[d._id]) { dup++; return }
    seen[d._id] = 1
    lines.push(JSON.stringify(d))
  })

  if (!fs.existsSync(path.dirname(OUT))) fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, lines.join('\n') + '\n', 'utf8')

  const size = fs.statSync(OUT).size
  const byStatus = { curated: 0, raw: 0 }
  lines.forEach(function (l) {
    const o = JSON.parse(l)
    byStatus[o.status] = (byStatus[o.status] || 0) + 1
  })

  console.log('已生成 ' + OUT)
  console.log('  总行数 ' + lines.length + (dup ? '（跳过重复 _id ' + dup + ' 条）' : ''))
  console.log('  curated ' + byStatus.curated + ' 条 / raw ' + byStatus.raw + ' 条')
  console.log('  文件大小 ' + (size / 1024).toFixed(1) + ' KB')
  console.log('')
  console.log('导入步骤：云开发控制台 → 数据库 → notices → 导入 → 选这个文件，冲突处理选「插入」')
}

main()
