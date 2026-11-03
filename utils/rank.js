// utils/rank.js
// 把「一条信息」翻译成「在你的评价表上算几斤几两」。
//
// 高校职称/考核口径各校不同，这里给的是全国多数高校的通行口径，
// 并在界面上明确写「以本校文件为准」——不能让人拿这个当唯一依据。

// ============ 项目 ============
const PROJECT = {
  'national-top': {
    name: '国家级重点', short: '国重', weight: 6, tone: 'red',
    use: '正高职称的主要支撑，多数学校单列加分项',
    eg: '国家重点研发计划、科技重大专项、杰青、优青、创新研究群体'
  },
  national: {
    name: '国家级', short: '国级', weight: 5, tone: 'red',
    use: '评副高的硬指标之一，也是人才计划的门槛条件',
    eg: '国家自然科学基金面上/青年、国家社科基金年度项目'
  },
  ministry: {
    name: '部级', short: '部级', weight: 4, tone: 'amber',
    use: '多数学校等同或略低于省级，教学型职称里权重更高',
    eg: '教育部人文社科、住建部科技计划、教育部产学合作协同育人'
  },
  province: {
    name: '省级', short: '省级', weight: 3, tone: 'blue',
    use: '评副高的常见要求；正高只能当基础量',
    eg: '省自然科学基金、省社科基金、省重点研发计划'
  },
  city: {
    name: '厅局级', short: '厅级', weight: 2, tone: 'blue',
    use: '青年教师的第一块「主持项目」履历，评中级够用',
    eg: '省教育厅项目、市科技计划、市社科规划'
  },
  society: {
    name: '学会/协会', short: '学会', weight: 1, tone: 'gray',
    use: '补充业绩，多数学校不计入纵向项目',
    eg: '学会立项课题、协会专项'
  }
}

// ============ 奖项 ============
const AWARD = {
  'national-top': {
    name: '国家级奖励', short: '国奖', weight: 6, tone: 'red',
    use: '职称破格、人才计划申报的核心筹码',
    eg: '国家自然科学奖、技术发明奖、科技进步奖'
  },
  province: {
    name: '省部级奖励', short: '省奖', weight: 5, tone: 'red',
    use: '职称评审的重要加分项，评优评先的硬材料',
    eg: '省科学技术奖、省社科优秀成果奖、教育部高校科研优秀成果奖'
  },
  society: {
    name: '社会力量奖', short: '学会奖', weight: 3, tone: 'amber',
    use: '看本校认可目录：部分学校按省部级算，多数只算补充',
    eg: '华夏建设科技奖、詹天佑奖、各全国学会科技奖'
  },
  industry: {
    name: '行业/协会奖', short: '行业奖', weight: 2, tone: 'gray',
    use: '职称里权重低，但对投标、对外合作、招生宣传有用',
    eg: '省规划协会优秀设计奖、AHLA 人居景观奖、设计类竞赛奖'
  }
}

// ============ 期刊（特刊/征稿类） ============
const JOURNAL = {
  top: { name: '学科顶刊', short: '顶刊', weight: 6, tone: 'red', use: '评正高的代表作候选' },
  intl: {
    name: 'SCI / SSCI 收录', short: 'SCI', weight: 6, tone: 'red',
    use: '理工科职称的天花板级材料，多数学校按一类期刊计；扣清本校是否分区要求（Q1/Q2）',
    eg: 'Building and Environment、Urban Climate、Environment International 等本领域国际刊特刊'
  },
  cssci: { name: 'CSSCI 来源', short: 'CSSCI', weight: 5, tone: 'red', use: '人文社科职称的硬通货，多数学校按一类/二类期刊计' },
  cscd: { name: 'CSCD 来源', short: 'CSCD', weight: 4, tone: 'amber', use: '理工科职称认可，部分学校等同北大核心' },
  pku: { name: '北大核心', short: '北核', weight: 3, tone: 'blue', use: '职称的基础门槛，评副高常见要求' },
  other: { name: '普通期刊', short: '普刊', weight: 1, tone: 'gray', use: '只用于凑数量或结题，职称里基本不计分' }
}

