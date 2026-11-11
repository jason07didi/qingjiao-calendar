// 数据源配置。每个源只配「列表页地址 + 默认元数据」。
// spider 用通用启发式解析列表页（提取 <a> 标题/链接 + 附近日期），
// 所以无需为每个站点写专门解析器；部署后若某源解析不干净，可单独加白名单。
// ⚠️ 政府站点反爬/改版/TLS 风险真实存在：被墙或解析失败的源会被跳过并记录到 crawl_logs，
//    不会破坏已上线的云端数据。请部署后在云开发日志里逐个核对。
//
// 2026-11-11 扩源：原来只有 7 个国家级/陕西省级源，青年教师最关心的
// 「陕西省教育厅、人社厅（职称/博士后）、国家自然科学基金委」全都不在表里，
// 导致首页只能靠人工录入的条目撑日期。现在把仓库里一直闲置的
// sources.seed.json（38 个源）接进每日抓取，并补 3 个手工源。
//
// 字段说明：
//   priority 1 = 核心（陕西 + 国家部委/基金委/学会），2 = 其他省份
//   detailLimit 每个源最多抓几条详情页去找截止日（0 = 不抓详情）
//   insecure  该站证书链不全，抓取时放开证书校验（仅限确有必要的老政府站）
const path = require('path')

function shortRegion (r) {
  return String(r || '')
    .replace(/(壮族|回族|维吾尔)?自治区$/, '')
    .replace(/特别行政区$/, '')
    .replace(/省$/, '')
    .replace(/市$/, '')
}

const CITY = /^(西安|宝鸡|咸阳|渭南|延安|汉中|榆林|安康|商洛|铜川)$/

function levelOf (region) {
  const r = shortRegion(region)
  if (r === '国家' || r === '' || r === '全国') return 'national'
  if (CITY.test(r)) return 'city'
  return 'province'
}

// 稳定 id：同一 URL 永远得到同一个 id，避免每天抓取后 id 漂移
function slugOf (url) {
  try {
    const u = new URL(url)
    const host = u.hostname.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '_')
    const p = u.pathname.replace(/^\/+|\/+$/g, '').replace(/[^a-z0-9]+/gi, '_').slice(0, 28)
    return ('sd_' + host + (p ? '_' + p : '')).toLowerCase()
  } catch (e) {
    return 'sd_' + String(url).replace(/[^a-z0-9]+/gi, '').slice(0, 16).toLowerCase()
  }
}

function dedupeKey (url) {
  try {
    const u = new URL(url)
    return (u.hostname.replace(/^www\./, '') + u.pathname.replace(/\/+$/, '')).toLowerCase()
  } catch (e) { return String(url).toLowerCase() }
}

// ---------- 1. 手工维护的核心源（原来那 7 个，做了少量修正）----------
const BASE = [
  {
    id: 'mnr', name: '自然资源部', org: '自然资源部', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 4,
    disciplines: ['城乡规划', '环境科学', '生态学', '遥感', '地理学', '风景园林'],
    listUrl: 'https://www.mnr.gov.cn/gk/tzgg/', base: 'https://www.mnr.gov.cn'
  },
  {
    id: 'mohurd', name: '住房和城乡建设部', org: '住房和城乡建设部', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 4,
    disciplines: ['城乡规划', '建筑', '风景园林', '土木', '结构工程'],
    // 2026-11-03 实测：/wjfb/ 已 404；/zhengcefabu/ 与 /gongkai/.../bzgg/ 都是 JS 空壳（仅 6KB，列表靠 layui 动态渲染），
    // 静态抓取拿不到。改为抓首页，再用 excludeUrl 把 /xinwen/ 下的新闻稿剔掉（首页 38 条里大半是建设要闻/地方动态）。
    listUrl: 'https://www.mohurd.gov.cn/', base: 'https://www.mohurd.gov.cn',
    excludeUrl: /\/xinwen\//
  },
  {
    id: 'most', name: '科技部', org: '科技部', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 4,
    disciplines: ['环境科学', '遥感', '生态学', '社会科学'],
    listUrl: 'https://www.most.gov.cn/kjbgz/', base: 'https://www.most.gov.cn'
  },
  {
    id: 'mee', name: '生态环境部', org: '生态环境部', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 4,
    disciplines: ['环境科学', '生态学', '大气科学', '环境健康'],
    // 2026-11-03 实测：/xxgk2018/xxgk/ 返回空响应；/ywdt/gsgg/ 能抓但混满「建设项目环评审批公示」这类行政审批噪音，
    // 改抓「部文件」栏目（政策/通知为主），信号密度高得多。
    listUrl: 'https://www.mee.gov.cn/zcwj/bwj/', base: 'https://www.mee.gov.cn'
  },
  {
    id: 'cast', name: '中国科协（青年人才托举）', org: '中国科协', region: '国家', level: 'national',
    type: 'talent', priority: 1, detailLimit: 3,
    disciplines: ['城乡规划', '建筑', '环境科学', '社会科学'],
    listUrl: 'https://www.cast.org.cn/', base: 'https://www.cast.org.cn'
  },
  {
    id: 'sxkj', name: '陕西省科学技术厅', org: '陕西省科学技术厅', region: '陕西', level: 'province',
    type: 'project', priority: 1, detailLimit: 6,
    disciplines: ['城乡规划', '建筑', '环境科学', '遥感', '生态学'],
    // 2026-11-11：原来抓首页（混着大量科技动态新闻），改抓「通知公告」栏目
    listUrl: 'https://kjt.shaanxi.gov.cn/kjdt/tzgg/', base: 'https://kjt.shaanxi.gov.cn'
  },
  {
    id: 'sxzr', name: '陕西省自然资源厅', org: '陕西省自然资源厅', region: '陕西', level: 'province',
    type: 'project', priority: 1, detailLimit: 3,
    disciplines: ['城乡规划', '遥感', '地理学', '风景园林'],
    listUrl: 'https://zrzyt.shaanxi.gov.cn/', base: 'https://zrzyt.shaanxi.gov.cn'
  }
]

