// utils/official.js
// 官方来源分三级，能多准就多准，绝不拿首页冒充栏目页：
//   notice  —— 本条通知的原文页（最理想，点开就是它）
//   section —— 该机构对应的「通知公告」栏目列表（能翻到这条）
//   home    —— 只到机构首页（再往里就得自己点）
// 每个栏目的地址都经过 HTTP 实测（tools/probe_official*.js），
// 没实测过的机构只给首页，不写猜测的路径。

const SITES = [
  // ---------- 国家级部委 ----------
  {
    re: /国家自然科学基金委员会/,
    name: '国家自然科学基金委员会',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.nsfc.gov.cn'
  },
  {
    re: /全国哲学社会科学工作办公室/,
    name: '全国哲学社会科学工作办公室',
    section: '通知公告',
    sectionUrl: 'http://www.nopss.gov.cn/GB/219469/index.html',
    home: 'http://www.nopss.gov.cn'
  },
  {
    re: /艺术科学规划/,
    name: '全国艺术科学规划领导小组办公室（文化和旅游部科技教育司）',
    section: '科技教育司',
    sectionUrl: 'https://www.mct.gov.cn/whzx/bnsj/whkjs/',
    home: 'https://www.mct.gov.cn'
  },
  {
    re: /科学技术部|科技部/,
    name: '中华人民共和国科学技术部',
    section: '通知通告',
    sectionUrl: 'https://www.most.gov.cn/tztg/',
    home: 'https://www.most.gov.cn'
  },
  {
    re: /生态环境部/,
    name: '中华人民共和国生态环境部',
    section: '表彰奖励',
    sectionUrl: '',
    home: 'https://www.mee.gov.cn'
  },
  {
    re: /住房和城乡建设部|住房城乡建设部/,
    name: '住房和城乡建设部',
    section: '政策文件库',
    sectionUrl: '',
    home: 'https://www.mohurd.gov.cn'
  },
  {
    re: /教育部学位与研究生教育发展中心/,
    name: '教育部学位与研究生教育发展中心',
    section: '',
    sectionUrl: '',
    home: 'https://www.cdgdc.edu.cn'
  },
  {
    // 排除「教育部重点实验室」这类平台名：它不是部机关发文，别把实验室的公告指到 moe.gov.cn
    re: /教育部(?!重点实验室)/,
    name: '中华人民共和国教育部',
    section: '工作动态',
    sectionUrl: 'http://www.moe.gov.cn/jyb_xwfb/gzdt_gzdt/',
    home: 'http://www.moe.gov.cn'
  },
  {
    re: /中国科协|中国科学技术协会/,
    name: '中国科学技术协会',
    section: '新闻',
    sectionUrl: 'https://www.cast.org.cn/xw/index.html',
    home: 'https://www.cast.org.cn'
  },
  {
    re: /共青团陕西省委|共青团中央/,
    name: '共青团陕西省委',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.sxgqt.org.cn'
  },

  // ---------- 陕西省厅局（这类才是青椒日常最常报的） ----------
  {
    re: /陕西省科学技术厅|陕西省科技厅/,
    name: '陕西省科学技术厅',
    section: '通知公告',
    sectionUrl: 'https://kjt.shaanxi.gov.cn/kjdt/tzgg/',
    home: 'https://kjt.shaanxi.gov.cn'
  },
  {
    re: /陕西省教育厅/,
    name: '陕西省教育厅',
    section: '公示公告',
    sectionUrl: 'https://jyt.shaanxi.gov.cn/gk/fdnr/gsgggk/',
    home: 'https://jyt.shaanxi.gov.cn'
  },
  {
    re: /陕西省社会科学界联合会|陕西省社科联/,
    name: '陕西省社会科学界联合会',
    section: '通知公告',
    sectionUrl: 'http://www.sxsskw.org.cn/sy2/tzgg2/',
    home: 'http://www.sxsskw.org.cn'
  },
  {
    re: /陕西省哲学社会科学工作办公室/,
    name: '陕西省哲学社会科学工作办公室',
    section: '通知公告',
    sectionUrl: 'http://www.sxsskw.org.cn/sy2/tzgg2/',
    home: 'http://www.sxsskw.org.cn'
  },
  {
    re: /陕西省生态环境厅/,
    name: '陕西省生态环境厅',
    section: '通知公告',
    sectionUrl: 'https://sthjt.shaanxi.gov.cn/sy/tzgg/',
    home: 'https://sthjt.shaanxi.gov.cn'
  },
  {
    re: /陕西省人力资源和社会保障厅|陕西省人社厅/,
    name: '陕西省人力资源和社会保障厅',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://rst.shaanxi.gov.cn'
  },
  {
    re: /陕西省住房和城乡建设厅|陕西省住建厅/,
    name: '陕西省住房和城乡建设厅',
    section: '公告公示',
    sectionUrl: 'https://js.shaanxi.gov.cn/sy/zcwj/gsgg/',
    home: 'https://js.shaanxi.gov.cn'
  },
  {
    re: /西安市住房和城乡建设局|西安市住建局/,
    name: '西安市住房和城乡建设局',
    section: '最新通知',
    sectionUrl: 'http://zjj.xa.gov.cn/zw/zfxxgkml/zwxx/zxtz/1.html',
    home: 'http://zjj.xa.gov.cn'
  },
  {
    re: /陕西省发展和改革委员会|陕西省发改委/,
    name: '陕西省发展和改革委员会',
    section: '公告公示',
    sectionUrl: 'https://sndrc.shaanxi.gov.cn/sy/xwxx/gggg/',
    home: 'https://sndrc.shaanxi.gov.cn'
  },
  {
    // 省科协官网对本机 UA 返回 403，栏目地址探测不到，只给首页，不给假路径
    re: /陕西省科学技术协会|陕西省科协/,
    name: '陕西省科学技术协会',
    section: '',
    sectionUrl: '',
    home: 'http://www.sxkx.org.cn'
  },
  {
    re: /陕西省自然资源厅/,
    name: '陕西省自然资源厅',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://zrzyt.shaanxi.gov.cn'
  },
  {
    re: /自然资源部/,
    name: '自然资源部',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.mnr.gov.cn'
  },
  {
    re: /国家林业和草原局|国家林草局/,
    name: '国家林业和草原局',
    section: '公告公示',
    sectionUrl: '',
    home: 'https://www.forestry.gov.cn'
  },
  {
    re: /中共陕西省委组织部|陕西省委组织部|省委人才办/,
    name: '中共陕西省委组织部（省委人才办）',
    section: '',
    sectionUrl: '',
    home: ''
  },
  {
    re: /西安市社会科学规划基金办公室|西安市社会科学院|西安市社会科学界联合会/,
    name: '西安市社会科学院（西安社科网 · 市社科规划办）',
    section: '',
    sectionUrl: '',
    // 2026-11-01 实测：首页标题「西安社科网 西安市社会科学院 西安市社会科学界联合会」
    home: 'http://www.xass.org.cn'
  },
  {
    re: /陕西省文化和旅游厅|省艺术基金管理中心/,
    name: '陕西省文化和旅游厅',
    section: '',
    sectionUrl: '',
    home: 'https://whhlyt.shaanxi.gov.cn'
  },
  {
    re: /陕西省气象局/,
    name: '陕西省气象局',
    section: '',
    sectionUrl: '',
    home: 'http://sn.cma.gov.cn'
  },
  {
    re: /西安市科学技术局/,
    name: '西安市科学技术局',
    section: '',
    sectionUrl: '',
    // 官网首页可打开；栏目页曾被 WAF 拦过，所以只给首页，不编栏目路径
    home: 'http://xakj.xa.gov.cn'
  },
  {
    re: /咸阳市科学技术局/,
    name: '咸阳市科学技术局',
    section: '',
    sectionUrl: '',
    home: 'http://kjj.xianyang.gov.cn'
  },

  // ---------- 全国开放基金 / 重点实验室（2026-11-01 实测首页） ----------
  {
    re: /亚热带建筑科学国家重点实验室/,
    name: '亚热带建筑科学国家重点实验室（华南理工大学）',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.scut.edu.cn'
  },
  {
    re: /西部绿色建筑国家重点实验室/,
    name: '西部绿色建筑国家重点实验室（西安建筑科技大学）',
    section: '',
    sectionUrl: '',
    home: 'https://www.xauat.edu.cn'
  },
  {
    re: /山地城镇建设与新技术教育部重点实验室/,
    name: '山地城镇建设与新技术教育部重点实验室（重庆大学）',
    section: '',
    sectionUrl: '',
    home: 'https://www.cqu.edu.cn'
  },
  {
    re: /城市与区域生态国家重点实验室/,
    name: '城市与区域生态国家重点实验室（中科院生态环境研究中心）',
    section: '',
    sectionUrl: '',
    home: 'http://www.rcees.ac.cn'
  },
  {
    re: /城市气象重点开放实验室/,
    name: '中国气象局城市气象重点开放实验室（北京城市气象研究院）',
    section: '',
    sectionUrl: '',
    home: 'https://www.ium.cn'
  },
  {
    re: /环境模拟与污染控制国家重点实验室/,
    name: '环境模拟与污染控制国家重点实验室（北大 / 清华 / 北师大联合，分室评审）',
    section: '',
    sectionUrl: '',
    home: ''
  },
  {
    re: /建筑安全与环境国家重点实验室/,
    name: '建筑安全与环境国家重点实验室（中国建筑科学研究院）',
    section: '',
    sectionUrl: '',
    // 本机访问建研院域名失败，按规矩不给地址，只给检索式
    home: ''
  },

  // ---------- 学会 ----------
  {
    re: /中国城市规划学会/,
    name: '中国城市规划学会',
    section: '学会资讯',
    sectionUrl: 'https://www.planning.org.cn/news/',
    home: 'https://www.planning.org.cn'
  },
  {
    re: /中国建筑学会|建筑数字技术教学工作委员会|全国高校建筑学学科专业指导委员会/,
    name: '中国建筑学会',
    section: '通知公告',
    sectionUrl: 'https://www.chinaasc.org.cn/news/tongzhigonggao/',
    home: 'https://www.chinaasc.org.cn'
  },
  {
    re: /中国风景园林学会/,
    name: '中国风景园林学会',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.chsla.org.cn'
  },
  {
    re: /中国城市科学研究会/,
    name: '中国城市科学研究会',
    section: '',
    sectionUrl: '',
    home: 'https://www.chinasus.org'
  },
  {
    re: /中国环境科学学会/,
    name: '中国环境科学学会',
    section: '',
    sectionUrl: '',
    home: 'https://www.chinacses.org'
  },
  {
    re: /中国气象学会/,
    name: '中国气象学会',
    section: '',
    sectionUrl: '',
    home: 'https://www.cms1924.org'
  },
  {
    re: /中国气象局/,
    name: '中国气象局',
    section: '',
    sectionUrl: '',
    home: 'https://www.cma.gov.cn'
  },
  {
    re: /中国地理学会/,
    name: '中国地理学会',
    section: '',
    sectionUrl: '',
    home: 'https://www.gsc.org.cn'
  },
  {
    re: /中国生态学学会/,
    name: '中国生态学学会',
    section: '',
    sectionUrl: '',
    home: 'https://www.esc.org.cn'
  },
  {
    re: /中国土木工程学会/,
    name: '中国土木工程学会',
    section: '',
    sectionUrl: '',
    home: 'http://www.cces.net.cn'
  },
  {
    re: /陕西省城市规划协会/,
    name: '陕西省城市规划协会',
    section: '',
    sectionUrl: '',
    home: ''
  },

  // ---------- 国际组织 ----------
  {
    re: /国际城市气候学会|IAUC/,
    name: '国际城市气候学会 IAUC',
    section: '',
    sectionUrl: '',
    home: 'https://www.urban-climate.org'
  },
  {
    re: /国际建筑师协会|UIA/,
    name: '国际建筑师协会 UIA',
    section: '',
    sectionUrl: '',
    home: 'https://www.uia-architectes.org'
  },

  // ---------- 期刊 ----------
  { re: /建筑学报/, name: '《建筑学报》编辑部（中国建筑学会主办）', section: '', sectionUrl: '', home: 'https://www.chinaasc.org.cn' },
  { re: /城市规划学刊/, name: '《城市规划学刊》编辑部（同济大学主办）', section: '', sectionUrl: '', home: 'https://caup.tongji.edu.cn' },
  { re: /中国园林/, name: '《中国园林》编辑部', section: '', sectionUrl: '', home: 'http://www.jchla.com' },
  { re: /装饰杂志|《装饰》/, name: '《装饰》杂志社（清华大学主办）', section: '', sectionUrl: '', home: 'http://www.izhsh.com.cn' },
  { re: /国际城市规划/, name: '《国际城市规划》编辑部', section: '', sectionUrl: '', home: '' },
  { re: /景观设计学|Landscape Architecture/, name: '《景观设计学》编辑部', section: '', sectionUrl: '', home: '' },
  { re: /城市发展研究/, name: '《城市发展研究》编辑部（中国城市科学研究会主办）', section: '', sectionUrl: '', home: 'https://www.chinasus.org' },
  { re: /西部人居环境学刊/, name: '《西部人居环境学刊》编辑部', section: '', sectionUrl: '', home: '' },
  { re: /风景园林与可持续发展|LAS/, name: '《风景园林与可持续发展》（LAS）编辑部', section: '', sectionUrl: '', home: '' },

  // ---------- 竞赛 ----------
  { re: /清华大学美术学院/, name: '清华大学美术学院（学年奖承办）', section: '', sectionUrl: '', home: 'https://www.ad.tsinghua.edu.cn' },
  { re: /园冶杯|中国风景园林网/, name: '园冶杯组委会 / 中国风景园林网', section: '', sectionUrl: '', home: 'http://www.chla.com.cn' },
  { re: /人居环境设计学年奖|亚洲人居环境/, name: '中国人居环境设计学年奖组委会', section: '', sectionUrl: '', home: '' },
  { re: /天津大学/, name: '天津大学建筑学院', section: '', sectionUrl: '', home: 'http://arch.tju.edu.cn' },

  // ---------- 本轮新增类目机构：博士后 / 访学 / 标准 / 考试 ----------
  {
    re: /全国博士后管理委员会|中国博士后科学基金会|博士后科学基金/,
    name: '全国博士后管理委员会 / 中国博士后科学基金会',
    section: '通知公告',
    sectionUrl: '',
    home: 'https://www.chinapostdoctor.org.cn'
  },
  {
    re: /国家留学基金委|国家留学网|公派留学|出国留学人员/,
    name: '国家留学基金委（国家留学网）',
    section: '申报指南',
    sectionUrl: '',
    home: 'https://www.csc.edu.cn'
  },
  {
    re: /人力资源和社会保障部|人力资源社会保障部/,
    name: '人力资源和社会保障部',
    section: '专业技术人员管理',
    sectionUrl: '',
    home: 'https://www.mohrss.gov.cn'
  },
  {
    re: /中国工程建设标准化协会|CECS|工程建设标准化/,
    name: '中国工程建设标准化协会（CECS）',
    section: '',
    sectionUrl: '',
    home: 'http://www.cecs.org.cn'
  },
  {
    re: /中国人事考试网|人事考试中心|资格考试/,
    name: '中国人事考试网',
    section: '',
    sectionUrl: '',
    home: 'http://www.cpta.com.cn'
  },
  {
    re: /中国教育在线|学术桥/,
    name: '中国教育在线 · 学术桥',
    section: '',
    sectionUrl: '',
    home: 'https://www.acabridge.cn'
  },
  {
    re: /中国高等教育学会|高等教育司/,
    name: '中国高等教育学会（教育部高等教育司业务主管）',
    section: '通知公告',
    sectionUrl: '',
    home: 'http://www.cahe.edu.cn'
  }
]

