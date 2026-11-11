// 本机爬虫：复用云函数的 sources / fetch / parse / deadline 四个模块，在本地跑一遍，
// 把各站点的「通知标题 + 链接 + 发布日期」拉下来，再进详情页找截止日，
// 输出候选清单供人工筛选。
//
// 用途：小程序已上线但还没接云端时，靠它把新通知捞出来，人工核实后补进
//       utils/notices_extra.js，随版本一起发布。
//
// 运行： node tools/local_spider.js
// 输出： data/crawl_candidates.json（结构化）  data/crawl_report.md（人读）
//
// 2026-11-11 改造：
//  1) 源从 7 个扩到 40+（接入了 sources.seed.json + 人社厅 + 基金委），并发抓取、核心源优先；
//  2) 新增「详情页截止日提取」：列表页日期是发布日，截止日只能从正文里摘，
//     摘到就填 deadline 并标 deadlineEstimated，同时保留原文摘录 deadlineSnippet；
//  3) 抓不到的源直接跳过并在报告里列失败原因，不重试轰炸对方站点。

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const { SOURCES, TRUST_KEYWORDS } = require(path.join(ROOT, 'cloudfunctions/spider/sources.js'))
const { fetchText } = require(path.join(ROOT, 'cloudfunctions/spider/fetch.js'))
const { makeParseList } = require(path.join(ROOT, 'cloudfunctions/spider/parse.js'))
const { extractDeadline } = require(path.join(ROOT, 'cloudfunctions/spider/deadline.js'))

const parseList = makeParseList(TRUST_KEYWORDS)

// 跟「青椒的日历」主题强相关的信号词：命中越多越优先人工看
const HOT = ['申报', '征集', '截止', '基金', '项目', '课题', '评选', '奖励', '资助', '名额', '报送', '职称', '博士后']
const SOFT = ['通知', '公告', '通告', '会议', '论坛', '培训', '招募', '计划', '开放', '指南']

// 只有这类标题才值得开详情页找截止日（其余标题大概率没有申报截止）
const NEED_DETAIL = /申报|征集|评选|报送|截止|申请|推荐|报名|招标|遴选/

const LIST_CONCURRENCY = 5
const DETAIL_CONCURRENCY = 4
const DETAIL_BUDGET = 140          // 单次运行最多抓多少张详情页
const DETAIL_MAX_AGE_DAYS = 100    // 太老的通知不再开详情（早过期了）
const LIST_BUDGET_MS = 8 * 60 * 1000
const DETAIL_BUDGET_MS = 6 * 60 * 1000

function score (title) {
  let s = 0
  for (let i = 0; i < HOT.length; i++) if (title.indexOf(HOT[i]) > -1) s += 3
  for (let i = 0; i < SOFT.length; i++) if (title.indexOf(SOFT[i]) > -1) s += 1
  return s
}

