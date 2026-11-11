// pages/fund/fund.js
// 「基金立项检索」tab：国社科 1991-2026 + 教育部人文社科 2020-2026 + 国自然 2017-2026。
// 数据在 GitHub Pages 分片上（见 utils/fund_data.js），按年份/基金按需下载；
// 线上未就绪时自动降级到内置兜底分包（packages/funddata + packages/nsfcdata）。
// 「统计」视图：学科分布条形图 + 立项单位 Top 榜 + 年度趋势（全库预计算，见 stats.json）。
const fundData = require('../../utils/fund_data.js')

const PAGE_SIZE = 20
const FUND_OPTIONS = [
  { key: 'all', label: '全部' },
  { key: 'nssf', label: '国社科' },
  { key: 'moe', label: '教育部' },
  { key: 'nsfc', label: '国自然' }
]
// 学科/类别下拉跟随基金切换（三家的学科与类别口径不一样，不能混）
const FUND_STATS_LABEL = { nssf: '国社科（1991-2026）', moe: '教育部（2020-2026）', nsfc: '国自然（2017-2026）' }

Page({
  data: {
    viewMode: 'search',   // search | stats
    fundOptions: FUND_OPTIONS,
    fund: 'all',
    // 年份下拉
    yearOptions: fundData.YEAR_OPTIONS,
    yearLabels: fundData.YEAR_OPTIONS.map(function (o) { return o.label }),
    yearIdx: 0,       // 默认 2026（数据最新）
    yearKey: '2026',
    // 学科 / 类别下拉（选项来自统计，线上或兜底）
    discLabels: ['全部学科'],
    discIdx: 0,
    disc: '',
    catLabels: ['全部类别'],
    catIdx: 0,
    cat: '',
    q: '',
    rows: [],
    total: 0,
    done: false,
    loading: false,
    hasMore: false,
    error: '',
    statusText: '',
    totalAll: 0,
    // 统计视图
    statsFund: 'nssf',
    statsDiscs: [],   // [{k,v,pct}]
    statsOrgs: [],    // [{k,v,pct}]
    statsKws: [],     // [{k,v,pct}] 课题名关键词 Top
    statsKwsRecent: [], // [{k,v,pct}] 近三年热点词
    statsRecentSpan: '',
    statsYears: [],   // [{y,v,pct}]
    statsYearsSpan: '',
    statsEarly: 0,
    statsLoading: false,
    kwSheetShow: false,   // 关键词「更多」弹层
    kwSheetTitle: '',
    kwSheetList: []
  },

  _all: [],   // 当前筛选条件下的全量结果（内存中分页）
  _stats: null,

  onLoad () {
    const tb = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tb) tb.setData({ selected: 2 })
    this.initIndex()
    this.doSearch()
  },

  // 词表 + 总条数：优先线上 stats.json，失败走兜底分包回填。
  // 学科/类别词表按基金分开存（三套口径不同），onFund 切换下拉。
  initIndex () {
    const self = this
    fundData.loadStats().then(function (s) {
      const vocab = { all: { discs: [], cats: [] } }
      let totalAll = 0
      const seenD = {}
      const seenC = {}
      for (const f in s) {
        totalAll += s[f].total || 0
        const discs = []
        const cats = []
        ;(s[f].discs || []).forEach(function (p) {
          if (p[0] && !seenD[f + p[0]]) { seenD[f + p[0]] = 1; discs.push(p[0]) }
        })
        ;(s[f].cats || []).forEach(function (p) {
          if (p[0] && !seenC[f + p[0]]) { seenC[f + p[0]] = 1; cats.push(p[0]) }
        })
        vocab[f] = { discs: discs, cats: cats }
        vocab.all.discs.push.apply(vocab.all.discs, discs)
        vocab.all.cats.push.apply(vocab.all.cats, cats)
      }
      self._vocab = vocab
      self.setData({ totalAll: totalAll || fundData.localTotal() })
      self.applyVocab()
    }).catch(function () {
      self.setData({ totalAll: fundData.localTotal() })
    })
  },

  // 按当前基金筛选刷新学科/类别下拉（选项来自该基金自己的统计词表）
  applyVocab () {
    const v = this._vocab && this._vocab[this.data.fund]
    const discs = v ? v.discs : []
    const cats = v ? v.cats : []
    this.setData({
      discLabels: ['全部学科'].concat(discs),
      catLabels: ['全部类别'].concat(cats),
      discIdx: 0,
      disc: '',
      catIdx: 0,
      cat: ''
    })
  },

  onShow () {
    const tb = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tb) tb.setData({ selected: 2 })
  },

  /* 视图切换：检索 / 统计 */
  switchView (e) {
    const m = e.currentTarget.dataset.m
    if (!m || m === this.data.viewMode) return
    this.setData({ viewMode: m })
    if (m === 'stats') this.loadStats()
  },

  /* 统计视图 */
  loadStats () {
    const self = this
    if (this.data.statsLoading) return
    this.setData({ statsLoading: true })
    fundData.loadStats().then(function (s) {
      self._stats = s
      self.applyStats()
      self.setData({ statsLoading: false })
    }).catch(function (e) {
      self.setData({
        statsLoading: false,
        statusText: '统计数据加载失败：' + (e.message || '网络异常')
      })
    })
  },

  applyStats () {
    const s = this._stats
    if (!s) return
    const f = s[this.data.statsFund]
    if (!f) return

    // 学科条形图：取 Top15，宽度按占第一名的比例
    const discs = (f.discs || []).slice(0, 15)
    const dMax = discs.length ? discs[0][1] : 1
    const statsDiscs = discs.map(function (p) {
      return { k: p[0], v: p[1], pct: Math.round(p[1] / dMax * 100) }
    })

    // 单位 Top20
    const orgs = (f.orgs || []).slice(0, 20)
    const oMax = orgs.length ? orgs[0][1] : 1
    const statsOrgs = orgs.map(function (p) {
      return { k: p[0], v: p[1], pct: Math.round(p[1] / oMax * 100) }
    })

    // 关键词学科切换 chips：全库 + 各学科/学部（按课题数从多到少，与学科图同序）
    const hasDiscKws = !!(f.discKws && Object.keys(f.discKws).length)
    const statsKwDiscs = hasDiscKws
      ? ['全库'].concat((f.discs || []).filter(function (p) { return f.discKws[p[0]] }).map(function (p) { return p[0] }))
      : []

    // 年度趋势：2011 年起竖条，更早的汇总
    const years = (f.years || [])
    const recent = years.filter(function (p) { return p[0] >= 2011 })
    const early = years
      .filter(function (p) { return p[0] < 2011 })
      .reduce(function (a, p) { return a + p[1] }, 0)
    const yMax = Math.max.apply(null, recent.map(function (p) { return p[1] }).concat([1]))
    const statsYears = recent.map(function (p) {
      return { y: p[0], v: p[1], pct: Math.max(4, Math.round(p[1] / yMax * 100)) }
    })

    this.setData({
      statsDiscs: statsDiscs,
      statsOrgs: statsOrgs,
      statsKwDiscs: statsKwDiscs,
      statsKwDiscIdx: 0,
      statsKwDisc: '',
      statsYears: statsYears,
      statsYearsSpan: recent.length ? (recent[0][0] + '-' + recent[recent.length - 1][0]) : '',
      statsEarly: early
    })
    this.renderKwCards()
  },

  // 当前关键词数据源：选了学科 → 该学科榜单；没选 → 全库榜单
  kwSource () {
    const f = this._stats && this._stats[this.data.statsFund]
    if (!f) return null
    const d = this.data.statsKwDisc
    if (d && f.discKws && f.discKws[d]) return f.discKws[d]
    return f
  },

  // 渲染两张关键词卡（Top20 榜 + 近三年热点），随所选学科刷新
  renderKwCards () {
    const src = this.kwSource()
    if (!src) return
    const f = this._stats[this.data.statsFund]

    const kws = (src.kws || []).slice(0, 20)
    const kMax = kws.length ? kws[0][1] : 1
    const statsKws = kws.map(function (p) {
      return { k: p[0], v: p[1], pct: Math.round(p[1] / kMax * 100) }
    })

    const rs = f.recentSpan || []
    const rws = (src.kwsRecent || []).slice(0, 20)
    const rMax = rws.length ? rws[0][1] : 1
    const statsKwsRecent = rws.map(function (p) {
      return { k: p[0], v: p[1], pct: Math.round(p[1] / rMax * 100) }
    })
    const statsRecentSpan = rs.length === 2 ? (rs[0] + '-' + rs[1]) : '近三年'

    this.setData({
      statsKws: statsKws,
      statsKwsRecent: statsKwsRecent,
      statsRecentSpan: statsRecentSpan
    })
  },

  // 关键词卡上的学科/学部切换
  onKwDiscTap (e) {
    const i = parseInt(e.currentTarget.dataset.i, 10)
    const name = this.data.statsKwDiscs[i]
    if (name === undefined) return
    this.setData({
      statsKwDiscIdx: i,
      statsKwDisc: i === 0 ? '' : name
    })
    this.renderKwCards()
  },

  // 关键词「更多」弹层：展示当前基金 + 所选学科的全部词表
  onKwMore () {
    const src = this.kwSource()
    const all = (src && src.kws) || []
    if (!all.length) return
    const max = all[0][1] || 1
    const disc = this.data.statsKwDisc
    const scope = disc ? (FUND_STATS_LABEL[this.data.statsFund] + ' · ' + disc) : FUND_STATS_LABEL[this.data.statsFund]
    const n = all.length >= 200 ? 200 : all.length
    this.setData({
      kwSheetShow: true,
      kwSheetTitle: scope + ' · 关键词 Top ' + n,
      kwSheetList: all.map(function (p) {
        return { k: p[0], v: p[1], pct: Math.round(p[1] / max * 100) }
      })
    })
  },

  closeKwSheet () {
    this.setData({ kwSheetShow: false })
  },

  // 弹层里点词 → 关弹层，切回检索视图直接搜
  onKwSheetTap (e) {
    const w = e.currentTarget.dataset.w
    if (!w) return
    this.setData({ kwSheetShow: false, viewMode: 'search', q: w })
    this.doSearch()
  },

  noop () {},

  // 点关键词 → 切回检索视图并直接搜
  onKwTap (e) {
    const w = e.currentTarget.dataset.w
    if (!w) return
    this.setData({ viewMode: 'search', q: w })
    this.doSearch()
  },

  onStatsFund (e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.statsFund) return
    this.setData({ statsFund: k })
    this.applyStats()
  },

  /* 检索交互 */
  onQ (e) {
    this.setData({ q: e.detail.value })
  },

  onFund (e) {
    const k = e.currentTarget.dataset.k
    if (k === this.data.fund) return
    this.setData({ fund: k })
    // 基金口径变了，学科/类别下拉跟着换（三套词表不同），已选值清零
    this.applyVocab()
    this.doSearch()
  },

  onYear (e) {
    const i = parseInt(e.detail.value, 10)
    const o = this.data.yearOptions[i]
    if (!o) return
    this.setData({ yearIdx: i, yearKey: o.key })
    this.doSearch()
  },

  onDisc (e) {
    const i = parseInt(e.detail.value, 10)
    this.setData({
      discIdx: i,
      disc: i === 0 ? '' : this.data.discLabels[i]
    })
    this.doSearch()
  },

  onCat (e) {
    const i = parseInt(e.detail.value, 10)
    this.setData({
      catIdx: i,
      cat: i === 0 ? '' : this.data.catLabels[i]
    })
    this.doSearch()
  },

  /* 检索 */
  doSearch () {
    const self = this
    if (this.data.loading) return
    const q = this.data.q
    if (this.data.yearKey === 'all' && !q.trim()) {
      this.setData({
        error: '',
        statusText: '选「全部年份」时请先输入关键词（避免一次下载 14MB 数据）',
        rows: [],
        total: 0,
        done: false,
        hasMore: false
      })
      return
    }

    this.setData({
      loading: true,
      error: '',
      statusText: '正在检索（首次查询某年份需下载对应数据分片）…',
      done: false
    })

    fundData.search({
      q: q,
      fund: this.data.fund,
      year: this.data.yearKey,
      disc: this.data.disc,
      cat: this.data.cat
    }).then(function (r) {
      self._all = r.items || []
      const page = fundData.pageSlice(self._all, 1, PAGE_SIZE)
      self.setData({
        loading: false,
        done: r.done,
        total: r.total,
        rows: page,
        hasMore: self._all.length > PAGE_SIZE,
        statusText: r.fallback ? '线上数据未就绪，已使用内置数据（国社科 2026 + 教育部 2025-2026）；其余年份待线上分片更新后可用' : ''
      })
    }).catch(function (e) {
      self.setData({
        loading: false,
        done: false,
        rows: [],
        total: 0,
        hasMore: false,
        statusText: '',
        error: e.code === 'NEED_Q' ? '' : ('数据加载失败：' + (e.message || '网络异常') + '（检查手机网络后点「重试」）')
      })
    })
  },

  loadMore () {
    const n = this.data.rows.length
    const next = fundData.pageSlice(this._all, Math.floor(n / PAGE_SIZE) + 1, PAGE_SIZE)
    this.setData({
      rows: this.data.rows.concat(next),
      hasMore: this._all.length > n + next.length
    })
  },

  onShareAppMessage () {
    return {
      title: '基金立项检索｜国社科+教育部人文社科 ' + (this.data.totalAll || 132625) + ' 条立项名单',
      path: '/pages/fund/fund'
    }
  }
})
