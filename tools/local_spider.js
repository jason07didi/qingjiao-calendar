// 本机爬虫：复用云函数的 sources / fetch / parse 三个模块，在本地跑一遍，
// 把各站点的「通知标题 + 链接 + 发布日期」拉下来，输出候选清单供人工筛选。
//
// 用途：小程序已上线但还没接云端时，靠它把新通知捞出来，人工核实截止日后
//      补进 utils/notices_extra.js，随版本一起发布。
//
// 运行： node tools/local_spider.js
// 输出： data/crawl_candidates.json（结构化）  data/crawl_report.md（人读）

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const { SOURCES, TRUST_KEYWORDS } = require(path.join(ROOT, 'cloudfunctions/spider/sources.js'))
const { fetchText } = require(path.join(ROOT, 'cloudfunctions/spider/fetch.js'))
const { makeParseList } = require(path.join(ROOT, 'cloudfunctions/spider/parse.js'))

const parseList = makeParseList(TRUST_KEYWORDS)

// 跟「青椒的日历」主题强相关的信号词：命中越多越优先人工看
const HOT = ['申报', '征集', '截止', '基金', '项目', '课题', '评选', '奖励', '资助', '名额', '报送']
const SOFT = ['通知', '公告', '会议', '论坛', '培训', '招募', '计划', '开放']

function score (title) {
  let s = 0
  for (let i = 0; i < HOT.length; i++) if (title.indexOf(HOT[i]) > -1) s += 3
  for (let i = 0; i < SOFT.length; i++) if (title.indexOf(SOFT[i]) > -1) s += 1
  return s
}

async function runOne (src) {
  const start = Date.now()
  try {
    const html = await fetchText(src.listUrl, { timeout: 15000 })
    const items = parseList(html, src)
    return {
      src: src, ok: true, ms: Date.now() - start,
      htmlLen: html.length, items: items
    }
  } catch (e) {
    return {
      src: src, ok: false, ms: Date.now() - start,
      err: (e && (e.message || String(e))) || 'unknown', items: []
    }
  }
}

async function main () {
  const results = []
  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i]
    process.stdout.write('[' + (i + 1) + '/' + SOURCES.length + '] ' + src.name + ' ... ')
    const r = await runOne(src)
    if (r.ok) {
      console.log('OK  ' + r.items.length + ' 条  (' + r.ms + 'ms, ' + r.htmlLen + ' 字节)')
    } else {
      console.log('FAIL  ' + r.err + '  (' + r.ms + 'ms)')
    }
    results.push(r)
  }

  const okList = results.filter(function (r) { return r.ok })
  const failList = results.filter(function (r) { return !r.ok })

  // 汇总去重（同一个 sourceUrl 只留一条）
  const seen = {}
  const all = []
  for (let i = 0; i < okList.length; i++) {
    for (let j = 0; j < okList[i].items.length; j++) {
      const it = okList[i].items[j]
      if (seen[it.sourceUrl]) continue
      seen[it.sourceUrl] = true
      it._score = score(it.title)
      it._sourceId = okList[i].src.id
      all.push(it)
    }
  }
  all.sort(function (a, b) { return b._score - a._score })

  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true })
  fs.writeFileSync(
    path.join(ROOT, 'data/crawl_candidates.json'),
    JSON.stringify({ at: new Date().toISOString(), total: all.length, sources: results.map(function (r) {
      return { id: r.src.id, name: r.src.name, ok: r.ok, err: r.err || '', count: r.items.length, ms: r.ms }
    }), items: all }, null, 2)
  )

  const L = []
  L.push('# 本机爬取候选清单')
  L.push('')
  L.push('抓取时间：' + new Date().toLocaleString('zh-CN'))
  L.push('')
  L.push('## 源可达性')
  L.push('')
  L.push('| 源 | 结果 | 条数 | 耗时 |')
  L.push('|---|---|---|---|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    L.push('| ' + r.src.name + ' | ' + (r.ok ? '可访问' : '失败：' + r.err) + ' | ' + r.items.length + ' | ' + r.ms + 'ms |')
  }
  L.push('')
  L.push('## 候选条目（按相关度排序，共 ' + all.length + ' 条）')
  L.push('')
  L.push('⚠️ 下面每一行的日期都是「通知发布日」，**不是申报截止日**。要入库必须先打开链接核实截止日，核实不到就写「官方通知待发布」。')
  L.push('')
  for (let i = 0; i < all.length && i < 200; i++) {
    const it = all[i]
    L.push((i + 1) + '. **' + it.title + '**')
    L.push('   - ' + it.sourceName + ' · ' + (it.deadlineText || '无日期线索') + ' · 相关度 ' + it._score)
    L.push('   - ' + it.sourceUrl)
  }
  if (all.length > 200) L.push('')
  if (all.length > 200) L.push('（还有 ' + (all.length - 200) + ' 条见 crawl_candidates.json）')
  fs.writeFileSync(path.join(ROOT, 'data/crawl_report.md'), L.join('\n'))

  console.log('')
  console.log('=== 汇总 ===')
  console.log('可访问源 ' + okList.length + ' / ' + results.length + '，失败 ' + failList.length)
  console.log('候选条目（去重后）' + all.length + ' 条')
  console.log('已写入 data/crawl_candidates.json 与 data/crawl_report.md')
}

main().catch(function (e) {
  console.error('脚本异常:', e && e.stack || e)
  process.exit(1)
})
