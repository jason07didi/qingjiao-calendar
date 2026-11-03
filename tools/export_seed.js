// 把本地结构化数据导出成云端 notices 集合的导入 JSON（curated 态，立即对前端可见）。
// 用法：node tools/export_seed.js  →  生成 data/notices_seed.json
const fs = require('fs')
const path = require('path')
const ROOT = 'F:/微信开发平台/jason-v1.1'

const local = require(path.join(ROOT, 'utils/notices.js'))
const extra = require(path.join(ROOT, 'utils/notices_extra.js'))

const all = (local.getAll() || []).concat(extra.EXTRA || [])

const items = all.map(function (n) {
  const id = String(n.id)
  return {
    // 用 local://<id> 作为云端去重键（本地条目没有真实外链）
    sourceUrl: 'local://' + id,
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
    sourceName: n.sourceName || '',
    conf: n.conf || null,
    confLine: n.confLine || ''
    // status / source / createdAt 由 admin.import 补齐
  }
})

const outDir = path.join(ROOT, 'data')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'notices_seed.json'), JSON.stringify(items, null, 2), 'utf8')
console.log('✅ 已导出', items.length, '条到 data/notices_seed.json')
const byType = {}
items.forEach(function (x) { byType[x.type] = (byType[x.type] || 0) + 1 })
console.log('类型分布:', JSON.stringify(byType))
