#!/usr/bin/env node
/**
 * build_pack.js —— 把爬虫抓到的「候选通知」转换成小程序包内的数据文件
 *
 * 用法：node tools/build_pack.js [--limit=60]
 * 输入：data/crawl_candidates.json（由 tools/local_spider.js 生成）
 * 输出：utils/data_crawl.js       （小程序 require 的静态数据，无需域名/云开发）
 *
 * 铁律：
 *  1. 列表页拿到的是「通知发布日」，不是「申报截止日」→ deadline 一律留空，
 *     卡片会落在「日期待定」段，绝不冒充截止日。
 *  2. 与人工核实条目（notices.js / notices_extra.js）标题重复的一律剔掉，
 *     人工条目的字段更全，不能被粗糙的抓取版覆盖。
 *  3. id 由 sourceUrl 哈希生成，稳定不变 —— 用户收藏了不会因为重新生成而丢。
 */

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')

function argLimit () {
  const a = process.argv.find(function (x) { return x.indexOf('--limit=') === 0 })
  if (a) {
    const n = parseInt(a.split('=')[1], 10)
    if (n > 0) return n
  }
  return 60
}

// 与 notices.js 的 normKey 保持一致，用于跨文件去重
function normKey (title) {
  return String(title || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[（）()《》「」【】〔〕·、,，。.:：;；"'“”‘’\-—_/]/g, '')
    .slice(0, 20)
}

// 稳定 id：djb2 哈希，同一 URL 永远得到同一个 id
function hashId (str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0
  }
  return 'cw' + h.toString(36)
}

function safeRequire (p) {
  try { return require(p) } catch (e) { return null }
}

function main () {
  const srcPath = path.join(ROOT, 'data', 'crawl_candidates.json')
  if (!fs.existsSync(srcPath)) {
    console.error('✗ 缺少 data/crawl_candidates.json，先运行 node tools/local_spider.js')
    process.exit(1)
  }

  const raw = JSON.parse(fs.readFileSync(srcPath, 'utf8'))
  const items = Array.isArray(raw) ? raw : (raw.items || [])
  if (!items.length) {
    console.error('✗ 候选为空，本次不覆盖已有数据文件（保留上一版，避免线上内容被清空）')
    process.exit(0)
  }

  // ---- 1. 收集人工条目的标题，用于去重 ----
  const manualKeys = {}
  const manualLibs = [
    safeRequire(path.join(ROOT, 'utils', 'notices.js')),
    safeRequire(path.join(ROOT, 'utils', 'notices_extra.js'))
  ]
  manualLibs.forEach(function (lib) {
    if (!lib) return
    const arr = []
    if (Array.isArray(lib.NOTICES)) arr.push.apply(arr, lib.NOTICES)
    if (Array.isArray(lib.EXTRA)) arr.push.apply(arr, lib.EXTRA)
    // notices.js 导出的是合并后的全量，也读一次
    if (typeof lib.getAll === 'function') {
      try { arr.push.apply(arr, lib.getAll()) } catch (e) {}
    }
    arr.forEach(function (n) {
      const k = normKey(n && n.title)
      if (k) manualKeys[k] = true
    })
  })
  console.log('人工条目索引:', Object.keys(manualKeys).length, '条')

  // ---- 2. 过滤 + 去重 ----
  const seen = {}
  const kept = []
  let dupManual = 0
  let dupSelf = 0
  let noUrl = 0

  items.forEach(function (n) {
    if (!n || !n.title || !n.sourceUrl) { noUrl++; return }
    const k = normKey(n.title)
    if (!k) { noUrl++; return }
    if (manualKeys[k]) { dupManual++; return }
    if (seen[k]) { dupSelf++; return }
    seen[k] = true
    kept.push(n)
  })

  // ---- 3. 排序：新的优先，同日期看匹配分 ----
  kept.sort(function (a, b) {
    const da = String(a.publishedAt || '')
    const db = String(b.publishedAt || '')
    if (da !== db) return db.localeCompare(da)
    return (b._score || 0) - (a._score || 0)
  })

  const limit = argLimit()
  const finalList = kept.slice(0, limit)

  // ---- 4. 生成小程序数据文件 ----
  const outItems = finalList.map(function (n) {
    return {
      id: hashId(n.sourceUrl),
      type: n.type || 'project',
      title: n.title,
      org: n.org || '',
      region: n.region || '国家',
      level: n.level || '国家级',
      disciplines: n.disciplines || [],
      // 铁律：截止日留空
      deadline: '',
      deadlineText: n.deadlineText || ('通知发布日 ' + (n.publishedAt || '') + '（截止日待核实）'),
      publishedAt: n.publishedAt || '',
      sourceUrl: n.sourceUrl,
      sourceName: n.sourceName || n.org || '',
      summary: ''
    }
  })

  const today = new Date()
  const stamp = today.getFullYear() + '-' +
    String(today.getMonth() + 1).padStart(2, '0') + '-' +
    String(today.getDate()).padStart(2, '0')

  const head = [
    '// ⚠️ 本文件由 tools/build_pack.js 自动生成，请勿手改（下次生成会被覆盖）',
    '// 数据来源：GitHub Actions 每日爬取官方通知列表页',
    '// 铁律：这里只有「通知发布日」，没有「申报截止日」——deadline 全为空，',
    '//       条目会落在小程序首页「日期待定」段，待人工核实后再补精确日期。',
    '',
    "const UPDATED_AT = '" + stamp + "'",
    '',
    "const ITEMS = " + JSON.stringify(outItems, null, 2),
    '',
    'module.exports = {',
    '  UPDATED_AT: UPDATED_AT,',
    '  ITEMS: ITEMS',
    '}',
    ''
  ].join('\n')

  const outPath = path.join(ROOT, 'utils', 'data_crawl.js')
  fs.writeFileSync(outPath, head, 'utf8')

  console.log('—'.repeat(50))
  console.log('候选总数   :', items.length)
  console.log('缺链接/标题:', noUrl)
  console.log('与人工重复 :', dupManual)
  console.log('自身重复   :', dupSelf)
  console.log('可入库     :', kept.length)
  console.log('实际写入   :', outItems.length, '(上限 ' + limit + ')')
  console.log('输出文件   : utils/data_crawl.js')
  console.log('整理日期   :', stamp)
  console.log('—'.repeat(50))
}

main()
