// classify.js
// 规则引擎：判断抓到的通知属于哪一类、面向哪些学科、适用地区，
// 以及是否与目标用户（人居四学科高校教师）相关。

const TYPES = ['competition', 'special', 'conference', 'talent', 'award', 'project']

// 顺序即优先级：一个标题命中多类时取更靠前的
const TYPE_RULES = [
  {
    key: 'competition',
    re: /(竞赛|大赛|挑战杯|创新创业赛|设计竞赛|学年奖|设计奖|作品征集|参赛作品|赛区|杯赛|选拔赛|园冶杯|霍普杯)/
  },
  {
    key: 'special',
    re: /(专刊|特刊|专辑|专栏|special\s*issue|call\s*for\s*papers|论文征稿|征稿启事|组稿)/
  },
  {
    key: 'conference',
    re: /(学术会议|研讨会|论坛|年会|峰会|学术年会|会议通知|会议征文|征文通知|workshop|symposium|conference)/
  },
  {
    key: 'talent',
    re: /(人才|杰青|杰出入才|优秀青年|优青|长江学者|青年拔尖|拔尖人才|人才计划|托举|领军人才|创新人才|博士后|引进人才|万人计划|科学家工作室)/
  },
  {
    key: 'award',
    re: /(奖励|奖项|奖评选|表彰|评奖|获奖|科技进步奖|自然科学奖|优秀成果奖|设计奖评选|评选活动)/
  }
]

// 命中不了就归到 project（申报类大盘）
const PROJECT_RE = /(项目|课题|基金|计划|专项|申报|立项|资助|征集|招标课题|研究计划)/

// 明显与「申报机会」无关的：招聘、招生、采购、结果公示、行政事务
const EXCLUDE_RE = /(招聘|招录|招生|录取|考试|成绩查询|采购|招标公告|中标|成交公告|单一来源|询价|竞争性磋商|废标|流标|任免|干部|讣告|放假|值班|停水|停电|搬迁|维修改造|遴选结果|立项名单|资助名单|评审结果|公示名单|拟立项|拟资助|年检|年报|证书领取|领取通知|发票)/

// 强相关：出现这些词，即便没有「申报」也值得收录
const RELEVANT_RE = /(申报|征集|征稿|投稿|报名|申请|评选|推荐|遴选|立项|资助|会议|论坛|研讨|竞赛|大赛|特刊|专刊|征文)/

// 四学科 + 交叉方向
const DISCIPLINE_RULES = [
  { key: '城乡规划', re: /(城乡规划|城市规划|国土空间|规划学|城市设计|村庄规划|控制性详细规划|城市更新|城镇化|空间规划)/ },
  { key: '建筑', re: /(建筑学|建筑设计|建筑环境|建筑技术|建筑历史|建筑业|建筑师|建造|绿色建筑|建筑节能|既有建筑)/ },
  { key: '风景园林', re: /(风景园林|园林|景观|绿地|公园|园艺|植物配置|landscape)/i },
  { key: '环境设计', re: /(环境设计|室内设计|艺术设计|设计学|公共艺术|展示设计|工业设计)/ },
  { key: '城市气候', re: /(城市气候|微气候|热环境|热岛|城市通风|风环境|热舒适|碳中和|碳排放|气候适应|降温|温湿|气象)/ },
  { key: '环境健康', re: /(环境健康|健康影响|公共卫生|空气污染|PM2\.5|空气质量|暴露|流行病|健康风险|人居环境健康)/ }
]

const REGION_RULES = [
  { key: '陕西省', re: /(陕西|西安|关中|陕北|陕南)/ },
  { key: '国家', re: /(国家|全国|中国|教育部|科技部|住房和城乡建设部|住建部|自然科学基金|社会科学基金|中国科协|学会)/ }
]

function typeOf (title, org) {
  const t = (title || '') + ' ' + (org || '')
  for (let i = 0; i < TYPE_RULES.length; i++) {
    if (TYPE_RULES[i].re.test(t)) return TYPE_RULES[i].key
  }
  if (PROJECT_RE.test(t)) return 'project'
  return ''
}

function disciplinesOf (text) {
  const t = text || ''
  const out = []
  DISCIPLINE_RULES.forEach(function (r) {
    if (r.re.test(t)) out.push(r.key)
  })
  return out
}

function regionOf (org, url) {
  const t = (org || '') + ' ' + (url || '')
  for (let i = 0; i < REGION_RULES.length; i++) {
    if (REGION_RULES[i].re.test(t)) return REGION_RULES[i].key
  }
  if (/\.gov\.cn|\.edu\.cn|\.org\.cn/.test(url || '')) return '其他'
  return '其他'
}

/**
 * 是否收录这条
 * @returns {{keep:boolean, reason:string, type:string}}
 */
function judge (item, sourceDisc) {
  const title = item.title || ''
  if (!title) return { keep: false, reason: 'empty-title', type: '' }
  if (EXCLUDE_RE.test(title)) return { keep: false, reason: 'excluded', type: '' }
  if (!RELEVANT_RE.test(title)) return { keep: false, reason: 'irrelevant', type: '' }
  const type = typeOf(title, item.org)
  if (!type) return { keep: false, reason: 'no-type', type: '' }

  // 学科：标题里没写学科词，就继承来源配置的学科（比如建筑学会的源默认建筑）
  const disc = disciplinesOf(title)
  const finalDisc = disc.length ? disc : (sourceDisc || [])

  return { keep: true, reason: 'ok', type: type, disciplines: finalDisc }
}

function daysBetween (a, b) {
  const t1 = Date.parse(a + 'T00:00:00Z')
  const t2 = Date.parse(b + 'T00:00:00Z')
  if (isNaN(t1) || isNaN(t2)) return null
  return Math.round((t2 - t1) / 86400000)
}

function todayStr () {
  const d = new Date(Date.now() + 8 * 3600 * 1000) // 云函数是 UTC，转北京时间
  const p = function (n) { return n < 10 ? '0' + n : '' + n }
  return d.getUTCFullYear() + '-' + p(d.getUTCMonth() + 1) + '-' + p(d.getUTCDate())
}

module.exports = {
  TYPES: TYPES,
  typeOf: typeOf,
  disciplinesOf: disciplinesOf,
  regionOf: regionOf,
  judge: judge,
  daysBetween: daysBetween,
  todayStr: todayStr
}
