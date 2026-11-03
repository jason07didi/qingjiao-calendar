// 数据源配置。每个源只配「列表页地址 + 默认元数据 + 可信关键词」。
// spider 用通用启发式解析列表页（提取 <a> 标题/链接 + 附近日期），
// 所以无需为每个站点写专门解析器；部署后若某源解析不干净，可单独加白名单。
// ⚠️ 政府站点反爬/改版/TLS 风险真实存在：被墙或解析失败的源会被跳过并记录到 crawl_logs，
//    不会破坏已上线的云端数据。请部署后在云开发日志里逐个核对。
module.exports.SOURCES = [
  {
    id: 'mnr', name: '自然资源部', region: '国家', level: '国家级',
    type: 'project', disciplines: ['城乡规划', '环境科学', '生态学', '遥感', '地理学', '风景园林'],
    listUrl: 'https://www.mnr.gov.cn/gk/tzgg/', base: 'https://www.mnr.gov.cn'
  },
  {
    id: 'mohurd', name: '住房和城乡建设部', region: '国家', level: '国家级',
    type: 'project', disciplines: ['城乡规划', '建筑', '风景园林', '土木', '结构工程'],
    // 2026-11-03 实测：/wjfb/ 已 404；/zhengcefabu/ 与 /gongkai/.../bzgg/ 都是 JS 空壳（仅 6KB，列表靠 layui 动态渲染），
    // 静态抓取拿不到。改为抓首页，再用 excludeUrl 把 /xinwen/ 下的新闻稿剔掉（首页 38 条里大半是建设要闻/地方动态）。
    listUrl: 'https://www.mohurd.gov.cn/', base: 'https://www.mohurd.gov.cn',
    excludeUrl: /\/xinwen\//
  },
  {
    id: 'most', name: '科技部', region: '国家', level: '国家级',
    type: 'project', disciplines: ['环境科学', '遥感', '生态学', '社会科学'],
    listUrl: 'https://www.most.gov.cn/kjbgz/', base: 'https://www.most.gov.cn'
  },
  {
    id: 'mee', name: '生态环境部', region: '国家', level: '国家级',
    type: 'project', disciplines: ['环境科学', '生态学', '大气科学', '环境健康'],
    // 2026-11-03 实测：/xxgk2018/xxgk/ 返回空响应；/ywdt/gsgg/ 能抓但混满「建设项目环评审批公示」这类行政审批噪音，
    // 改抓「部文件」栏目（政策/通知为主），信号密度高得多。
    listUrl: 'https://www.mee.gov.cn/zcwj/bwj/', base: 'https://www.mee.gov.cn'
  },
  {
    id: 'cast', name: '中国科协（青年人才托举）', region: '国家', level: '国家级',
    type: 'talent', disciplines: ['城乡规划', '建筑', '环境科学', '社会科学'],
    listUrl: 'https://www.cast.org.cn/', base: 'https://www.cast.org.cn'
  },
  {
    id: 'sxkj', name: '陕西省科学技术厅', region: '陕西', level: '省级',
    type: 'project', disciplines: ['城乡规划', '建筑', '环境科学', '遥感', '生态学'],
    listUrl: 'https://kjt.shaanxi.gov.cn/', base: 'https://kjt.shaanxi.gov.cn'
  },
  {
    id: 'sxzr', name: '陕西省自然资源厅', region: '陕西', level: '省级',
    type: 'project', disciplines: ['城乡规划', '遥感', '地理学', '风景园林'],
    listUrl: 'https://zrzyt.shaanxi.gov.cn/', base: 'https://zrzyt.shaanxi.gov.cn'
  }
]

// 标题里出现这些词才视为「可能相关的通知」，过滤掉导航/页脚链接
module.exports.TRUST_KEYWORDS = [
  '通知', '公告', '申报', '征集', '招标', '基金', '项目', '计划', '截止',
  '评选', '奖励', '奖', '论坛', '会议', '培训', '招募', '开放', '资助', '课题'
]