// 判断一个地址是不是「站点首页」——首页不能当通知页用
function isRoot (url) {
  if (!url) return true
  return /^https?:\/\/[^/]+\/?$/.test(url) || /^https?:\/\/[^/]+\/(index|default)\.\w+$/i.test(url)
}

// 判断是不是「一篇具体的文章」而不是栏目列表。
// 政府站的栏目页多以 / 结尾，正文页多为 .html / .shtml 或带 id 参数。
function isArticle (url) {
  if (!url || isRoot(url)) return false
  if (/\/$/.test(url)) return false
  if (/\.(html?|shtml|jsp|php|aspx|pdf)(\?|$)/i.test(url)) return true
  if (/[?&](id|aid|contentid|infoid|articleid)=/i.test(url)) return true
  return false
}

function hostOf (url) {
  const m = String(url || '').match(/^https?:\/\/([^/]+)/)
  return m ? m[1] : ''
}

// 兜底检索：只有栏目、没有原文时，给一条能直接落到「这篇通知」的搜索链接
function searchUrlOf (n, site) {
  const host = hostOf((site && (site.sectionUrl || site.home)) || '')
  const kw = String((n && n.title) || '').replace(/[（(【\[].*?[）)】\]]/g, ' ').trim().slice(0, 24)
  if (!kw) return ''
  return 'https://www.baidu.com/s?wd=' + encodeURIComponent(host ? 'site:' + host + ' ' + kw : kw)
}