function daysAgo (dateStr) {
  const t = new Date(String(dateStr || '').replace(/\//g, '-')).getTime()
  if (isNaN(t)) return 99999
  return Math.floor((Date.now() - t) / 86400000)
}

// 简单并发池：同时跑 limit 个任务，全部结束后返回结果数组（保持入参顺序）
async function pool (tasks, limit) {
  const out = new Array(tasks.length)
  let next = 0
  async function worker () {
    while (true) {
      const i = next++
      if (i >= tasks.length) return
      out[i] = await tasks[i]()
    }
  }
  const workers = []
  for (let i = 0; i < Math.min(limit, tasks.length); i++) workers.push(worker())
  await Promise.all(workers)
  return out
}

async function runOne (src) {
  const start = Date.now()
  try {
    const html = await fetchText(src.listUrl, { timeout: 15000, insecure: !!src.insecure })
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

// 从详情页摘截止日
async function fillDeadline (it) {
  const r = await extractOne(it)
  return r
}

async function extractOne (it) {
  try {
    const html = await fetchText(it.sourceUrl, { timeout: 15000, insecure: !!it._insecure })
    const d = extractDeadline(html, { publishedAt: it.publishedAt })
    if (!d) return { ok: false, reason: '正文无明确截止表述' }
    const p = d.deadline.split('-')
    it.deadline = d.deadline
    it.deadlineEstimated = true
    it.deadlineFrom = 'detail'
    it.deadlineSnippet = d.snippet
    it.deadlineText = parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日截止（原文摘录，请核对）'
    return { ok: true, deadline: d.deadline }
  } catch (e) {
    return { ok: false, reason: '详情页打不开：' + (e.message || e) }
  }
}

async function main () {
  const t0 = Date.now()
  console.log('源总数 ' + SOURCES.length + '（核心 ' + SOURCES.filter(function (s) { return s.priority === 1 }).length + '）')

  // ---------- 阶段一：列表页 ----------
  const listTasks = SOURCES.map(function (src, i) {
    return async function () {
      const r = await runOne(src)
      const tag = r.ok ? ('OK  ' + r.items.length + ' 条') : ('FAIL ' + r.err)
      console.log('[' + (i + 1) + '/' + SOURCES.length + '] ' + src.name + ' ... ' + tag + '  (' + r.ms + 'ms)')
      return r
    }
  })
  // 分批跑：核心源先跑，超预算后剩下的只记「跳过」，不硬拖时间
  const results = []
  for (let i = 0; i < listTasks.length; i += LIST_CONCURRENCY) {
    if (Date.now() - t0 > LIST_BUDGET_MS) {
      SOURCES.slice(i).forEach(function (s) {
        results.push({ src: s, ok: false, err: '超出本次时间预算，未抓取', ms: 0, items: [] })
      })
      console.log('⚠️ 列表抓取超出时间预算，剩余 ' + (listTasks.length - i) + ' 个源跳过')
      break
    }
    const batch = await pool(listTasks.slice(i, i + LIST_CONCURRENCY), LIST_CONCURRENCY)
    results.push.apply(results, batch)
  }

  const okList = results.filter(function (r) { return r.ok })
  const failList = results.filter(function (r) { return !r.ok })

  // ---------- 汇总去重（同一个 sourceUrl 只留一条）----------
  const seen = {}
  const all = []
  for (let i = 0; i < okList.length; i++) {
    for (let j = 0; j < okList[i].items.length; j++) {
      const it = okList[i].items[j]
      if (seen[it.sourceUrl]) continue
      seen[it.sourceUrl] = true
      it._score = score(it.title)
      it._sourceId = okList[i].src.id
      it._insecure = !!okList[i].src.insecure
      it._detailLimit = okList[i].src.detailLimit || 0
      all.push(it)
    }
  }
  all.sort(function (a, b) { return b._score - a._score })

  // ---------- 阶段二：详情页找截止日 ----------
  // 规则：标题像申报类 + 发布日在 100 天内 + 该源还有详情配额 + 全局预算未用完
  const quota = {}
  const detailTargets = []
  for (let i = 0; i < all.length; i++) {
    const it = all[i]
    if (detailTargets.length >= DETAIL_BUDGET) break
    if (!NEED_DETAIL.test(it.title)) continue
    if (daysAgo(it.publishedAt) > DETAIL_MAX_AGE_DAYS) continue
    const q = quota[it._sourceId] || 0
    if (q >= it._detailLimit) continue
    quota[it._sourceId] = q + 1
    detailTargets.push(it)
  }

  console.log('')
  console.log('详情页待抓 ' + detailTargets.length + ' 张（全局上限 ' + DETAIL_BUDGET + '）')
  const dStart = Date.now()
  const dRes = await pool(detailTargets.map(function (it) {
    return async function () {
      if (Date.now() - dStart > DETAIL_BUDGET_MS) return { ok: false, reason: '超出详情预算' }
      const r = await extractOne(it)
      return r
    }
  }), DETAIL_CONCURRENCY)
  const dOk = dRes.filter(function (r) { return r && r.ok })

  // ---------- 输出 JSON ----------
  const dated = all.filter(function (x) { return x.deadline })
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true })
  fs.writeFileSync(
    path.join(ROOT, 'data/crawl_candidates.json'),
    JSON.stringify({
      at: new Date().toISOString(),
      total: all.length,
      dated: dated.length,
      sources: results.map(function (r) {
        return { id: r.src.id, name: r.src.name, ok: r.ok, err: r.err || '', count: r.items.length, ms: r.ms }
      }),
      items: all.map(function (it) {
        const o = Object.assign({}, it)
        delete o._insecure
        delete o._detailLimit
        return o
      })
    }, null, 2)
  )

  // ---------- 输出报告 ----------
  const nSrc = results.length
  const L = []
  L.push('# 本机爬取候选清单')
  L.push('')
  L.push('抓取时间：' + new Date().toLocaleString('zh-CN'))
  L.push('')
  L.push('源可达性：' + okList.length + ' / ' + nSrc + ' 可访问，失败 ' + failList.length + '；去重后候选 ' + all.length + ' 条。')
  L.push('')
  L.push('> 下面「原文截止」是从通知正文里摘出的日期，机器摘的，**入库前必须点开链接核对**；')
  L.push('> 没有标注的条目只有发布日，**不要当作截止日**。')
  L.push('')
  L.push('## 一、摘到原文截止日的条目（优先看，共 ' + dated.length + ' 条）')
  L.push('')
  if (!dated.length) {
    L.push('（本轮没有摘到明确截止日）')
  } else {
    dated.sort(function (a, b) { return a.deadline.localeCompare(b.deadline) })
    dated.forEach(function (it, i) {
      L.push((i + 1) + '. **' + it.title + '**')
      L.push('   - ' + (it.org || it.sourceName) + ' · 发布 ' + it.publishedAt + ' · **截止 ' + it.deadline + '**')
      L.push('   - 原文：' + (it.deadlineSnippet || ''))
      L.push('   - ' + it.sourceUrl)
    })
  }
  L.push('')
  L.push('## 二、源可达性')
  L.push('')
  L.push('| 源 | 结果 | 条数 | 耗时 |')
  L.push('|---|---|---|---|')
  for (let i = 0; i < results.length; i++) {
    const r = results[i]
    L.push('| ' + r.src.name + ' | ' + (r.ok ? '可访问' : '失败：' + r.err) + ' | ' + r.items.length + ' | ' + r.ms + 'ms |')
  }
  L.push('')
  L.push('## 三、全部候选（按相关度排序，共 ' + all.length + ' 条）')
  L.push('')
  for (let i = 0; i < all.length && i < 300; i++) {
    const it = all[i]
    const dl = it.deadline ? (' · 原文截止 ' + it.deadline) : ''
    L.push((i + 1) + '. **' + it.title + '**')
    L.push('   - ' + (it.org || it.sourceName) + ' · 发布日 ' + it.publishedAt + dl + ' · 相关度 ' + it._score)
    L.push('   - ' + it.sourceUrl)
  }
  if (all.length > 300) {
    L.push('')
    L.push('（还有 ' + (all.length - 300) + ' 条见 crawl_candidates.json）')
  }
  fs.writeFileSync(path.join(ROOT, 'data/crawl_report.md'), L.join('\n'))

  console.log('')
  console.log('=== 汇总 ===')
  console.log('可访问源 ' + okList.length + ' / ' + nSrc + '，失败 ' + failList.length)
  console.log('候选条目（去重后）' + all.length + ' 条，其中摘到截止日 ' + dated.length + ' 条')
  console.log('详情页成功 ' + dOk.length + ' / ' + detailTargets.length)
  console.log('耗时 ' + Math.round((Date.now() - t0) / 1000) + ' 秒')
  console.log('已写入 data/crawl_candidates.json 与 data/crawl_report.md')
}

main().catch(function (e) {
  console.error('脚本异常:', e && e.stack || e)
  process.exit(1)
})
