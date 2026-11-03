// utils/notices.js
// 说明：以下为演示数据，字段结构按真实通知拆分（申报信息 / 基本条件 / 相关文件）。
// 具体日期与额度请以官方通知原文为准。

// 类目体系（首页筛选 chip 由此自动生成）。
// 前六类是「要交材料的事」，position 是生涯规划里最容易被漏掉的一块（青年编委/审稿人/专委会/客座编辑）。
// 后半段是 2026-11-01 补录的「青椒每天还得盯、竞品普遍不做」的板块：
//   标准(standard) 含标准规范征求意见 + 科研政策征求意见；
//   资质(license) 行业执业资格考证；博士后(postdoc) / 访学(visit) / 职称评审(review) / 研究生(student) 是职业全周期。
const TYPES = [
  { key: 'project', name: '项目', color: '#123B5B' },
  { key: 'talent', name: '人才', color: '#6B4E9B' },
  { key: 'award', name: '奖项', color: '#A8791B' },
  { key: 'conference', name: '会议', color: '#1D7A5F' },
  { key: 'special', name: '特刊', color: '#2E6FA8' },
  { key: 'competition', name: '竞赛', color: '#B4551F', secondary: true },
  { key: 'position', name: '学术岗', color: '#8A5A2B', secondary: true },
  { key: 'growth', name: '成长', color: '#5FA02C', secondary: true },
  { key: 'standard', name: '标准', color: '#C0392B', secondary: true },
  { key: 'license', name: '资质', color: '#8E44AD', secondary: true },
  { key: 'postdoc', name: '博士后', color: '#16A085', secondary: true },
  { key: 'visit', name: '访学', color: '#2980B9', secondary: true },
  { key: 'review', name: '评审', color: '#D35400', secondary: true },
  { key: 'student',     name: '研究生', color: '#27AE60' , secondary: true}
]

// 城市气候与环境健康不是一个学科，是一条交叉带：
// 城乡规划/建筑/风景园林/环境设计出「空间」，环境科学/大气科学/生态学出「机理」，
// 地理学出「尺度」，设计学出「表达与人」。少哪一条都做不深。
const DISCIPLINES = [
  '城乡规划', '建筑', '风景园林', '环境设计', '土木', '结构工程', '城市气候', '环境健康', '环境科学', '大气科学', '地理学', '生态学', '设计学', '遥感', '建筑学', '艺术学', '社会科学'
]

// 本地数据的「最后整理日期」：每次批量加/改数据就手动更新这里，
// 让本地模式下也能给用户一个诚实的时间参照（不是爬取时间，是人工整理时间）。
const DATA_UPDATED_AT = '2026年11月3日'

// 地区选项：与爬虫源 region 对应，新省接入后在此补充。
// 20 个省级科技厅源为 2026-11-01 实测结果（8 个新开通，4 个被 WAF 拦的先占位关闭）。
const PROVINCES = [
  '国家', '陕西省', '西安市', '咸阳市',
  '江苏省', '福建省', '山东省', '云南省', '河南省', '安徽省',
  '河北省', '辽宁省', '湖南省', '四川省', '湖北省', '贵州省',
  '北京市', '上海市', '广东省', '吉林省', '内蒙古', '宁夏', '新疆', '西藏',
  '浙江省', '江西省', '天津市', '重庆市', '广西', '甘肃省'
]