// ============ 会议 ============
const CONFERENCE = {
  'intl-top': {
    name: '国际权威会议', short: '国际', weight: 5, tone: 'red',
    use: '建立国际同行认知，是联合发文和出国交流的入口',
    eg: 'ICUC 国际城市气候大会等本领域国际系列会议'
  },
  'national-top': {
    name: '全国一级学会年会', short: '一级学会', weight: 4, tone: 'amber',
    use: '国内学术网络的主场，职称里一般不计分但评奖评优和项目评审看得到',
    eg: '规划年会、建筑学会年会、风景园林学会年会、建筑物理学术大会'
  },
  committee: {
    name: '专委会/专题会议', short: '专委会', weight: 2, tone: 'blue',
    use: '圈子更精准，适合带学生投摘要、试探反应',
    eg: '规划信息化年会、健康城市论坛等'
  }
}

// ============ 竞赛 ============
const COMPETITION = {
  'national-a': {
    name: '国家级学科竞赛', short: '国赛', weight: 4, tone: 'red',
    use: '教学业绩与学生培养成果，学科评估和一流专业申报都用得上',
    eg: '人居设计学年奖、霍普杯、园冶杯、研究生智慧城市大赛、挑战杯国赛'
  },
  province: {
    name: '省级竞赛', short: '省赛', weight: 2, tone: 'blue',
    use: '教学业绩补充，主要价值是国赛的选拔通道',
    eg: '省级挑战杯、省级学科竞赛'
  }
}

// ============ 人才 ============
const TALENT = {
  'national-top': {
    name: '国家级人才', short: '国家级', weight: 6, tone: 'red',
    use: '直接决定岗位等级、博导资格、团队与经费配置',
    eg: '杰青、长江学者、万人计划领军人才'
  },
  'national': {
    name: '国家级青年人才', short: '国青', weight: 5, tone: 'red',
    use: '评正高的强力筹码，也是省级人才的最高台阶',
    eg: '优青、青年长江、青年拔尖、科协青年托举'
  },
  province: {
    name: '省级人才', short: '省级', weight: 4, tone: 'amber',
    use: '校内岗位聘任、绩效和评职称都有实打实的分量',
    eg: '省特支计划、省青年科技新星、三秦学者'
  }
}

// ============ 学术岗（青年编委 / 审稿人 / 学会委员 / 客座编辑） ============
// 这一类最容易被当成「虚职」忽略，其实是生涯规划里唯一能主动争取、
// 而且不用等年度通知的东西——但它在职称里的计分方式和项目奖项完全不同。
const POSITION = {
  intl: {
    name: '国际期刊编委', short: '国际编委', weight: 4, tone: 'amber',
    use: '学科评估与国际化指标里加分明显；个人职称一般不直接计分，但对基金评审的同行认知帮助大',
    eg: '国际期刊青年编委、特刊客座编辑、副主编'
  },
  core: {
    name: '国内核心期刊编委', short: '核心编委', weight: 3, tone: 'blue',
    use: '进入学科共同体的最短路径，换来审稿优先、约稿通道和专题主导权',
    eg: '《建筑学报》专题主持、《中国园林》《国际城市规划》青年编委'
  },
  society: {
    name: '学会委员 / 分会职务', short: '学会委员', weight: 3, tone: 'blue',
    use: '决定学会奖项推荐权和年会分论坛组织权，在「学术服务」一栏是硬实证',
    eg: '学会青年工作委员会委员、专委会委员、分会理事'
  },
  reviewer: {
    name: '期刊审稿人', short: '审稿人', weight: 1, tone: 'gray',
    use: '学术服务的入门凭证，多数人才计划可填入「学术服务」栏，不单独加分',
    eg: '国际期刊审稿人、国内核心期刊外审专家'
  }
}

