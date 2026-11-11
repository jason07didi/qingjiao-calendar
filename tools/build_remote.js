// tools/build_remote.js
// 把合并后的全量数据导出成 GitHub Pages 可访问的 data/notices.json。
// 小程序用 wx.request 拉这个文件，就实现了「不重新发版也能换内容」。
//
// 用法：node tools/build_remote.js
// 输出：docs/data/notices.json   ← 把 Pages 源设成 main 分支 /docs 目录即可
//       （URL = https://<用户名>.github.io/<仓库名>/data/notices.json）

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const lib = require(path.join(ROOT, 'utils/notices.js'))

const OUT_DIR = path.join(ROOT, 'docs', 'data')
const OUT_FILE = path.join(OUT_DIR, 'notices.json')

// 只导出前端真正用到的字段，能省一半体积（用户流量是有限的）
const FIELDS = [
  'id', 'type', 'title', 'org', 'region', 'level', 'rank',
  'disciplines', 'startAt', 'deadline', 'deadlineText', 'deadlineEstimated',
  'deadlineFrom', 'deadlineSnippet',
  'openApply', 'info', 'conditions', 'files', 'summary', 'curated',
  'peerNote', 'freq', 'sourceUrl', 'sourceName', 'source', 'auto'
]

function pick (n) {
  const o = {}
  for (let i = 0; i < FIELDS.length; i++) {
    const k = FIELDS[i]
    const v = n[k]
    if (v === undefined || v === null) continue
    if (v === '') continue
    if (Array.isArray(v) && !v.length) continue
    if (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length) continue
    o[k] = v
  }
  return o
}

// 北京时间 ISO 串
function isoCN (d) {
  const t = new Date(d.getTime() + 8 * 3600 * 1000)
  return t.toISOString().replace('Z', '+08:00')
}

function main () {
  const all = lib.getAll()
  if (!all.length) {
    console.error('❌ 没有数据，先跑 tools/build_pack.js')
    process.exit(1)
  }

  const items = all.map(pick)

  // 完整性自检：id 必须唯一、标题必须有、截止日必须是空或 YYYY-MM-DD
  const seen = {}
  let dup = 0
  let badDate = 0
  let noTitle = 0
  for (const it of items) {
    if (seen[it.id]) dup++
    seen[it.id] = 1
    if (!it.title) noTitle++
    if (it.deadline && !/^\d{4}-\d{2}-\d{2}$/.test(it.deadline)) badDate++
  }
  if (dup || noTitle || badDate) {
    console.error('❌ 自检失败：重复 id ' + dup + ' / 无标题 ' + noTitle + ' / 日期格式错 ' + badDate)
    process.exit(1)
  }

  const payload = {
    v: 1,
    updatedAt: lib.AUTO_UPDATED_AT || lib.DATA_UPDATED_AT || '',
    generatedAt: isoCN(new Date()),
    count: items.length,
    // 给前端做展示用的分布，详情页/统计页可直接读，不用再算
    datedCount: items.filter(x => x.deadline).length,
    autoCount: items.filter(x => x.auto).length,
    items: items
  }

  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })
  const txt = JSON.stringify(payload)
  fs.writeFileSync(OUT_FILE, txt, 'utf8')

  const kb = (Buffer.byteLength(txt, 'utf8') / 1024).toFixed(1)
  console.log('✅ 已生成 ' + path.relative(ROOT, OUT_FILE))
  console.log('   条数      : ' + items.length + '（有截止日 ' + payload.datedCount + ' / 自动抓取 ' + payload.autoCount + '）')
  console.log('   整理日    : ' + payload.updatedAt)
  console.log('   文件体积  : ' + kb + ' KB')
  console.log('   线上地址  : https://jason07didi.github.io/<仓库名>/data/notices.json')
  if (kb > 400) console.log('   ⚠️  超过 400KB，建议精简 summary / info 字段')
}

main()