const NOTICES = [
  {
    id: 1, type: 'project',
    title: '2027年度国家自然科学基金项目申请',
    org: '国家自然科学基金委员会', region: '国家',
    disciplines: ['城乡规划', '建筑', '城市气候', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 3 月 · 预估）',
    info: {
      amount: '面上项目约 50 万元/项，青年项目 30 万元/项',
      target: '依托单位在编科学技术人员',
      quota: '同年只能申请 1 项面上项目；同年申请和参与申请合计不超过 2 项',
      channel: '科学基金网络信息系统 isisn.nsfc.gov.cn'
    },
    conditions: [
      '具有高级专业技术职务（职称）或博士学位',
      '青年项目：男性未满 35 周岁，女性未满 40 周岁',
      '依托单位须为基金委注册单位，须有校内预申报审核环节'
    ],
    files: [
      { name: '2027年度项目指南.pdf' },
      { name: '申请书正文撰写提纲.docx' },
      { name: '依托单位承诺函模板.docx' }
    ],
    summary: '面上、青年、地区三类项目同时开放，建筑与城市研究方向建议报 E08 建筑环境或 D01 城市地理。',
    curated: '校内一般会提前 3 周组织预申报评审，实际提交节点比官方截止早 10 天左右，别只盯官方日期。',
    sourceUrl: 'https://www.nsfc.gov.cn'
  },
  {
    id: 2, type: 'project',
    title: '2027年度国家社会科学基金年度项目',
    org: '全国哲学社会科学工作办公室', region: '国家',
    disciplines: ['城乡规划', '建筑', '风景园林'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 2 月 · 预估）',
    info: {
      amount: '重点项目 35 万元，一般项目 20 万元，青年项目 20 万元',
      target: '高校、党校、社科院等具备独立法人资格的单位',
      quota: '申请人同年度只能申报 1 项，且不能作为课题组成员参与他人申报',
      channel: '国家社科基金科研创新服务管理平台'
    },
    conditions: [
      '重点项目申请人须具有副高级以上职称',
      '青年项目申请人年龄不超过 35 周岁',
      '课题组成员须征得本人同意并签字'
    ],
    files: [
      { name: '课题指南.pdf' },
      { name: '申请书.doc' },
      { name: '活页.doc' }
    ],
    summary: '城乡规划与人居环境方向可报「应用经济」「社会学」或「交叉学科」学科分类。',
    curated: '活页必须匿名，正文里出现学校名、作者名会直接形式审查不通过，这是每年最常见的低级失误。',
    sourceUrl: 'http://www.nopss.gov.cn'
  },
  {
    id: 3, type: 'project',
    title: '2027年度陕西省科技发展计划项目征集（含自然科学基础研究计划）',
    org: '陕西省科学技术厅', region: '陕西省',
    disciplines: ['城市气候', '环境健康', '建筑'],
    startAt: '2026-08-27', deadline: '2026-10-15', deadlineText: '2026年10月15日 17:00 部门推荐截止（已截止）',
    deadlineEstimated: false, freq: '每年约 8 月发征集通知、10 月截止（陕科发〔2026〕9号：2026-08-26 发布）',
    info: {
      amount: '自然科学基础研究计划、软科学、秦创原「科学家+工程师」、科技创新团队等实行经费包干制；各计划额度详见对应申报指南',
      target: '省内独立法人高校、科研院所、企事业单位（单位注册须在 2025-08-25 前）',
      quota: '同一负责人本年度限报 1 项；在研负责人不得报非人才类',
      channel: '陕西省科技业务综合服务信息系统（ywgl.sstrc.com）'
    },
    conditions: [
      '项目负责人 60 周岁以下，须为申报单位在职人员',
      '副高以上职称须先完成系统专家注册',
      '禁止多头申报、重复申报'
    ],
    files: [
      { name: '附件1·重点研发计划申报指南.doc' },
      { name: '附件2·自然科学基础研究计划申报指南.doc' },
      { name: '附件3·技术创新引导计划申报指南.doc' },
      { name: '附件4·创新能力支撑计划申报指南.doc' }
    ],
    summary: '本通知一次性征集四类计划：重点研发（含社会发展领域）、自然科学基础研究（青年A/B/C、前沿探索、面上、实验室重点）、技术创新引导（秦创原「科学家+工程师」）、创新能力支撑（含青年科技新星、软科学）。2027 年度批次已截止。',
    curated: '这一条是省科技厅的「总入口」：基础研究、重点研发、青年新星全在里面，每年 8 月底发通知、10 月中截止，错过就等下一年。别把截止日记成年底——10 月 10 日单位申报就关系统了。',
    sourceUrl: 'https://kjt.shaanxi.gov.cn/kjdt/tzgg/202608/t20260826_3670177.html'
  },
  {
    id: 4, type: 'project',
    title: '2027年度陕西省重点研发计划（社会发展领域）',
    org: '陕西省科学技术厅', region: '陕西省',
    disciplines: ['城乡规划', '环境健康', '城市气候'],
    startAt: '2026-08-27', deadline: '2026-10-15', deadlineText: '2026年10月15日 17:00（已截止，属2027年度省科技发展计划征集）',
    deadlineEstimated: false, freq: '随年度省科技发展计划项目征集一并发布，约每年 8–10 月',
    info: {
      amount: '额度详见年度重点研发计划申报指南',
      target: '省内企事业单位、高校院所',
      quota: '同一负责人本年度限报 1 项（含各类计划合计）',
      channel: '陕西省科技业务综合服务信息系统（ywgl.sstrc.com）'
    },
    conditions: [
      '须对应指南内具体方向，社会发展领域含生态环境保护与碳达峰碳中和、绿色建筑、公共安全与社会事业等',
      '可行性研究报告中不得出现负责人及成员姓名、单位名称（匿名「*」代替），否则形式审查不通过',
      '一般项目以落地应用为导向'
    ],
    files: [
      { name: '2027年度重点研发计划申报指南.doc' }
    ],
    summary: '2027 年度批次已随《征集2027年度陕西省科技发展计划项目的通知》截止（2026-10-15）。社会发展领域含生态环境保护、绿色建筑方向，下一批预计 2027 年 8–9 月发布（2028 年度）。',
    curated: '重点研发不是纯学术评审，评「能不能落地」：有设计院、住建局、环保企业合作方的方案命中率高。指南发布后逐条对关键词，别拿去年的本子改标题。',
    sourceUrl: 'https://kjt.shaanxi.gov.cn/kjdt/tzgg/202608/t20260826_3670177.html'
  },
  {
    id: 5, type: 'project',
    title: '2027年度陕西省教育厅科学研究计划项目',
    org: '陕西省教育厅', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '风景园林', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估）',
    info: {
      amount: '专项科研计划 2 万元/项，重点项目 5 万元/项',
      target: '省属高等学校',
      quota: '每校限额推荐，具体名额由学校分配',
      channel: '陕西省教育厅科研管理平台（校内先评审）'
    },
    conditions: [
      '项目负责人须为高校在职教师，年龄一般不超过 45 周岁',
      '已承担教育厅项目未结题者不得申报',
      '须由学校科研处统一推荐，不接受个人报送'
    ],
    files: [
      { name: '申报通知.pdf' },
      { name: '申请书.doc' },
      { name: '校内推荐排序表.xlsx' }
    ],
    summary: '省属高校教师最容易拿到的省级项目，适合作为后续申报国家级项目的前期基础。',
    curated: '关键在校内排序，不是省厅卡人。想拿到名额，最好提前跟学院科研秘书确认本院排序规则。',
    sourceUrl: 'https://jyt.shaanxi.gov.cn'
  },
  {
    id: 6, type: 'project',
    title: '2027年度西安市科技计划（软科学研究）',
    org: '西安市科学技术局', region: '西安市',
    disciplines: ['城乡规划', '城市气候', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '5–15 万元/项',
      target: '西安市行政区域内注册的独立法人单位',
      quota: '同一申报单位同一领域限报 2 项',
      channel: '西安市科技计划项目管理系统'
    },
    conditions: [
      '研究内容须围绕西安市实际需求，具备决策参考价值',
      '需提供与政府部门或实际应用单位的合作意向',
      '项目周期不超过 1 年'
    ],
    files: [
      { name: '软科学申报指南.pdf' },
      { name: '项目申报书.docx' }
    ],
    summary: '偏政策研究，城市体检、热岛治理、社区健康环境类选题命中率高。',
    curated: '软科学评审很看「给谁用」。有市住建局、资源规划局的实际需求函，通过率会明显高一截。',
    sourceUrl: 'http://xakj.xa.gov.cn'
  },
  {
    id: 7, type: 'project',
    title: '2027年度教育部人文社会科学研究一般项目',
    org: '教育部社会科学司', region: '国家',
    disciplines: ['城乡规划', '建筑', '风景园林', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 1 月 · 预估）',
    info: {
      amount: '规划基金 10 万元，青年基金 8 万元，自筹经费项目不限',
      target: '全国普通高等学校',
      quota: '申请者同年度只能申报 1 项，且不能作为课题组成员参与其他项目',
      channel: '教育部人文社会科学研究管理平台'
    },
    conditions: [
      '规划基金：具有高级职称',
      '青年基金：年龄不超过 40 周岁',
      '连续两年申报未立项者，第三年停报一年'
    ],
    files: [
      { name: '项目申报通知.pdf' },
      { name: '申请评审书.doc' }
    ],
    summary: '设计学、城乡规划学可归入「艺术学」或「交叉学科/综合研究」门类。',
    curated: '连续两年没中的会被停报一年，这是很多人不知道的规则，申报前先查自己的申报记录。',
    sourceUrl: 'http://www.moe.gov.cn'
  },
  {
    id: 8, type: 'project',
    title: '2027年度陕西省建设科技计划项目',
    org: '陕西省住房和城乡建设厅', region: '陕西省',
    disciplines: ['建筑', '城乡规划', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估，未核对到本年度通知）',
    deadlineEstimated: true, freq: '往年多在四季度发布，以住建厅官网通知为准',
    info: {
      amount: '10–30 万元/项',
      target: '省内建设行业企事业单位、高校',
      quota: '每家单位限报 3 项',
      channel: '陕西省住建厅科技项目管理系统'
    },
    conditions: [
      '选题须属于绿色建筑、建筑节能、城市更新等方向',
      '须有明确的工程应用依托项目',
      '需提供单位科研诚信承诺书'
    ],
    files: [
      { name: '建设科技项目申报指南.pdf' },
      { name: '立项申请书.docx' }
    ],
    summary: '建筑节能、既有建筑改造、绿色城区方向最契合，城市气候研究可挂「建筑环境」子方向。',
    curated: '住建厅项目周期短、钱不多，但对评职称的「横向到账」有帮助，性价比常被低估。',
    sourceUrl: 'https://js.shaanxi.gov.cn'
  },

  {
    id: 9, type: 'talent',
    title: '2027年度陕西省青年科技新星',
    org: '陕西省科学技术厅', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '城市气候', '环境健康'],
    startAt: '2026-08-27', deadline: '2026-10-15', deadlineText: '2026年10月15日 17:00（已截止，属2027年度省科技发展计划征集）',
    deadlineEstimated: false, freq: '随年度省科技发展计划征集一并申报（创新能力支撑计划内），约每年 8–10 月',
    info: {
      amount: '培养期 3 年，资助额度见年度创新能力支撑计划指南',
      target: '陕西省内高校、科研院所、企业青年科技人员',
      quota: '同一人只能获得一次；属人才类，在研项目负责人也可申报',
      channel: '陕西省科技业务综合服务信息系统（ywgl.sstrc.com）'
    },
    conditions: [
      '年龄不超过 35 周岁',
      '具有博士学位或中级以上职称',
      '近 5 年主持过省级以上科研项目或发表高水平论文'
    ],
    files: [
      { name: '2027年度创新能力支撑计划申报指南.doc' }
    ],
    summary: '省级青年人才称号，是后续申报省级人才计划和国家级人才项目的重要台阶。2027 年度批次已随省科技发展计划征集截止（2026-10-15），下一批预计 2027 年 8–9 月（2028 年度）。',
    curated: '注意节奏：它不单独发通知，藏在每年 8 月底的「科技发展计划征集」里，10 月中就截止——只盯「年底申报」的传闻会错过。省内评职称认可度高，值得提前一年准备业绩材料。',
    sourceUrl: 'https://kjt.shaanxi.gov.cn/kjdt/tzgg/202608/t20260826_3670177.html'
  },
  {
    id: 10, type: 'talent',
    title: '陕西高校青年杰出人才支持计划',
    org: '陕西省教育厅', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '风景园林', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '支持期 3 年，自然科学类 30 万元',
      target: '陕西省属高校在编教师',
      quota: '每校限额推荐 2–3 名',
      channel: '校内遴选后报省教育厅'
    },
    conditions: [
      '年龄一般不超过 40 周岁',
      '具有博士学位或副高以上职称',
      '近 5 年主持国家级项目或取得标志性成果'
    ],
    files: [
      { name: '实施办法.pdf' },
      { name: '申报书.docx' }
    ],
    summary: '面向省属高校的青年人才支持，侧重科研潜力和学科贡献。',
    curated: '校内名额少，通常要走学院推荐 + 校学术委员会评审两道，提前一个学期准备材料才来得及。',
    sourceUrl: 'https://jyt.shaanxi.gov.cn'
  },
  {
    id: 11, type: 'talent',
    title: '陕西省「三秦学者」岗位招聘与申报',
    org: '中共陕西省委组织部', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '风景园林', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '特聘教授岗位津贴 20 万元/年，团队配套经费另计',
      target: '省内外高层次人才',
      quota: '按岗位设置申报，一岗一人',
      channel: '陕西人才服务平台'
    },
    conditions: [
      '一般应具有正高级职称或海外知名高校终身教职',
      '年龄原则上不超过 55 周岁',
      '须全职到岗，聘期 5 年'
    ],
    files: [
      { name: '岗位设置方案.pdf' },
      { name: '候选人推荐表.docx' },
      { name: '聘期目标任务书.docx' }
    ],
    summary: '省级高层次人才计划，分特聘教授、讲座教授、青年学者三类岗位。',
    curated: '岗位是「按需设岗」，先看今年有没有你这个学科放出来的岗，没岗的话材料准备再漂亮也没用。',
    sourceUrl: 'https://www.sx-dj.gov.cn'
  },
  {
    id: 12, type: 'talent',
    title: '2027年度国家优秀青年科学基金项目',
    org: '国家自然科学基金委员会', region: '国家',
    disciplines: ['城市气候', '环境健康', '建筑'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 3 月 · 预估）',
    info: {
      amount: '资助强度 200 万元/项（3 年）',
      target: '具有高级职称或博士学位的科研人员',
      quota: '同年度只能申请 1 项，申请时不限项',
      channel: '科学基金网络信息系统'
    },
    conditions: [
      '男性未满 38 周岁，女性未满 40 周岁',
      '具有高级专业技术职务（职称）或博士学位',
      '需有依托单位推荐意见'
    ],
    files: [
      { name: '优青项目指南.pdf' },
      { name: '申请书提纲.docx' }
    ],
    summary: '国家级青年人才项目，城市气候与环境健康方向竞争激烈但窗口明确。',
    curated: '优青看重「代表作 + 独立研究方向的辨识度」，堆论文数量反而扣分，四篇代表作要能串成一条线。',
    sourceUrl: 'https://www.nsfc.gov.cn'
  },
  {
    id: 13, type: 'talent',
    title: '中国科协青年人才托举工程',
    org: '中国科学技术协会', region: '国家',
    disciplines: ['建筑', '城乡规划', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估）',
    info: {
      amount: '每人每年 10 万元，连续 3 年',
      target: '32 岁以下青年科技工作者',
      quota: '通过学会推荐，每个学会名额有限',
      channel: '所属全国学会推荐'
    },
    conditions: [
      '年龄不超过 32 周岁',
      '在高校、科研院所或企业从事一线科研工作',
      '须由全国学会或省级科协推荐'
    ],
    files: [
      { name: '托举工程实施办法.pdf' },
      { name: '被托举人推荐表.docx' }
    ],
    summary: '面向早期青年科技人才，建筑、规划类可通过中国建筑学会、中国城市规划学会推荐。',
    curated: '走学会渠道比走学校渠道成功率高，学会有名额但要提前跟学会秘书处打招呼。',
    sourceUrl: 'https://www.cast.org.cn'
  },

  {
    id: 14, type: 'award',
    title: '2026年度陕西省科学技术奖',
    org: '陕西省科学技术厅', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '城市气候', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '奖金：一等奖 20 万元，二等奖 10 万元，三等奖 5 万元',
      target: '在陕完成并应用的科技成果',
      quota: '同一完成人同年限报 1 项，同一成果不得重复申报',
      channel: '陕西省科技奖励管理系统'
    },
    conditions: [
      '成果须应用满 2 年以上（自然科学奖可适当放宽）',
      '完成人须提供知情同意与署名排序确认',
      '需第三方评价或成果登记证明'
    ],
    files: [
      { name: '提名工作通知.pdf' },
      { name: '提名书.docx' },
      { name: '应用证明模板.docx' }
    ],
    summary: '分自然科学奖、技术发明奖、科技进步奖三类，规划与建筑类成果多走科技进步奖。',
    curated: '省奖现在实行提名制，不是自己报，要找到有提名资格的单位或专家，这一步最容易被忽略。',
    sourceUrl: 'https://kjt.shaanxi.gov.cn'
  },
  {
    id: 15, type: 'award',
    title: '2026年度华夏建设科学技术奖',
    org: '中国建筑科学研究院', region: '国家',
    disciplines: ['建筑', '城乡规划', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估）',
    info: {
      amount: '不设奖金，设一等奖、二等奖、三等奖',
      target: '全国建设行业企事业单位、高校',
      quota: '同一单位限报 3 项',
      channel: '华夏奖申报系统（住建部指导）'
    },
    conditions: [
      '成果须在建设领域应用满 1 年以上',
      '需提供经济效益或社会效益证明',
      '完成单位不超过 5 家，完成人不超过 15 人'
    ],
    files: [
      { name: '申报通知.pdf' },
      { name: '申报书.docx' },
      { name: '成果摘要模板.docx' }
    ],
    summary: '建设行业国家级社会力量奖，建筑节能、绿色建筑、城市更新方向命中率高。',
    curated: '社会力量奖在部分高校职称文件里按省部级对待，但各校口径不同，报之前先查本校认可目录。',
    sourceUrl: 'https://www.cabr.com.cn'
  },
  {
    id: 16, type: 'award',
    title: '2026年度中国城市规划学会科技进步奖',
    org: '中国城市规划学会', region: '国家',
    disciplines: ['城乡规划', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 1 月 · 预估）',
    info: {
      amount: '设一等奖、二等奖、三等奖，颁发证书与奖牌',
      target: '从事城市规划科研、实践的单位与个人',
      quota: '同一申报人限报 2 项',
      channel: '中国城市规划学会奖励申报系统'
    },
    conditions: [
      '成果须完成并应用满 2 年',
      '规划编制类项目须提供批复文件',
      '需两名同行专家推荐'
    ],
    files: [
      { name: '奖励办法.pdf' },
      { name: '推荐书.docx' }
    ],
    summary: '规划学科内认可度最高的学会奖之一，规划编制、政策研究、技术方法类成果均可申报。',
    curated: '学会奖对「规划实践项目」更友好，纯理论文章建议走优秀论文奖而不是科技进步奖。',
    sourceUrl: 'https://www.planning.org.cn'
  },
  {
    id: 17, type: 'award',
    title: '2026年度中国建筑学会建筑创作奖',
    org: '中国建筑学会', region: '国家',
    disciplines: ['建筑', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '设金奖、银奖、入围奖',
      target: '建成项目的设计单位与主创建筑师',
      quota: '同一主创建筑师限报 2 项',
      channel: '中国建筑学会创作奖申报平台'
    },
    conditions: [
      '项目须已建成并投入使用',
      '须提供实景照片、图纸与业主证明',
      '主创建筑师须为项目实际负责人'
    ],
    files: [
      { name: '申报章程.pdf' },
      { name: '项目申报表.docx' },
      { name: '图纸与照片提交规范.pdf' }
    ],
    summary: '国内建筑创作领域最有分量的奖项之一，看重建成品质而非论文。',
    curated: '这个奖对设计院和高校双身份的人特别有用，但高校教师如果没有实际建成项目，建议转投论文奖。',
    sourceUrl: 'https://www.chinaasc.org.cn'
  },
  {
    id: 18, type: 'award',
    title: '2026年度中国风景园林学会科学技术奖',
    org: '中国风景园林学会', region: '国家',
    disciplines: ['风景园林', '城乡规划'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '设一等奖、二等奖、三等奖',
      target: '风景园林行业企事业单位、高校',
      quota: '同一单位限报 5 项',
      channel: '中国风景园林学会奖励系统'
    },
    conditions: [
      '成果须应用满 1 年',
      '规划设计类须提供施工或落地证明',
      '科技类须提供查新或评价报告'
    ],
    files: [
      { name: '奖励办法实施细则.pdf' },
      { name: '申报书.docx' }
    ],
    summary: '分科技进步奖、规划设计奖、优秀论文奖三类，园林与景观方向的主渠道。',
    curated: '规划设计奖和省优秀勘察设计奖有重合，同一项目两边报容易被判重复，选认可度高的那个。',
    sourceUrl: 'https://www.chsla.org.cn'
  },

  {
    id: 19, type: 'conference',
    title: '2026中国城市规划年会（广州·11月27-29日）',
    org: '中国城市规划学会', region: '国家',
    disciplines: ['城乡规划', '城市气候', '环境健康'],
    startAt: '2026-11-27', deadline: '2026-11-20', deadlineText: '2026年11月20日 24:00 注册截止',
    info: {
      amount: '会议费 2200 元/人（三楼直播会场 2100 元）；会员与本届投稿作者 1500 元，学生 1000 元',
      target: '规划行业从业者、高校师生',
      quota: '全体大会设一楼现场与三楼直播两个主会场，报名时选择',
      channel: '年会官网 planning.cn 或「中国城市规划」公众号，团体 5 人以上走团体报名'
    },
    conditions: [
      '注册时间 10 月 18 日 — 11 月 20 日，须全额缴费才算注册成功',
      '会员与本届投稿作者需在 10 月 28 日 24:00 前注册才享 1500 元优惠价',
      '学生凭学生证、校园卡或学信网学籍报告享 1000 元特惠',
      '11 月 20 日 24:00 前可提交取消注册申请并全额退款，之后不再办理'
    ],
    files: [
      { name: '关于召开2026中国城市规划年会的通知（红头文件）' },
      { name: '注册与报到说明' }
    ],
    summary: '2026 年会主题「城市规划 70 年：经纬华夏，智创未来」，会址广州越秀国际会议中心，会期 11 月 27-29 日。',
    curated: '一楼现场主会场 2200 元、三楼直播主会场 2100 元，屏幕不同、内容一致，预算紧就选三楼。年会论文录用只算交流与曝光，不算职称成果，但它是进入学会圈子的低成本入口。',
    sourceUrl: 'http://planning.cn/view.php?id=1135'
  },
  {
    id: 20, type: 'conference',
    title: '2027中国建筑学会学术年会征文',
    org: '中国建筑学会', region: '国家',
    disciplines: ['建筑', '环境设计', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 1 月 · 预估）',
    info: {
      amount: '注册费按学会标准，学生优惠',
      target: '建筑设计与研究从业者、高校师生',
      quota: '不限投，但同一作者录用不超过 2 篇',
      channel: '学会年会投稿系统'
    },
    conditions: [
      '原创未发表论文',
      '中英文均可，中文需附英文摘要',
      '需与年会主题相关'
    ],
    files: [
      { name: '征文通知.pdf' },
      { name: '论文模板.docx' }
    ],
    summary: '建筑学科年度学术会议，建筑物理与建筑环境方向有独立分会场。',
    curated: '建筑学会年会和规划年会时间常撞，两个都想投的话，先看哪个分论坛的点评人对你方向更对口。',
    sourceUrl: 'https://www.chinaasc.org.cn'
  },
  {
    id: 21, type: 'conference',
    title: '中国风景园林学会 2027 年会征文',
    org: '中国风景园林学会', region: '国家',
    disciplines: ['风景园林', '环境设计', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 3 月 · 预估）',
    info: {
      amount: '注册费按学会标准',
      target: '风景园林从业者与高校师生',
      quota: '第一作者限投 1 篇',
      channel: '学会年会征文平台'
    },
    conditions: [
      '未公开发表的原创论文',
      '字数 5000–8000 字',
      '需符合年会主题方向'
    ],
    files: [
      { name: '征文通知.pdf' },
      { name: '格式要求.pdf' }
    ],
    summary: '园林学科年度会议，健康景观、蓝绿空间方向近年热度高。',
    curated: '录用论文会结集出版，有 ISBN 但不是正式期刊，评职称时一般不算成果，别被宣传话术误导。',
    sourceUrl: 'https://www.chsla.org.cn'
  },
  {
    id: 22, type: 'conference',
    title: '城市气候与城市环境国际研讨会（摘要征集）',
    org: '中国城市科学研究会', region: '国家',
    disciplines: ['城市气候', '环境健康', '城乡规划'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '注册费 1800 元，学生 900 元',
      target: '城市气候、热环境、空气质量的科研人员',
      quota: '每人限投 2 篇摘要',
      channel: '会议官网在线投稿系统'
    },
    conditions: [
      '英文摘要 300 词以内',
      '接受口头报告与海报两种形式',
      '录用后须至少一位作者注册参会'
    ],
    files: [
      { name: 'Call for Abstracts.pdf' },
      { name: '摘要模板.docx' }
    ],
    summary: '与你研究方向最对口的会议，城市热岛、热暴露、微气候模拟类成果都可以投。',
    curated: '这个会议的审稿人圈子跟你方向高度重合，投摘要等于低成本让同行知道你在做什么。',
    sourceUrl: 'https://www.csus.org.cn'
  },
  {
    id: 23, type: 'conference',
    title: '健康城市与人居环境论坛征文',
    org: '中国城市科学研究会', region: '国家',
    disciplines: ['城乡规划', '环境健康', '风景园林'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 1 月 · 预估）',
    info: {
      amount: '注册费 1200 元',
      target: '健康城市、人居环境研究与实践人员',
      quota: '不限投',
      channel: '论坛官方邮箱投稿'
    },
    conditions: [
      '中文全文 6000 字左右',
      '需包含实证数据或案例',
      '录用后择优推荐至合作期刊'
    ],
    files: [
      { name: '论坛征文通知.pdf' }
    ],
    summary: '交叉方向论坛，环境健康与规划结合的选题命中率高，且有机会被推荐到合作期刊。',
    curated: '「择优推荐至期刊」是这类论坛最实际的价值，比一张录用证书值钱，投稿时把质量做足。',
    sourceUrl: 'https://www.csus.org.cn'
  },
  {
    id: 24, type: 'conference',
    title: '中国环境科学学会 2027 年学术年会',
    org: '中国环境科学学会', region: '国家',
    disciplines: ['环境健康', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 2 月 · 预估）',
    info: {
      amount: '注册费 1600 元，会员 1300 元',
      target: '环境领域科研与技术人员',
      quota: '每人限投 2 篇',
      channel: '学会年会投稿系统'
    },
    conditions: [
      '摘要 500 字以内',
      '需选择对应分会场',
      '录用后须注册参会'
    ],
    files: [
      { name: '年会征文通知.pdf' },
      { name: '摘要模板.doc' }
    ],
    summary: '环境健康方向的主场，大气污染、暴露评估、健康风险类研究对口。',
    curated: '分会场选错等于白投，投稿前先看去年分会场设置，挑跟你方法最接近的那个。',
    sourceUrl: 'https://www.chinacses.org'
  },

  {
    id: 29, type: 'special',
    title: '《城市规划》专栏征稿：气候适应型城市',
    org: '《城市规划》杂志社', region: '国家',
    disciplines: ['城乡规划', '城市气候'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估）',
    info: {
      amount: '不收版面费，付稿酬',
      target: '规划研究者与实践者',
      quota: '不限投',
      channel: '杂志社在线投稿系统'
    },
    conditions: [
      '中文原创，未公开发表',
      '字数 8000–12000 字',
      '需有中国本土案例或数据'
    ],
    files: [
      { name: '专栏征稿启事.pdf' },
      { name: '投稿须知.pdf' }
    ],
    summary: '国内规划学科顶级期刊的专栏，气候适应方向的政策与实证研究均可。',
    curated: '《城市规划》不收版面费还付稿酬，但审稿周期长（3–6 个月），急着毕业或评职称的别指望它赶上时间。',
    sourceUrl: 'http://www.cityplanning.com.cn'
  },
  {
    id: 30, type: 'special',
    title: '《中国园林》专题征稿：健康景观',
    org: '《中国园林》杂志社', region: '国家',
    disciplines: ['风景园林', '环境健康', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 1 月 · 预估）',
    info: {
      amount: '版面费按杂志社标准',
      target: '风景园林研究者与设计师',
      quota: '不限投',
      channel: '杂志社投稿系统（注明专题）'
    },
    conditions: [
      '中文原创论文',
      '字数 6000–9000 字',
      '需附中英文摘要与关键词'
    ],
    files: [
      { name: '专题征稿函.pdf' },
      { name: '论文格式规范.pdf' }
    ],
    summary: '园林学科核心期刊，健康景观、疗愈环境、绿地与公共健康方向对口。',
    curated: '投稿时在标题页注明「健康景观专题」，否则会被当常规稿件排队，等更久。',
    sourceUrl: 'http://www.jchla.com'
  },

  {
    id: 35, type: 'competition',
    title: '中国研究生智慧城市技术与创意设计大赛',
    org: '教育部学位与研究生教育发展中心', region: '国家',
    disciplines: ['城乡规划', '城市气候', '环境健康'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 11 月 · 预估）',
    info: {
      amount: '设一等奖、二等奖、三等奖，获奖可计入研究生创新实践学分',
      target: '全国高校在读研究生',
      quota: '每队 3–5 人，指导教师 1–2 人',
      channel: '中国研究生创新实践系列大赛官网'
    },
    conditions: [
      '在读硕士或博士研究生',
      '作品须为智慧城市相关的技术、产品或方案',
      '需提交作品文档与演示视频'
    ],
    files: [
      { name: '大赛通知.pdf' },
      { name: '作品提交模板.docx' },
      { name: '评审规则.pdf' }
    ],
    summary: '与城市数据、热环境监测、健康城市交叉度高的研究生赛事，属于国家级学科竞赛目录。',
    curated: '这个赛事在研究生评奖评优和部分高校的毕业要求里被认可，比一般商业竞赛含金量高，值得组织学生参加。',
    sourceUrl: 'https://cpipc.acge.org.cn'
  },
  {
    id: 36, type: 'competition',
    title: '「挑战杯」陕西省大学生课外学术科技作品竞赛',
    org: '共青团陕西省委', region: '陕西省',
    disciplines: ['城乡规划', '建筑', '风景园林', '环境设计'],
    startAt: '', deadline: '', deadlineText: '官方通知待发布（往年约 12 月 · 预估）',
    info: {
      amount: '设特等奖、一等奖、二等奖、三等奖',
      target: '陕西省高校在校学生',
      quota: '每校限额推荐，具体名额由校团委分配',
      channel: '校团委统一组织申报'
    },
    conditions: [
      '作品须为近两年内完成的学生课外学术科技或社会实践成果',
      '需有指导教师推荐意见',
      '集体作品作者不超过 8 人'
    ],
    files: [
      { name: '竞赛通知.pdf' },
      { name: '作品申报书.doc' }
    ],
    summary: '省级挑战杯，是国赛的选拔通道，社科类调查报告与科技发明制作均可申报。',
    curated: '校内名额靠抢，通常 9 月就要开始组队；教师想带学生出成果，别等通知发下来才动。',
    sourceUrl: 'http://www.sxgqt.org.cn'
  }
]

const TYPE_MAP = {}
TYPES.forEach(function (t) { TYPE_MAP[t.key] = t })

const LEVELS = [
  { key: 'national', name: '国家级' },
  { key: 'province', name: '省级' },
  { key: 'city', name: '市级' }
]
const LEVEL_MAP = {}
LEVELS.forEach(function (l) { LEVEL_MAP[l.key] = l.name })

const REAL_LIB = require('./notices_real.js')
const EXTRA_LIB = require('./notices_extra.js')
const rank = require('./rank.js')
const confInfo = require('./conf_info.js')

// 自动抓取候选（GitHub Actions 每日生成 utils/data_crawl.js）
// 文件缺失时静默降级为空数组，不影响小程序正常运行
let AUTO_LIB = { ITEMS: [], UPDATED_AT: '' }
try { AUTO_LIB = require('./data_crawl.js') } catch (e) {}

// ---------- 合并真实抓取 + 结构化库 ----------
// 旧逻辑是「有真实数据就整体替换」，结果精心整理的条件、附件、圈内提醒全被丢掉，
// 用户只看到 13 条干巴条目。现在改为合并：真实抓取提供时效与链接，结构化库提供细则。
function normKey (title) {
  return String(title || '')
    .replace(/[\s\u3000]/g, '')
    .replace(/[（）()《》「」【】〔〕·、,，。.:：;；"'“”‘’\-—_/]/g, '')
    .slice(0, 20)
}

function guessLevel (n) {
  if (n.level) return n.level
  const r = n.region || ''
  if (r === '国家' || r === '' || r.indexOf('全国') > -1) return 'national'
  if (r === '西安市') return 'city'
  return 'province'
}

let CACHE = null

function mergeList () {
  if (CACHE) return CACHE

  const out = []
  const idx = {}
  const real = (REAL_LIB.REAL || [])

  // 1) 真实抓取优先入列：日期与链接来自官网，时效性最高
  real.forEach(function (n) {
    const k = normKey(n.title)
    if (!k || idx[k] !== undefined) return
    idx[k] = out.length
    out.push(Object.assign({}, n, {
      source: 'crawl',
      level: guessLevel(n),
      rank: rank.of(n),
      // 抓取条目的日期来自官网通知原文，是精确日期，不算预估
      deadlineEstimated: false
    }))
  })

  // 2) 结构化库并入；与真实条目重复时只补字段，不覆盖官网数据
  const curated = NOTICES.concat(EXTRA_LIB.EXTRA || [])
  curated.forEach(function (n) {
    const k = normKey(n.title)
    if (k && idx[k] !== undefined) {
      const cur = out[idx[k]]
      if ((!cur.info || !cur.info.amount) && n.info && n.info.amount) cur.info = n.info
      if ((!cur.conditions || !cur.conditions.length) && n.conditions && n.conditions.length) cur.conditions = n.conditions
      if ((!cur.files || !cur.files.length) && n.files && n.files.length) cur.files = n.files
      if (!cur.curated && n.curated) cur.curated = n.curated
      if (!cur.peerNote && n.peerNote) cur.peerNote = n.peerNote
      if (!cur.summary && n.summary) cur.summary = n.summary
      if (!cur.freq && n.freq) cur.freq = n.freq
      return
    }
    idx[k] = out.length
    out.push(Object.assign({}, n, {
      source: 'curated',
      level: guessLevel(n),
      rank: rank.of(n),
      // 结构化库里的日期按往年惯例推算，必须让用户知道这是「参考日期」
      deadlineEstimated: n.deadlineEstimated !== false
    }))
  })

  // 3) 自动抓取候选：只提供「通知已发布」的线索
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

  // 4) 会议类补上专业层：主办/承办/协办、地点、注册费、主题与分论坛、到场单位
  //    项目与奖项靠「条件 + 材料」判断，会议必须靠这些才能判断值不值得去
  out.forEach(function (n) {
    if (n.type === 'conference') {
      n.conf = confInfo.enrich(n)
      n.confLine = confInfo.cardLine(n.conf)
    }
  })

  CACHE = out
  return out
}

function activeList () {
  return mergeList()
}

function getAll () {
  return mergeList()
}

function getById (id) {
  const list = mergeList()
  for (let i = 0; i < list.length; i++) {
    if (String(list[i].id) === String(id)) return list[i]
  }
  const n = parseInt(id, 10)
  for (let i = 0; i < list.length; i++) {
    if (parseInt(list[i].id, 10) === n) return list[i]
  }
  return null
}

// 同类推荐：同类型、同学科优先，排除自己
function getRelated (id, limit) {
  const list = mergeList()
  const cur = getById(id)
  if (!cur) return []
  const max = limit || 3
  const mine = cur.disciplines || []
  const scored = []
  for (let i = 0; i < list.length; i++) {
    const n = list[i]
    if (String(n.id) === String(id)) continue
    let score = 0
    if (n.type === cur.type) score += 3
    if (n.region === cur.region) score += 2
    if (n.org === cur.org) score += 1
    const its = n.disciplines || []
    for (let j = 0; j < mine.length; j++) {
      if (its.indexOf(mine[j]) > -1) { score += 2; break }
    }
    if (score > 0) scored.push({ n: n, s: score })
  }
  scored.sort(function (a, b) { return b.s - a.s })
  return scored.slice(0, max).map(function (x) { return x.n })
}

module.exports = {
  TYPES: TYPES,
  TYPE_MAP: TYPE_MAP,
  LEVELS: LEVELS,
  LEVEL_MAP: LEVEL_MAP,
  DISCIPLINES: DISCIPLINES,
  PROVINCES: PROVINCES,
  NOTICES: NOTICES,
  EXTRA: EXTRA_LIB.EXTRA,
  REAL: REAL_LIB.REAL,
  FETCHED_AT: REAL_LIB.FETCHED_AT,
  DATA_UPDATED_AT: DATA_UPDATED_AT,
  AUTO_UPDATED_AT: AUTO_LIB.UPDATED_AT,
  getAll: getAll,
  getById: getById,
  getRelated: getRelated
}
