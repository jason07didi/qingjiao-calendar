// tools/build_fund_pack.js
// 把 docs/data/fund 里的最新年份分片打包成小程序「兜底分包」数据模块。
// 线上 GitHub Pages 分片没就绪（404）时，基金检索页降级用这份内置数据。
//
// 用法：node tools/build_fund_pack.js
// 输出两个分包（单分包超 2MB 上限，所以拆开）：
//   packages/funddata/data.js   : 国社科 2026 + 教育部 2025-2026 + 全库 stats
//   packages/nsfcdata/data.js   : 国自然 2026 + 国自然 stats
// module.exports 形式，require.async 可加载。
//
// 改了 docs/data/fund 的分片后重跑一次即可同步内置数据。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'docs', 'data', 'fund')

const PACKS = [
  {
    out: path.join(ROOT, 'packages', 'funddata', 'data.js'),
    pick: ['nssf_2026.json', 'moe_2025_2026.json'],
    statKeys: ['nssf', 'moe'],
    withTotal: true   // 全库总条数（含国自然），页面头部「共 X 条」用
  },
  {
    out: path.join(ROOT, 'packages', 'nsfcdata', 'data.js'),
    pick: ['nsfc_2026.json'],
    statKeys: ['nsfc']
  }
]

function buildPack (cfg, manifest, statsAll) {
  const chunks = {}
  let count = 0
  for (const f of cfg.pick) {
    const p = path.join(SRC, f)
    if (!fs.existsSync(p)) {
      console.error('❌ 缺少分片文件：' + p + '（先跑 python tools/build_fund_data.py）')
      process.exit(1)
    }
    const d = JSON.parse(fs.readFileSync(p, 'utf8'))
    if (!d.items || !d.items.length) {
      console.error('❌ 分片为空：' + f)
      process.exit(1)
    }
    chunks[f] = d
    count += d.count
    console.log('  打包 %s : %d 条', f, d.count)
  }

  // 只带该分包相关的统计键，减小体积；分学科词表裁剪（兜底里 Top40/Top20 够用）
  const stats = {}
  for (const k of cfg.statKeys) {
    if (!statsAll || !statsAll[k]) continue
    const s = JSON.parse(JSON.stringify(statsAll[k]))
    if (s.discKws) {
      for (const d in s.discKws) {
        s.discKws[d].kws = (s.discKws[d].kws || []).slice(0, 40)
        s.discKws[d].kwsRecent = (s.discKws[d].kwsRecent || []).slice(0, 20)
      }
    }
    stats[k] = s
  }

  const body = JSON.stringify({
    generatedAt: manifest.generatedAt || '',
    total: cfg.withTotal ? (manifest.count || 0) : undefined,
    chunks: chunks,
    stats: stats
  })

  fs.mkdirSync(path.dirname(cfg.out), { recursive: true })
  fs.writeFileSync(cfg.out, 'module.exports = ' + body + ';', 'utf8')
  const mb = fs.statSync(cfg.out).size / 1048576
  console.log('✅ %s : 兜底分片 %d 条, %.2f MB（分包上限 2MB）',
    path.relative(ROOT, cfg.out), count, mb)
  if (mb > 1.95) {
    console.error('⚠️ 超过 1.95MB，分包可能编译失败，需要减少打包的年份')
    process.exit(1)
  }
}

function main () {
  const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'index.json'), 'utf8'))

  // 统计数据（全库）：没有就置 null，页面统计视图降级隐藏
  let statsAll = null
  const sp = path.join(SRC, 'stats.json')
  if (fs.existsSync(sp)) {
    statsAll = JSON.parse(fs.readFileSync(sp, 'utf8'))
    console.log('  打包 stats.json（学科/单位/年度统计）')
  } else {
    console.warn('⚠️ 没有 stats.json，先跑 python tools/build_fund_data.py；统计视图将不可用')
  }

  for (const cfg of PACKS) buildPack(cfg, manifest, statsAll)
}

main()
