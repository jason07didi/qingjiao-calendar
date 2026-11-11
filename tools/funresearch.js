// tools/funresearch.js
// 泛研网（funresearch.cn）申报信息采集器。
//
// 为什么接它：本地 7 个官方源抓到的条目只有「发布日」，没有截止日（铁律不许编），
// 导致首页/日历有日期的提醒只覆盖最近一个月。
// 泛研网的申报信息库列表页自带「发布日期 + 截止日期 + 申报中/已截止」结构化字段，
// 是目前唯一免费可拿的带真实截止日的聚合源。
//
// 免费额度：/grant/index、/award/index、/expert/index 三个列表页各返回最新 20 条，
// 免登录可看；翻页与 POST 检索需要黄金版付费授权（2026-11-11 实测），所以每次运行
// 每栏最多 20 条。对每 4 小时跑一次的定时任务足够覆盖增量。
//
// 数据可信度：截止日来自泛研网对官方通知的收录（非编造），来源写「泛研网」，
// sourceUrl 指向泛研详情页（免登录可看摘要与日期；官方原文链接需登录）。
// 运行：node tools/funresearch.js
// 输出：data/fr_candidates.json（结构与 crawl_candidates.json 一致，deadline 有值）

const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const { fetchText } = require(path.join(ROOT, 'cloudfunctions/spider/fetch.js'))

// 泛研详情页路径 → 小程序类型映射
function typeFromPath (href) {
  if (href.indexOf('/grant/') > -1) return 'project'
  if (href.indexOf('/award/') > -1) return 'award'
  if (href.indexOf('/contest/') > -1) return 'competition'
  if (href.indexOf('/expert/') > -1) return 'talent'
  return 'project'
}

// 省份/城市名归一：与 utils/notices.js 的 PROVINCES 对齐
const PROVINCES = ['国家', '陕西省', '西安市', '咸阳市', '江苏省', '福建省', '山东省',
  '云南省', '河南省', '安徽省', '河北省', '辽宁省', '湖南省', '四川省', '湖北省',
  '贵州省', '北京市', '上海市', '广东省', '吉林省', '内蒙古', '宁夏', '新疆', '西藏',
  '浙江省', '江西省', '天津市', '重庆市', '广西', '甘肃省']

function mapRegion (scope) {
  const seg = String(scope || '').split(/[；;]/).map(function (s) { return s.trim() }).filter(Boolean)
  if (!seg.length || seg[0] === '全国') return { region: '国家', level: '国家级' }
  const s0 = seg[0]
  for (let i = 0; i < PROVINCES.length; i++) {
    if (s0 === PROVINCES[i]) return { region: s0, level: '省级' }
  }
  // 省份写法没带「省」或自治区全称：归一后比对
  const bare = s0.replace(/(省|特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区)$/, '')
  for (let i = 0; i < PROVINCES.length; i++) {
    const p = PROVINCES[i].replace(/省$/, '')
    if (bare === p) return { region: PROVINCES[i], level: '省级' }
  }
  // 直辖市别名
  if (/^北京|重庆|上海|天津/.test(s0) && s0.length <= 4) return { region: s0 + '市', level: '省级' }
  // 市级（烟台市/宁波市…）
  if (/市$/.test(s0)) return { region: s0, level: '厅局级' }
  return { region: s0, level: '省级' }
}

// 从一页列表 HTML 里抽结构化行
function parseRows (html, colUrl) {
  const rows = html.split('<article class=fun-table-row>').slice(1)
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const seg = rows[i].split('</article>')[0]
    // 状态：[申报中] 保留，[已截止] 跳过
    if (seg.indexOf('[已截止]') > -1) continue
    if (seg.indexOf('[申报中]') === -1) continue
    const mt = seg.match(/<h6[^>]*>[\s\S]*?<a[^>]*href=\/(grant|award|contest|expert|project)\/([A-Za-z0-9_-]+)[^>]*>([\s\S]*?)<\/a>/)
    if (!mt) continue
    const title = mt[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
    if (!title || title.length < 6) continue
    const dates = []
    const dtRe = /<time datetime=(\d{4}-\d{2}-\d{2})>/g
    let dm
    while ((dm = dtRe.exec(seg)) !== null) dates.push(dm[1])
    const publishedAt = dates[0] || ''
    const deadline = dates[1] || ''
    const orgM = seg.match(/<\/h6><div class=fun-table-cell>([^<]{2,60})<\/div>/)
    const org = orgM ? orgM[1].trim() : ''
    const reg = mapRegion((seg.match(/<\/div><div class=fun-table-cell>([^<]{1,20})<\/div><div class=fun-table-cell><time/) || [])[1])
    const detailUrl = 'https://www.funresearch.cn/' + mt[1] + '/' + mt[2]
    out.push({
      type: typeFromPath(mt[1] + '/'),
      title: title,
      org: org || (reg.region === '国家' ? '泛研网收录' : org),
      region: reg.region,
      level: reg.level,
      disciplines: [],          // 跨学科聚合条目：留空 = 不限学科（filter.js 对空学科放行）
      deadline: deadline,
      deadlineText: deadline
        ? ('官方通知：发布 ' + publishedAt + '，截止 ' + deadline + '（泛研网收录，原文以官方为准）')
        : ('通知发布日 ' + publishedAt + '（截止日待核实）'),
      deadlineEstimated: false,
      publishedAt: publishedAt,
      sourceUrl: detailUrl,
      sourceName: '泛研网',
      source: 'crawl',
      status: 'raw',
      createdAt: Date.now(),
      _col: colUrl
    })
  }
  return out
}

const COLUMNS = [
  { url: 'https://www.funresearch.cn/grant/index', name: '科研项目申报' },
  { url: 'https://www.funresearch.cn/award/index', name: '奖项竞赛申报' },
  { url: 'https://www.funresearch.cn/expert/index', name: '人才专家申报' }
]

async function main () {
  const all = []
  const seen = {}
  let fail = 0
  for (let i = 0; i < COLUMNS.length; i++) {
    const c = COLUMNS[i]
    process.stdout.write('[' + (i + 1) + '/' + COLUMNS.length + '] ' + c.name + ' ... ')
    try {
      const html = await fetchText(c.url, { timeout: 15000 })
      const rows = parseRows(html, c.url)
      console.log('OK  ' + rows.length + ' 条申报中')
      rows.forEach(function (r) {
        if (seen[r.sourceUrl]) return
        seen[r.sourceUrl] = true
        all.push(r)
      })
    } catch (e) {
      fail++
      console.log('FAIL  ' + ((e && e.message) || e))
    }
  }

  // 只留截止日在今天及以后的（列表页可能混着刚过期的申报中）
  const today = new Date()
  const stamp = today.getFullYear() + '-' + String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0')
  const live = all.filter(function (r) { return !r.deadline || r.deadline >= stamp })

  const outPath = path.join(ROOT, 'data', 'fr_candidates.json')
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify({ updatedAt: stamp, items: live }, null, 2), 'utf8')
  console.log('—'.repeat(50))
  console.log('抓到(申报中):', all.length, ' | 截止日已过的剔除:', all.length - live.length)
  console.log('写入:', path.relative(ROOT, outPath), '(', live.length, '条 )')
  if (fail) console.log('⚠️ ' + fail + ' 个栏目抓取失败，已跳过')
}

main().catch(function (e) {
  console.error('funresearch 全部失败:', (e && e.message) || e)
  process.exit(0)  // 不让主流程挂掉：官方源照常跑
})