// ============ 标准规范 / 科研政策征求意见 ============
// 这类很多人以为"跟自己无关"——其实职称改革文件明确把"标准规范"列为代表性成果，
// 参编/回函征求意见是进入标准制定圈的最低成本入口。政策征求意见则直接决定明年的申报规则。
const STANDARD = {
  'national': {
    name: '国家 / 行业标准', short: '国标', weight: 5, tone: 'red',
    use: '参编或回函即进入国家/行业标准制定圈，职称"代表性成果"明确包含标准规范',
    eg: '住建部工程建设标准、国标委推荐性国家标准、工程建设强制性国家规范'
  },
  'ministry': {
    name: '部委规范 / 规程', short: '部委', weight: 4, tone: 'amber',
    use: '行业部委主导的规范规程，设计院/规划院项目投标常引用，回函意见会被采纳',
    eg: '住建部标准定额司、各部委发布的工程建设标准'
  },
  'province': {
    name: '地方 / 团体标准', short: '地标', weight: 3, tone: 'blue',
    use: '省标/学会团体标准门槛低、回函易被看到，是青年老师进入标准圈的第一步',
    eg: '陕西省住建厅地方标准、中国工程建设标准化协会(CECS)团体标准'
  },
  'policy': {
    name: '政策征求意见', short: '政策', weight: 3, tone: 'blue',
    use: '影响明年申报规则（包干制/破五唯/评价改革），回函是能被看到的专业表态',
    eg: '科研经费管理办法、职称评审改革、评价破五唯征求意见稿'
  }
}

// ============ 行业资质考试 ============
// 设计/规划/环境圈的"双证"——执业资格是设计院上岗与签章硬门槛，也是高校"双师型"认定材料。
const LICENSE = {
  'national': {
    name: '国家级执业资格', short: '国证', weight: 4, tone: 'red',
    use: '注册执业资格是设计院/规划院上岗与签章硬门槛，也是高校"双师型"教师认定核心材料',
    eg: '一级注册建筑师、注册城乡规划师、注册咨询工程师(投资)、注册环保工程师'
  },
  'provincial': {
    name: '省级考试 / 认定', short: '省考', weight: 2, tone: 'blue',
    use: '由各省人事考试网组织，报名与资格审核口径各省略有差异',
    eg: '各省注册工程师报名、专业技术人员资格考试'
  }
}

// ============ 博士后 ============
// 青椒=刚出站/在站博士，这是职业生涯第一桶金，也是出站留校评副高的关键筹码。
const POSTDOC = {
  'national': {
    name: '国家级博士后计划', short: '博新', weight: 5, tone: 'red',
    use: '博新计划/特别资助是博士后阶段最高资助，出站留校评副高的强力筹码',
    eg: '博士后创新人才支持计划(博新)、博士后科学基金特别资助'
  },
  'general': {
    name: '博士后基金 / 资助', short: '博基', weight: 3, tone: 'blue',
    use: '面上资助是博士后标配科研启动金，几乎人人可报，出站考核硬指标',
    eg: '中国博士后科学基金面上资助'
  },
  'exchange': {
    name: '国际 / 地区交流', short: '交流', weight: 3, tone: 'blue',
    use: '派出交流/访学，建立海外合作、发国际论文的低成本通道',
    eg: '博士后国际交流计划、香江学者、澳门青年学者'
  }
}

// ============ 公派访学 / 研修 ============
const VISIT = {
  'national': {
    name: '国家级公派', short: 'CSC', weight: 5, tone: 'red',
    use: 'CSC 公派访问学者/博士后，发国际论文与建立海外合作的主通道，回国服务期有约定',
    eg: '国家留学基金委公派访问学者、公派博士后、青年骨干教师出国研修'
  },
  'provincial': {
    name: '地方 / 校际研修', short: '地方', weight: 3, tone: 'blue',
    use: '省厅/学校选派，门槛较 CSC 友好，适合首次出国交流',
    eg: '地方青年人才出国研修、西部项目、校际访问学者'
  }
}

// ============ 职称评审 / 导师资格 / 聘期考核 ============
// 非升即走命门。校内通知抓不到，这里只做省级/学会公开部分的提醒。
const REVIEW = {
  'national': {
    name: '国家级评审 / 岗位', short: '国评', weight: 5, tone: 'red',
    use: '跨单位/国家级评审通过的资格，全国通用',
    eg: '国家级人才计划评审、跨地区职称互认'
  },
  'provincial': {
    name: '省级评审', short: '省评', weight: 4, tone: 'amber',
    use: '省高评委/省人社评审通过即具备资格，是聘副高的关键一步',
    eg: '陕西省高级职称评审、博士生导师资格、硕导遴选'
  },
  'institutional': {
    name: '校内评审 / 聘期', short: '校内', weight: 2, tone: 'gray',
    use: '校内岗位聘任、聘期考核推荐，非升即走的关键节点',
    eg: '校级职称评审、聘期考核优秀推荐、教学准入'
  }
}