function siteOf (n) {
  if (!n) return null
  const text = (n.org || '') + ' ' + (n.title || '')
  let s = null
  for (let i = 0; i < SITES.length; i++) {
    if (SITES[i].re.test(text)) { s = SITES[i]; break }
  }

  const base = s || { name: n.org || '发布机构', section: '', sectionUrl: '', home: '' }
  const raw = n.sourceUrl || ''

  // 三级判定：原文 > 栏目 > 首页
  // 注意：sourceUrl 有时填的是栏目地址（以 / 结尾），那不是「原文」，要降级为栏目
  let level = ''
  let url = ''
  if (isArticle(raw)) {
    level = 'notice'
    url = raw
  } else if (base.sectionUrl) {
    level = 'section'
    url = base.sectionUrl
  } else if (raw && !isRoot(raw)) {
    level = 'section'
    url = raw
  } else if (base.home || raw) {
    level = 'home'
    url = base.home || raw
  }

  return {
    name: base.name,
    section: base.section || '',
    level: level,
    url: url,
    // 兼容旧字段
    noticeUrl: level === 'notice' ? raw : '',
    officialUrl: base.home || '',
    hasUrl: !!url,
    searchUrl: level === 'notice' ? '' : searchUrlOf(n, base),
    // 一句话说清这条链接通到哪
    label: level === 'notice'
      ? '这条通知的原文页'
      : (level === 'section'
          ? base.name + (base.section ? ' › ' + base.section : '')
          : (level === 'home' ? base.name + ' 官网首页' : ''))
  }
}

module.exports = { siteOf: siteOf, isRoot: isRoot, isArticle: isArticle, SITES: SITES }