// ---------- 2. 手工补的 3 个源（seed 里没有，但对青年教师最关键）----------
const MANUAL_EXTRA = [
  {
    id: 'sxrst', name: '陕西省人社厅（职称/博士后）', org: '陕西省人力资源和社会保障厅', region: '陕西', level: 'province',
    type: 'talent', priority: 1, detailLimit: 5,
    disciplines: ['城乡规划', '建筑', '环境科学', '社会科学'],
    // 2026-11-11 实测：rst.shaanxi.gov.cn（不是 hrss）http/https 都通，栏目 /sy/tzgg/ 164 个链接
    listUrl: 'https://rst.shaanxi.gov.cn/sy/tzgg/', base: 'https://rst.shaanxi.gov.cn'
  },
  {
    id: 'nsfc_tz', name: '国家自然科学基金委（通知通告）', org: '国家自然科学基金委员会', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 6,
    disciplines: ['城乡规划', '建筑', '环境科学', '生态学', '遥感', '地理学'],
    // 2026-11-11 实测：新版站点栏目为 /p1/3381/2822/tzsm1.html（业务资讯），证书链不全需 insecure
    listUrl: 'https://www.nsfc.gov.cn/p1/3381/2822/tzsm1.html', base: 'https://www.nsfc.gov.cn',
    insecure: true
  },
  {
    id: 'nsfc_zn', name: '国家自然科学基金委（项目指南）', org: '国家自然科学基金委员会', region: '国家', level: 'national',
    type: 'project', priority: 1, detailLimit: 4,
    disciplines: ['城乡规划', '建筑', '环境科学', '生态学', '遥感', '地理学'],
    listUrl: 'https://www.nsfc.gov.cn/p1/3381/2824/zntg.html', base: 'https://www.nsfc.gov.cn',
    insecure: true
  }
]

// ---------- 3. 把闲置的 seed 源表接进来 ----------
function seedSources () {
  let seed = []
  try {
    seed = require(path.join(__dirname, 'sources.seed.json'))
  } catch (e) { return [] }
  if (!Array.isArray(seed)) seed = (seed && seed.sources) || []

  return seed
    .filter(function (s) { return s && s.url && s.enabled !== false })
    .map(function (s) {
      const region = shortRegion(s.region)
      return {
        id: slugOf(s.url),
        name: s.name || s.org || '未命名源',
        org: s.org || s.name || '',
        region: region,
        level: levelOf(s.region),
        type: s.defaultType || 'project',
        priority: region === '国家' || region === '陕西' || region === '西安' ? 1 : 2,
        detailLimit: typeof s.detailLimit === 'number' ? s.detailLimit : 3,
        disciplines: s.disciplines || [],
        listUrl: s.url,
        base: (function () { try { return new URL(s.url).origin } catch (e) { return s.url } })(),
        insecure: /nsfc\.gov\.cn|xakj\.xa\.gov\.cn/.test(s.url) || !!s.insecure,
        note: s.note || ''
      }
    })
}

function mergeSources () {
  const out = []
  const seenId = {}
  const seenUrl = {}
  const push = function (s) {
    if (!s || !s.listUrl) return
    const k = dedupeKey(s.listUrl)
    if (seenUrl[k] || seenId[s.id]) return
    seenUrl[k] = true
    seenId[s.id] = true
    out.push(s)
  }
  BASE.forEach(push)
  MANUAL_EXTRA.forEach(push)
  seedSources().forEach(push)
  // 核心源排前面：抓取预算和详情预算都按这个顺序分配，
  // 保证「网络变慢/超时」时先保住陕西和国家部委，而不是先抓外省科技厅。
  out.sort(function (a, b) {
    const pa = a.priority || 2
    const pb = b.priority || 2
    if (pa !== pb) return pa - pb
    return 0
  })
  return out
}

module.exports.SOURCES = mergeSources()

// 标题里出现这些词才视为「可能相关的通知」，过滤掉导航/页脚链接
module.exports.TRUST_KEYWORDS = [
  '通知', '公告', '通告', '申报', '征集', '招标', '基金', '项目', '计划', '截止',
  '评选', '奖励', '奖', '论坛', '会议', '培训', '招募', '开放', '资助', '课题',
  '职称', '博士后', '人才', '遴选', '指南', '评审'
]