// ============ 研究生相关（带学生的青椒） ============
const STUDENT = {
  'national': {
    name: '国家级项目', short: '国级', weight: 4, tone: 'red',
    use: '大创国家级、研究生国奖是带学生的硬成果，学科评估/一流专业申报都用得上',
    eg: '国家级大学生创新创业训练计划、研究生国家奖学金'
  },
  'provincial': {
    name: '省级项目', short: '省项', weight: 2, tone: 'blue',
    use: '省级大创/研究生项目，国项的选拔通道，也是导师业绩补充',
    eg: '省级大学生创新创业训练计划、省研究生创新基金'
  }
}

// ============ 青椒辅助成长（教学发展 / 人才托举 / 行业小称号 / 土木建筑试点） ============
// 用户明确要补齐的「虽然小，但有用」板块：讲师+博士入职头几年最该主动争取的成长型业绩，
// 覆盖教学竞赛、青年人才托举、国际交流、社会服务、学术任职，以及土木/建筑类行业奖与试点。
// 它们不像大项目那样显眼，却是职称「教学 / 社会服务」栏与人才计划申报的硬材料。
const GROWTH = {
  'national': {
    name: '国家级培养 / 资助', short: '国级', weight: 4, tone: 'red',
    use: '教学与人才发展的高阶台阶，评优评先、职称「教学 / 社会服务」栏的硬材料',
    eg: '全国高校教师教学创新大赛、中国科协青年人才托举工程、华夏建设科学技术奖'
  },
  'province': {
    name: '省级培养 / 项目', short: '省级', weight: 3, tone: 'blue',
    use: '校内考核、岗位聘任里「教学发展与青年教师培养」的实打实业绩',
    eg: '省科协青年人才托举、省级青年教师教学竞赛、省级优秀规划设计奖'
  },
  'city': {
    name: '校级 / 基层培养', short: '校级', weight: 2, tone: 'gray',
    use: '入职头几年最容易拿到、也最该主动争取的「成长型」业绩，攒够再冲上面',
    eg: '校级青年骨干教师计划、校级教学能手、学会青年委员、虚拟教研室'
  }
}

const POOLS = {
  project: PROJECT,
  award: AWARD,
  special: JOURNAL,
  conference: CONFERENCE,
  competition: COMPETITION,
  talent: TALENT,
  position: POSITION,
  standard: STANDARD,
  license: LICENSE,
  postdoc: POSTDOC,
  visit: VISIT,
  review: REVIEW,
  student: STUDENT,
  growth: GROWTH
}

// 期刊名 → 等级（只列已知的，其余按普通期刊处理）。
// 英文刊在前：Cities 这类短名会撞上 Sustainable Cities and Society，长的先判。
const JOURNAL_MAP = [
  { re: /Sustainable Cities and Society/i, key: 'intl', label: 'SCI 收录 · 中科院 1 区 · 城市可持续方向顶刊' },
  { re: /Building and Environment/i, key: 'intl', label: 'SCI 收录 · 中科院 1 区 · 建筑环境顶刊' },
  { re: /Environment International/i, key: 'intl', label: 'SCI 收录 · 中科院 1 区 · 环境健康顶刊' },
  { re: /Landscape and Urban Planning/i, key: 'intl', label: 'SSCI/SCI 双收录 · 景观规划领域国际标杆' },
  { re: /Urban Climate/i, key: 'intl', label: 'SCI 收录 · 城市气候领域旗舰刊' },
  { re: /International Journal of Biometeorology/i, key: 'intl', label: 'SCI 收录 · 生物气象老牌刊' },
  { re: /Cities(?! and Society)/i, key: 'intl', label: 'SSCI 收录 · 城市研究国际刊' },
  { re: /建筑学报/, key: 'top', label: '建筑学顶刊 · CSSCI · 北大核心' },
  { re: /城市规划学刊/, key: 'top', label: '规划学顶刊 · CSSCI · 北大核心' },
  { re: /装饰/, key: 'cssci', label: '设计学 CSSCI 来源 · 北大核心' },
  { re: /国际城市规划/, key: 'cssci', label: 'CSSCI 来源 · 北大核心' },
  { re: /城市规划(?!学刊)/, key: 'top', label: '规划学顶刊 · CSSCI · 北大核心' },
  { re: /中国园林/, key: 'pku', label: '北大核心 · CSCD' },
  { re: /城市发展研究/, key: 'cssci', label: 'CSSCI 来源 · 北大核心' },
  { re: /景观设计学/, key: 'cscd', label: 'CSCD 来源' },
  { re: /新建筑/, key: 'pku', label: '北大核心' },
  { re: /西部人居环境学刊/, key: 'pku', label: '北大核心 · CSSCI 扩展版' },
  { re: /时代建筑/, key: 'pku', label: '北大核心' }
]

