const fs = require('fs')
const p = 'F:/微信开发平台/jason-v1.1/utils/notices.js'
let s = fs.readFileSync(p, 'utf8')

if (s.indexOf('data_crawl.js') > -1) {
  console.log('已接入过 data_crawl.js，跳过')
  process.exit(0)
}

// ---- 1. require 自动数据 ----
const M1 = "const confInfo = require('./conf_info.js')"
if (s.indexOf(M1) === -1) { console.error('找不到 confInfo require 锚点'); process.exit(1) }
s = s.replace(M1, M1 + `

// 自动抓取候选（GitHub Actions 每日生成 utils/data_crawl.js）
// 文件缺失时静默降级为空数组，不影响小程序正常运行
let AUTO_LIB = { ITEMS: [], UPDATED_AT: '' }
try { AUTO_LIB = require('./data_crawl.js') } catch (e) {}`)

// ---- 2. 合并进列表 ----
const M2 = '  // 3) 会议类补上专业层'
if (s.indexOf(M2) === -1) { console.error('找不到会议 enrich 锚点'); process.exit(1) }

const BLOCK = `  // 3) 自动抓取候选：只提供「通知已发布」的线索
  //    铁律：列表页日期是发布日不是截止日 → deadline 为空，卡片会落入「日期待定」段
  //    与人工条目重名的已在 tools/build_pack.js 剔除，这里再兜一次底
  ;(AUTO_LIB.ITEMS || []).forEach(function (n) {
    const k = normKey(n.title)
    if (!k || idx[k] !== undefined) return
    idx[k] = out.length
    out.push(Object.assign({}, n, {
      source: 'auto',
      auto: true,
      level: guessLevel(n),
      rank: rank.of(n),
      deadlineEstimated: true
    }))
  })

  // 4) 会议类补上专业层`

s = s.replace(M2, BLOCK)

// ---- 3. 导出自动数据的整理时间 ----
const M3 = '  DATA_UPDATED_AT: DATA_UPDATED_AT,'
if (s.indexOf(M3) > -1) {
  s = s.replace(M3, M3 + '\n  AUTO_UPDATED_AT: AUTO_LIB.UPDATED_AT,')
}

fs.writeFileSync(p, s)
console.log('✓ utils/notices.js 已接入自动抓取数据（require + 合并 + 导出）')
