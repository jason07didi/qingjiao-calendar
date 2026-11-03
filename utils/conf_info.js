// utils/conf_info.js
// 会议层：只保留判断「值不值得去」的关键信息 —— 主办/承办/协办、本届地点、注册费、主题、分论坛。
// 规模、语言、往年城市等次要信息压缩成一行，不再铺开。
// 地点一律写「本届」的具体城市（如 广州）；未公布的写「待公布」并注明上一届在哪，
// 绝不写「轮值城市」这种没有信息量的说法，也不写「中国 ·」这种国别前缀——

const PROFILES = [
  // ---------- 中国城市规划年会（2026 已确认：广州） ----------
  {
    re: /中国城市规划年会(?!.*信息化)/,
    edition: '2026 年',
    dates: '11 月 27—29 日（27 日报到、28 日全体大会）',
    venueCity: '广州',
    venueHall: '广州越秀国际会议中心',
    venueStatus: 'confirmed',
    prevVenue: '2025 年 · 沈阳',
    roles: [
      { role: '主办', name: '中国城市规划学会' },
      { role: '承办', name: '广州市人民政府' },
      { role: '协办', name: '中国城市规划设计研究院、广州市规划和自然资源局' }
    ],
    fee: '2200 元 / 人（会员与投稿作者 1500 元，学生 1000 元）',
    feeNote: '注册期 10月18日—11月20日；三楼直播主会场 2100 元；含资料，食宿交通自理',
    scale: '4000–6000 人',
    language: '中文',
    topics: ['城市规划 70 年', '城市更新与实施', '城市设计', '乡村规划', '韧性城市', '规划新技术', '区域与城市经济', '青年规划师'],
    sessions: ['城市更新与实施', '城市设计', '规划新技术应用', '乡村规划与建设', '韧性城市与城市安全', '青年规划师论坛'],
    who: [
      { group: '高校', list: ['同济', '清华', '东南', '西建大'] },
      { group: '规划院', list: ['中规院', '上海市院', '广东省院', '陕西省院'] },
      { group: '政府', list: ['自然资源部', '各省自然资源厅', '各市自然资源和规划局'] }
    ],
    official: { name: '中国城市规划学会', url: 'https://www.planning.cn' },
    note: '年会最大的价值不是听报告，是城市更新、新技术这两个分会场——评审专家和规划院项目负责人几乎都在这两个场。'
  },

  // ---------- 中国建筑学会学术年会（2026 年底，地点未公布） ----------
  {
    re: /建筑学会.*(年会|学术年会)/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '2026 届定于年底召开，会址尚未公布',
    venueStatus: 'pending',
    prevVenue: '2025 年 · 上海',
    roles: [
      { role: '主办', name: '中国建筑学会' },
      { role: '承办', name: '轮值高校或设计院（2026 届征文由西安建筑科技大学受托受理）' },
      { role: '协办', name: '中国建筑设计研究院、地方土木建筑学会' }
    ],
    fee: '约 1200–1600 元 / 人（学生约 600 元）',
    feeNote: '会址与注册费以当年通知为准；论文录用后需注册才能参会',
    scale: '1500–3000 人',
    language: '中文',
    topics: ['设计理论与创作', '建筑历史与评论', '建筑教育与学科交叉', '城市更新与改造', '建筑文化与遗产', '乡村建设', '数智建筑', '健康环境与人因'],
    sessions: ['建筑创作', '建筑技术', '建筑教育', '青年建筑师论坛', '建筑评论'],
    who: [
      { group: '高校', list: ['清华', '东南', '同济', '西建大'] },
      { group: '设计院', list: ['中国院', '北京院', '华东院', '上海院'] },
      { group: '政府', list: ['住房和城乡建设部', '各市住建局'] }
    ],
    official: { name: '中国建筑学会', url: 'https://www.chinaasc.org.cn' },
    note: '2026 届征文已于 5 月 20 日截止，录用结果 8 月 30 日前邮件通知。2027 届征文一般 3—4 月发通知。'
  },

  // ---------- 中国风景园林学会年会（2027，上一届温州） ----------
  {
    re: /风景园林学会.*(年会|学术年会)/,
    edition: '2027 年 · 第十七届',
    venueCity: '待公布',
    venueHall: '会址通常与园博会所在城市重合',
    venueStatus: 'pending',
    prevVenue: '2026 年 · 温州',
    roles: [
      { role: '主办', name: '中国风景园林学会' },
      { role: '承办', name: '省级风景园林学会 + 当地高校' },
      { role: '协办', name: '当地市园林学会、园林设计院' }
    ],
    fee: '约 1600–1800 元 / 人（学生约 900 元）',
    feeNote: '2026 届标准：会员 1600、非会员 1800、学生 900（4月13日前在线）；现场报名 2000',
    scale: '1000–2000 人',
    language: '中文',
    topics: ['风景园林规划与设计', '城市生物多样性与植物应用', '风景名胜与遗产保护', '园林文化传承', '存量绿地运维', '百姓园林与社区花园'],
    sessions: ['风景园林规划设计', '园林植物与生态修复', '自然保护地与遗产', '青年风景园林师论坛', '行业发展与人才培养'],
    who: [
      { group: '高校', list: ['北林', '清华', '同济', '南林'] },
      { group: '设计机构', list: ['中规院风景园林分院', '杭州园林设计院', '土人设计', 'AECOM'] },
      { group: '政府', list: ['各市园林和林业局', '自然保护地管理机构'] }
    ],
    official: { name: '中国风景园林学会', url: 'https://www.chsla.org.cn' },
    note: '2026 届在温州与园博会合办，设 16 个分会场。蓝绿空间与人体健康是近年增长最快的方向。'
  },

  // ---------- 城市气候与城市环境国际研讨会 ----------
  {
    re: /城市气候与城市环境|热环境研讨会/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '往届由承办高校提供会场',
    venueStatus: 'pending',
    prevVenue: '近年 · 西安、南京、上海',
    roles: [
      { role: '主办', name: '中国城市科学研究会' },
      { role: '承办', name: '承办高校（近年西安建大、南京大学）' },
      { role: '协办', name: '中国气象局城市气象研究所、高校建筑技术科学系' }
    ],
    fee: '约 1800 元 / 人（学生约 900 元）',
    feeNote: '含资料、茶歇与两天午餐；摘要录用后注册，部分年份设线上低价档',
    scale: '300–600 人',
    language: '中英双语',
    topics: ['城市热岛与热浪', '城市通风与风环境', '空气质量与人群健康', '城市碳汇与碳中和', '建成环境与健康', '气候模拟与遥感'],
    sessions: ['城市热环境监测与模拟', '城市通风廊道', '热健康风险与脆弱人群', '气候适应性设计'],
    who: [
      { group: '高校', list: ['西建大', '香港中文大学', '同济', '清华'] },
      { group: '科研', list: ['中科院城市环境研究所', '中国气象局城市气象研究所', '国家气候中心'] },
      { group: '政府企业', list: ['住房和城乡建设部', '地方气象局', '遥感数据企业'] }
    ],
    official: { name: '中国城市科学研究会', url: 'http://www.chinasus.org' },
    note: '与你城市气候 + 环境健康交叉方向最贴的一场会，规模小、方向集中，投稿命中率通常高于年会主会场。'
  },

  // ---------- 健康城市与人居环境论坛 ----------
  {
    re: /健康城市|人居环境论坛/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '往届在轮值城市高校会场',
    venueStatus: 'pending',
    prevVenue: '近年 · 北京、上海、广州',
    roles: [
      { role: '主办', name: '中国城市科学研究会健康城市专业委员会' },
      { role: '承办', name: '轮值高校或疾控机构' },
      { role: '协办', name: '高校公共卫生学院、地方卫健部门' }
    ],
    fee: '约 1200 元 / 人（学生约 600 元）',
    feeNote: '规模不大，注册名额常提前满',
    scale: '200–400 人',
    language: '中文',
    topics: ['健康社区', '适老化环境', '儿童友好城市', '蓝绿空间与心理健康', '公共卫生与空间治理'],
    sessions: ['健康社区营造', '适老与儿童友好环境', '蓝绿空间与心理健康'],
    who: [
      { group: '高校', list: ['同济', '北大公卫', '华中科大', '西建大'] },
      { group: '机构', list: ['中国疾控中心', '地方卫健委', '规划院'] }
    ],
    official: { name: '中国城市科学研究会', url: 'http://www.chinasus.org' },
    note: '环境健康方向要拿「健康」这面旗，这个论坛比综合年会好用，同行密度高、审稿人熟。'
  },

  // ---------- 中国环境科学学会年会 ----------
  {
    re: /环境科学学会/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '往届在轮值城市会展中心',
    venueStatus: 'pending',
    prevVenue: '近年 · 南京、天津、成都',
    roles: [
      { role: '主办', name: '中国环境科学学会' },
      { role: '承办', name: '轮值城市生态环境局 / 高校' },
      { role: '协办', name: '中国环境科学研究院、地方环境科学学会' }
    ],
    fee: '约 1300–1600 元 / 人（学生约 900 元）',
    feeNote: '会员 1300、非会员 1600；同期设环保科技成果展',
    scale: '2000–3500 人',
    language: '中文',
    topics: ['大气环境', '水环境', '土壤与固废', '环境健康', '碳排放与气候变化', '环境规划与评价'],
    sessions: ['大气环境与空气质量', '环境健康与风险', '碳排放与气候变化', '环境规划与评价'],
    who: [
      { group: '科研院所', list: ['中国环科院', '生态环境部环境规划院', '中科院生态环境中心'] },
      { group: '高校', list: ['清华环境学院', '北大环境学院', '南大环境学院', '西建大环境学院'] },
      { group: '政府企业', list: ['各省生态环境厅', '省环科院', '环境监测与治理企业'] }
    ],
    official: { name: '中国环境科学学会', url: 'https://www.chinacses.org' },
    note: '环境健康分会场是规划/建筑背景能插进去的口子：空气污染暴露、建成环境与健康，这里不算外行。'
  },

  // ---------- 中国城市规划信息化年会 ----------
  {
    re: /规划信息化|规划新技术/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '往届在轮值城市规划信息中心',
    venueStatus: 'pending',
    prevVenue: '近年 · 深圳、武汉、上海',
    roles: [
      { role: '主办', name: '中国城市规划学会城市规划新技术应用专业委员会' },
      { role: '承办', name: '承办城市规划信息中心' },
      { role: '协办', name: '承办城市自然资源和规划局、相关高校' }
    ],
    fee: '约 1000–1400 元 / 人（学生约 600 元）',
    feeNote: '不收版面费；注册费按学会标准，含资料与用餐',
    scale: '800–1500 人',
    language: '中文',
    topics: ['国土空间规划一张图', '城市信息模型 CIM', '城市体检与大数据', '时空数据治理', 'AI 与智能规划', '数字孪生城市'],
    sessions: ['国土空间规划实施监督', 'CIM 与数字孪生', '城市体检与时空大数据', 'AI 辅助规划设计'],
    who: [
      { group: '高校', list: ['武大', '同济', '清华', '深大'] },
      { group: '信息中心', list: ['中规院信息中心', '深圳规划国土信息中心', '上海规划资源信息中心'] },
      { group: '企业', list: ['超图软件', '百度地图', '阿里云'] }
    ],
    official: { name: '中国城市规划学会', url: 'https://www.planning.cn' },
    note: '做城市大数据、热环境遥感、空间分析的，这个会比年会更容易遇到同路人，规模小、交流密度高。'
  },

  // ---------- 中国建筑物理学术大会（两年一届，上届重庆） ----------
  {
    re: /建筑物理/,
    edition: '2027 年 · 第十七届',
    venueCity: '待公布',
    venueHall: '两年一届，承办院校提供会场',
    venueStatus: 'pending',
    prevVenue: '2025 年 · 重庆（重庆大学承办）',
    roles: [
      { role: '主办', name: '中国建筑学会建筑物理分会' },
      { role: '承办', name: '承办高校（2025 届为重庆大学）' },
      { role: '协办', name: '亚热带建筑科学国家重点实验室、西部绿色建筑国家重点实验室' }
    ],
    fee: '约 1000–1500 元 / 人（学生约 600 元）',
    feeNote: '2025 届标准，含资料、论文集与用餐；录用论文收入正式出版论文集',
    scale: '700–900 人',
    language: '中文',
    topics: ['建筑热工与节能', '建筑声学', '建筑采光与照明', '绿色建筑环境品质', '建筑门窗与幕墙', '城市微气候', '健康人居环境', '低碳城市与建筑'],
    sessions: ['建筑热工与节能', '建筑与环境声学', '采光与照明', '城市微气候', '健康人居环境', '期刊主编面对面'],
    who: [
      { group: '高校', list: ['华南理工', '清华', '西建大', '重大'] },
      { group: '科研设计', list: ['中国建研院', '中国院', '各省建科院'] },
      { group: '企业', list: ['建筑节能与门窗幕墙企业', '室内环境监测设备商'] }
    ],
    official: { name: '中国建筑学会', url: 'https://www.chinaasc.org.cn' },
    note: '2025 年第十六届在重庆，28 个分论坛、9 个专题方向。城市热环境在这里是主场而不是交叉方向。两年一届，错过要等两年。'
  },

  // ---------- ICUC 国际城市气候大会 ----------
  {
    re: /ICUC|IAUC|国际城市气候/,
    edition: '下一届',
    venueCity: '待公布',
    venueLine: '待公布',
    venueHall: '海外承办高校会场（历届由承办学校提供）',
    venueStatus: 'pending',
    prevVenue: '',
    roles: [
      { role: '主办', name: '国际城市气候学会（IAUC）' },
      { role: '承办', name: '历届承办高校' },
      { role: '协办', name: '当地气象与城市规划机构' }
    ],
    fee: '约 4000–6000 元 / 人（学生约 2000–3000 元）',
    feeNote: '按欧元结算；另需签证、机票、住宿，整体预算通常 1.5–2.5 万元',
    scale: '600–1000 人',
    language: '英文（唯一工作语言）',
    topics: ['Urban heat island', 'Urban ventilation', 'Outdoor thermal comfort', 'Urban climate modelling', 'Climate-responsive design', 'Heat and health'],
    sessions: ['UHI observation', 'Urban climate modelling', 'Thermal comfort & health', 'Blue-green infrastructure', 'Early career'],
    who: [
      { group: '国际高校', list: ['Reading', 'ETH Zurich', 'NUS', 'HKU'] },
      { group: '国内单位', list: ['同济', '南大', '西建大', '中科院城环所'] },
      { group: '期刊机构', list: ['Urban Climate 编辑部', 'WMO 工作组'] }
    ],
    official: { name: '国际城市气候学会 IAUC', url: 'https://www.urban-climate.org' },
    note: '城市气候领域最正统的国际会。语言门槛真实存在：摘要能写，口头报告能不能讲清楚是另一回事。'
  },

  // ---------- 中国城市科学研究会年会 ----------
  {
    re: /城市科学研究会.*年会/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '往届在北京、上海',
    venueStatus: 'pending',
    prevVenue: '近年 · 北京、上海',
    roles: [
      { role: '主办', name: '中国城市科学研究会' },
      { role: '承办', name: '学会各专业委员会（20+ 平行分论坛）' },
      { role: '协办', name: '中国城市规划设计研究院、中国建筑科学研究院' }
    ],
    fee: '约 1200–1600 元 / 人（学生约 700 元）',
    feeNote: '分论坛由各专委会自办，注册后可自由串场',
    scale: '1500–2500 人',
    language: '中文',
    topics: ['绿色建筑', '健康城市', '城市更新', '智慧城市', '低碳生态', '城市水环境'],
    sessions: ['绿色建筑与低碳', '健康城市', '城市更新', '智慧城市'],
    who: [
      { group: '科研设计', list: ['中规院', '中国建研院', '各专委会'] },
      { group: '高校', list: ['清华', '同济', '北大', '西建大'] },
      { group: '企业', list: ['中建、万科等开发建造企业', '低碳与智慧城市服务商'] }
    ],
    official: { name: '中国城市科学研究会', url: 'http://www.chinasus.org' },
    note: '分论坛是各专委会自己办的，一个会能串好几个方向。想看健康城市又想知道绿色建筑怎么评，来这一场最省。'
  },

  // ---------- 全国建筑院系建筑数字技术研讨会 ----------
  {
    re: /建筑数字技术|数字技术教学/,
    edition: '2027 年',
    venueCity: '待公布',
    venueHall: '轮值建筑院校承办',
    venueStatus: 'pending',
    prevVenue: '近年 · 上海、南京、深圳',
    roles: [
      { role: '主办', name: '全国高校建筑学学科专业指导委员会建筑数字技术教学工作委员会' },
      { role: '承办', name: '承办建筑院校' },
      { role: '协办', name: '承办院校建筑学院、相关软件企业' }
    ],
    fee: '约 1000–1500 元 / 人（学生约 500 元）',
    feeNote: '常设软件工作营，需单独报名',
    scale: '200–400 人',
    language: '中文',
    topics: ['参数化与算法设计', '生成式设计', 'AI 辅助建筑设计', '数字建造', '数字遗产', 'VR / AR 空间体验'],
    sessions: ['数字设计教学', 'AI 与生成式设计', '数字建造与材料', '学生工作营'],
    who: [
      { group: '高校', list: ['同济', '东南', '清华', '深大'] },
      { group: '企业', list: ['设计软件平台', '数字建造团队'] }
    ],
    official: { name: '中国建筑学会', url: 'https://www.chinaasc.org.cn' },
    note: '教学型会议，对职称直接作用有限，但申报教改项目、建课程资源时这里最容易找到愿意一起报的同行。'
  }
]