// 组织名 + 标题 → 等级判定
function classifyKey (n) {
  const org = n.org || ''
  const title = n.title || ''
  const t = n.type

  if (t === 'project') {
    // 开放基金 / 开放课题：不是国家科技计划，按「依托平台」定档
    //   国家重点实验室、国家工程实验室 → 部级；教育部重点实验室 → 省级；其余校级/院级 → 厅局级
    if (/开放基金|开放课题|开放研究基金/.test(title + org)) {
      if (/国家重点实验室|国家工程实验室|国家环境保护|国家野外/.test(org + title)) return 'ministry'
      // 部门/行业重点实验室（如中国气象局城市气象重点开放实验室）按省部级计
      if (/教育部重点实验室|教育部工程研究|重点开放实验室/.test(org + title)) return 'province'
      return 'city'
    }
    const isNationalOrg = /国家自然科学基金委员会|全国哲学社会科学工作办公室|全国艺术科学规划|科学技术部|科技部/.test(org)
    if (isNationalOrg) {
      return /重点研发|重大专项|重大研究计划|杰出青年|优秀青年|创新研究群体|重点支持/.test(title)
        ? 'national-top' : 'national'
    }
    if (/教育部|住房和城乡建设部|住建部|自然资源部|文化和旅游部/.test(org)) return 'ministry'
    if (/学会|协会|研究会/.test(org)) return 'society'
    if (/教育厅/.test(org)) return 'city'
    if (/^西安市|西安市/.test(org)) return 'city'
    if (/省|自治区|直辖市/.test(org)) return 'province'
    return 'province'
  }

  if (t === 'award') {
    if (/国家科学技术奖励|国家自然科学奖|国家技术发明奖|国家科技进步奖|国家级教学成果奖/.test(org + title)) return 'national-top'
    // 中国生态文明奖是经中央批准的正式表彰项目，享受省部级表彰待遇
    if (/生态文明奖|人居范例奖|环境保护模范/.test(title)) return 'province'
    if (/省.*科学技术奖|省.*社科|优秀成果奖/.test(title) || /省科学技术厅/.test(org)) return 'province'
    // 教学口与学位口的省级奖：教学成果奖、教学名师、优秀博士学位论文、优秀学术论文
    // 都由省教育厅/省科协评，属省部级，不能按「行业奖」算
    if (/教学成果奖|教学名师|优秀博士学位论文|优秀学术论文/.test(title)) return 'province'
    if (/学会|建筑科学研究院|土木工程学会/.test(org)) return 'society'
    return 'industry'
  }

  if (t === 'special') {
    for (let i = 0; i < JOURNAL_MAP.length; i++) {
      if (JOURNAL_MAP[i].re.test(org + title)) return JOURNAL_MAP[i].key
    }
    return 'other'
  }

  if (t === 'conference') {
    if (/ICUC|IAUC|International|国际城市气候|国际研讨会|国际会议/.test(org + title)) return 'intl-top'
    // 只有「专业委员会」主办的才算专委会议；学会分会、教指委办的仍是全国性会议
    if (/专业委员会/.test(org)) return 'committee'
    return 'national-top'
  }

  if (t === 'competition') {
    if (/挑战杯」?陕西省|陕西省.*挑战杯|省级/.test(title)) return 'province'
    // 省教育厅主办的教师教学竞赛：省赛，不是国家 A 类学科竞赛
    if (/陕西省.*教学竞赛|陕西省.*大赛|青年教师教学竞赛/.test(title)) return 'province'
    return 'national-a'
  }

  if (t === 'talent') {
    if (/杰出青年|长江学者|万人计划|三秦学者特聘/.test(title)) return 'national-top'
    if (/优秀青年|青年长江|青年拔尖|托举|青年科学基金/.test(title)) return 'national'
    return 'province'
  }

  if (t === 'position') {
    // 「青年编委 / 审稿专家招募」这种标题里同时出现编委与审稿，编委身份更重，先判
    if (/编委/.test(title)) {
      return /国际|英文刊|Guest|客座编辑/.test(org + title) ? 'intl' : 'core'
    }
    if (/审稿/.test(title)) return 'reviewer'
    // 国内刊先判，避免「国际城市规划」被误当成国际期刊
    if (/国际城市规划|中国园林|建筑学报|城市规划学刊/.test(org + title)) return 'core'
    if (/委员|理事|工作委员会/.test(title)) return 'society'
    if (/客座编辑|Guest|国际期刊|Architecture|Systems|MDPI|LAS|风景园林与可持续发展|英文刊/.test(org + title)) return 'intl'
    return 'core'
  }

  if (t === 'standard') {
    // 科研政策/办法/改革类征求意见，归到 policy；其余按发布层级定档
    if (/政策|办法|改革|破五唯|包干制|评价改革|经费管理/.test(org + title)) return 'policy'
    if (/国家|国标|工程建设强制性|全国/.test(org + title)) return 'national'
    if (/部/.test(org)) return 'ministry'
    return 'province'
  }

  if (t === 'license') {
    // 注册执业资格多为国家级统考；省级组织的考试/认定降一档
    if (/注册城乡规划师|注册建筑师|注册结构|注册设备|注册咨询|注册环保|注册测绘|注册土木|注册岩土|注册电气/.test(org + title)) return 'national'
    return 'provincial'
  }

  if (t === 'postdoc') {
    if (/博新|创新人才支持计划|特别资助/.test(org + title)) return 'national'
    if (/国际|境外|中外|香江|澳门|海峡/.test(org + title)) return 'exchange'
    return 'general'
  }

  if (t === 'visit') {
    if (/国家留学基金委|CSC|公派/.test(org + title)) return 'national'
    return 'provincial'
  }

  if (t === 'review') {
    if (/国家|全国|跨地区|互认/.test(org + title)) return 'national'
    if (/校|学院|单位|聘期|内部|校内/.test(org + title)) return 'institutional'
    return 'provincial'
  }

  if (t === 'student') {
    if (/国家/.test(org + title)) return 'national'
    return 'provincial'
  }
  if (t === 'growth') {
    // 先判省级：避免「省优秀勘察设计奖」因标题含「勘察设计」被国家级关键词误判
    if (/省级|省科协|省教|陕西省|省住房和城乡建设|省优秀/.test(org + title)) return 'province'
    // 国家级培养/资助 或 行业国家级小称号/试点
    if (/教学创新大赛|青年人才托举|产学合作协同育人|一流本科课程|课程思政.*示范|黄大年式|虚拟教研室|华夏建设科技|绿色建筑创新|勘察设计|茅以升|土木工程学会|青年建筑师|青年工程师|教材|住房和城乡建设部|城市更新|智能建造|装配式/.test(org + title)) return 'national'
    return 'city'
  }


  return 'province'
}

// 返回：{ key, name, short, tone, weight, use, label }
function of (n) {
  const pool = POOLS[n.type] || PROJECT
  const key = n.rankOverride || classifyKey(n)
  const r = pool[key] || pool.province || PROJECT.province
  let label = ''
  if (n.type === 'special') {
    for (let i = 0; i < JOURNAL_MAP.length; i++) {
      if (JOURNAL_MAP[i].re.test((n.org || '') + (n.title || ''))) { label = JOURNAL_MAP[i].label; break }
    }
  }
  return {
    key: key,
    name: r.name,
    short: r.short,
    tone: r.tone,
    weight: r.weight,
    use: r.use,
    eg: r.eg || '',
    label: label
  }
}

// 同类型的等级序列，用于详情页「同级参照」
function ladder (type) {
  const pool = POOLS[type] || PROJECT
  const arr = []
  Object.keys(pool).forEach(function (k) {
    arr.push(Object.assign({ key: k }, pool[k]))
  })
  arr.sort(function (a, b) { return b.weight - a.weight })
  return arr
}

module.exports = { of: of, ladder: ladder, classifyKey: classifyKey, POOLS: POOLS }