function fallback (n) {
  const f = {
    edition: '',
    venueCity: '见原文',
    venueHall: '',
    venueStatus: 'pending',
    prevVenue: '',
    roles: [{ role: '主办', name: n.org || '见原文' }],
    fee: (n.info && n.info.amount) || '见官网通知',
    feeNote: '',
    scale: '',
    language: '',
    topics: [],
    sessions: [],
    who: [],
    official: null,
    note: '',
    estimate: true
  }
  f.venueLine = f.venueCity
  return f
}

function enrich (n) {
  if (!n || n.type !== 'conference') return null
  const text = (n.title || '') + ' ' + (n.org || '')
  for (let i = 0; i < PROFILES.length; i++) {
    if (PROFILES[i].re.test(text)) {
      const p = PROFILES[i]
      const out = {}
      Object.keys(p).forEach(function (k) { if (k !== 're') out[k] = p[k] })
      out.estimate = p.venueStatus !== 'confirmed'
      // 地点一句话：已公布就写城市（广州），没公布就写清上一届在哪
      out.venueLine = p.venueLine
        ? p.venueLine
        : (p.venueStatus === 'confirmed'
          ? p.venueCity
          : ('待公布' + (p.prevVenue ? '（上届 ' + p.prevVenue + '）' : '')))
      return out
    }
  }
  return fallback(n)
}

// 卡片一行：城市 + 注册费起点 + 分论坛数
function cardLine (conf) {
  if (!conf) return ''
  const bits = []
  if (conf.venueCity) bits.push(conf.venueStatus === 'confirmed' ? conf.venueCity : '地点待公布')
  if (conf.fee) bits.push(String(conf.fee).split('（')[0])
  if (conf.sessions && conf.sessions.length) bits.push(conf.sessions.length + ' 个分论坛')
  return bits.join(' · ')
}

module.exports = { enrich: enrich, cardLine: cardLine, PROFILES: PROFILES }
