const api = require('../../utils/api.js')
const lib = require('../../utils/notices.js')
const D = require('../../utils/date.js')
const store = require('../../utils/store.js')
const EL = require('../../utils/eligibility.js')
const ads = require('../../utils/ads.js')
const filter = require('../../utils/filter.js')

const FROM_TEXT = {
  remote: '数据已同步',
  cloud: '实时数据',
  cache: '离线缓存',
  local: '本月更新'
}

const GOV = { national: '国家级', province: '省级', city: '市级' }

// 数据文件的生成时间（ISO，北京时间）→「11月3日 22:50」。
// 更新时间必须精确到分钟：只写日期会让用户以为「今天没更新」。
function isoTimeLabel (s) {
  if (!s) return ''
  const m = /(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(s))
  if (!m) return ''
  return parseInt(m[2], 10) + '月' + parseInt(m[3], 10) + '日 ' + m[4] + ':' + m[5]
}

Page({
  data: {
    types: lib.TYPES,
    curType: 'all',
    keyword: '',
    range: 'all',            // all | week | month
    groupBy: 'time',         // time | dis
    all: [],
    sections: [],
    past: [],
    pastOpen: false,
    stats: { week: 0, month: 0, total: 0, mine: 0 },
    alert: null,
    hidden: 0,
    hiddenTip: '',
    hasPrefs: false,
    moreOpen: false,
    isSubType: false,
    dayFilter: '',
    dayBanner: null,
    loading: true,
    from: '',
    fromText: '',
    updatedAt: ''
  },

  onLoad () {
    this.load(false)
  },

  onShow () {
    // 框架级 tabBar：切回来只改选中态，页面实例不销毁，不重新加载
    const tb = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tb) tb.setData({ selected: 0 })

    // 从日历点「看全部」跳过来时，带上要聚焦的那一天
    const pending = store.getPendingDay()
    let dayChanged = false
    if (pending) {
      store.clearPendingDay()
      if (this.data.dayFilter !== pending) { this.setData({ dayFilter: pending }); dayChanged = true }
    }

    if (!this._loaded) return
    const self = this
    // 只在收藏/已申报状态真的变了才重设列表。
    // 之前是无条件全量 setData + 重新分组，每次从详情返回都要重排上百条，
    // 视觉上就是整页闪一下——没变化就别动 DOM。
    let changed = false
    const all = this.data.all.map(function (i) {
      const fav = store.isFavorite(i.id)
      const app2 = store.isApplied(i.id)
      if (fav === i.isFav && app2 === i.isApplied) return i
      changed = true
      return Object.assign({}, i, { isFav: fav, isApplied: app2 })
    })
    if (changed) { this.setData({ all: all }, function () { self.applyFilter() }); return }
    if (dayChanged) { this.applyFilter(); return }
    // 顺手把下一条要用的激励视频预热好，点开时就不用等
    ads.preload()
  },

  onPullDownRefresh () {
    this.load(true)
  },

  load (force) {
    const self = this
    this.setData({ loading: true })
    api.getList({ force: force }).then(function (r) {
      self._loaded = true
      self.build(r.list, r.from, r.at, r.dataUpdatedAt, r.generatedAt)
      self.setData({ loading: false, from: r.from, fromText: (r.from === 'local') ? '本地数据 · 未连接云端' : (FROM_TEXT[r.from] || '') })
      wx.stopPullDownRefresh()

      // 静默后台刷新：秒开缓存后，再悄悄拉一次远程。
      // 拿到更新的数据（生成时间变了）就无缝重渲染，用户不用等、不用下拉。
      if (!force && typeof api.refreshRemote === 'function') {
        api.refreshRemote().then(function (r2) {
          if (!r2 || !r2.generatedAt) return
          if (r2.generatedAt === r.generatedAt) return
          self.build(r2.list, r2.from, r2.at, r2.dataUpdatedAt, r2.generatedAt)
          self.setData({ from: r2.from, fromText: FROM_TEXT[r2.from] || '' })
        })
      }
    }).catch(function () {
      const fallback = lib.getAll().map(function (n) {
        return Object.assign({}, n, { id: String(n.id) })
      })
      self.build(fallback, 'local', Date.now())
      self.setData({ loading: false, from: 'local', fromText: '本地数据 · 未连接云端' })
      wx.stopPullDownRefresh()
    })
  },

  // 把原始数据展开成卡片所需的全部字段（卡片要能自证「跟我有关」）
  build (raw, from, at, dataUpdatedAt, generatedAt) {
    const live = []
    const past = []

    for (let i = 0; i < raw.length; i++) {
      const n = raw[i]
      const d = D.daysLeft(n.deadline)
      const id = n.id !== undefined ? String(n.id) : String(i)
      const t = lib.TYPE_MAP[n.type]
      const el = EL.parse(n)
      const info = n.info || {}
      const amt = info.amount ? String(info.amount).split(/[，,]/)[0] : ''

      const item = {
        id: id,
        title: n.title || '（无标题）',
        org: n.org || '',
        region: n.region || '',
        audience: n.audience || '',
        regionShort: String(n.region || '').replace(/省$/, '').replace(/市$/, ''),
        type: n.type,
        typeName: t ? t.name : '',
        gov: n.level || 'national',
        govName: GOV[n.level] || '',
        rankName: n.rank ? n.rank.short : '',
        rankFull: n.rank ? n.rank.name : '',
        rankTone: n.rank ? n.rank.tone : 'gray',
        rankWeight: n.rank ? n.rank.weight : 0,
        deadlineShort: D.shortDate(n.deadline),
        deadlineText: n.deadlineText || n.deadline || '',
        days: d === null ? 9999 : d,
        cdLevel: D.level(d),
        // 学术岗这类常年招募的，说「常年」比说「待定」诚实
        tbdLabel: (n.type === 'position' && !n.deadline) ? '常年' : '待定',
        amountShort: amt,
        // 会议卡片要自证「值不值得跑一趟」：注册费、规模、有没有自己那块分论坛
        confLine: n.confLine || '',
        isConf: n.type === 'conference',
        confVenue: n.conf ? (n.conf.city || '') : '',
        dis: (n.disciplines || []).slice(0, 2),
        disAll: n.disciplines || [],
        fileCount: (n.files || []).length,
        hasDetail: (n.conditions || []).length > 0 || (n.files || []).length > 0,
        crawl: n.source === 'crawl',
        estimated: !!n.deadlineEstimated,
        openApply: !!n.openApply,
        estHint: D.estHint(n.freq),
        maxAge: el.maxAge,
        minTier: el.minTier,
        isFav: store.isFavorite(id),
        isApplied: store.isApplied(id),
        // 搜索底稿：标题之外也搜机构、摘要、学科，用户搜「城市更新」也能命中
        hay: ((n.title || '') + (n.org || '') + (n.region || '') +
          (n.summary || '') + (n.disciplines || []).join('')).toLowerCase(),
        matchText: '',
        matchCls: ''
      }

      if (d !== null && d < 0) {
        past.push(item)
      } else {
        live.push(item)
      }
    }

    live.sort(function (a, b) {
      if (a.days !== b.days) return a.days - b.days
      return a.id < b.id ? -1 : 1
    })
    past.sort(function (a, b) { return b.days - a.days })

    let week = 0
    let month = 0
    for (let i = 0; i < live.length; i++) {
      if (live[i].days <= 7) week++
      if (live[i].days <= 30) month++
    }

    // 顶部红条交给 applyFilter 计算，保证和当前筛选结果一致
    this.setData({
      all: live,
      past: past,
      stats: { week: week, month: month, total: live.length, mine: 0 },
      // 本地模式显示「数据整理于 X」：优先用每日自动抓取的整理日（每天都在变），
      // 没接自动数据时退回人工整理的日期常量。
      // 远程/缓存模式用数据文件自带的生成时间（精确到分）；没有就退回日期，再退回本次拉取时间。
      updatedAt: (from === 'remote' || from === 'cache')
        ? (isoTimeLabel(generatedAt) || dataUpdatedAt || D.stampLabel(at || Date.now()))
        : (from === 'local')
          ? (lib.AUTO_UPDATED_AT || lib.DATA_UPDATED_AT)
          : D.stampLabel(at || lib.FETCHED_AT)
    }, this.applyFilter)
  },

  applyFilter () {
    const all = this.data.all || []
    const curType = this.data.curType
    const kw = (this.data.keyword || '').trim().toLowerCase()
    const prefs = store.getPrefs()
    const mineDis = prefs.disciplines || []
    const mineProv = prefs.provinces || []
    const myAge = parseInt(prefs.age, 10) || 0
    const myTier = EL.TIER[prefs.title || ''] || 0
    const myIdentity = prefs.identity || ''   // '' 不限 | 'teacher' 高校教师 | 'postdoc' 博士后
    const range = this.data.range

    // 省份 scope：国家级永远保留、开放类保留、勾选省份保留 —— 与日历页共用 filter.keepByRegion
    const scope = all.filter(function (item) {
      return filter.keepByRegion(item, prefs)
    })

    const keep = []
    const byType = []
    for (let i = 0; i < scope.length; i++) {
      const item = scope[i]
      if (curType === 'open') {
        // 「开放」单独成类：各地均可申的开放课题/开放基金，与七大类正交
        if (!item.openApply) { byType.push(item); continue }
      } else if (curType !== 'all' && item.type !== curType) { byType.push(item); continue }
      if (kw) {
        if ((item.hay || '').indexOf(kw) === -1) { byType.push(item); continue }
      }
      // 年龄 / 职称不符的不再隐藏：宁可多看到，也别让人错过重要机会。
      // 只在下方的 marked 里标一句「限 35 周岁以下」，由用户自己判断。
      // 学科筛选：按「我的」关注学科隐藏（开放类与职业全周期类豁免），与日历共用 filter.keepByDiscipline
      if (!filter.keepByDiscipline(item, prefs)) {
        byType.push(item); continue
      }
      keep.push(item)
    }

    // 给每条打上「跟我条件是否相符」的标记（不符也照常展示，只标注原因）
    const marked = keep.map(function (item) {
      const o = Object.assign({}, item)
      o.matchText = ''
      o.matchCls = ''
      // 身份匹配：博士后身份高亮博士后通道（其余不打扰），教师身份提示博士后专属条目
      if (myIdentity === 'postdoc') {
        if (item.type === 'postdoc' || (item.audience || '').indexOf('博士后') > -1) {
          o.matchText = '博士后可申报'
          o.matchCls = 'ok'
          return o
        }
      }
      if (myIdentity === 'teacher') {
        if (item.type === 'postdoc' || ((item.audience || '').indexOf('博士后') > -1 && (item.audience || '').indexOf('教师') === -1)) {
          o.matchText = '面向博士后身份'
          o.matchCls = 'warn'
          return o
        }
      }
      if (myAge && item.maxAge && myAge > item.maxAge) {
        o.matchText = '限 ' + item.maxAge + ' 周岁以下'
        o.matchCls = 'warn'
        return o
      }
      if (myTier > 0 && item.minTier && myTier < item.minTier) {
        o.matchText = '需' + (EL.TIER_TEXT[item.minTier] || '更高职称')
        o.matchCls = 'warn'
        return o
      }
      if ((myAge && item.maxAge) || (myTier > 0 && item.minTier)) {
        o.matchText = '条件符合'
        o.matchCls = 'ok'
      }
      return o
    })

    // 统计「与我相关」的总数（未按类型/关键词筛选时的口径）
    let mine = 0
    if (mineDis.length && curType === 'all' && !kw) mine = marked.length

    // ---- 分段 ----
    let sections = []
    if (this.data.dayFilter) {
      // 从日历点「看全部」跳过来：只聚焦那一天，不再按时间/等级/学科分段（重点突出）
      const df = this.data.dayFilter
      const dayItems = marked.filter(function (it) { return it.deadline === df })
      sections = [{
        key: 'day',
        title: D.shortDate(df) + ' 截止',
        sub: '当日清单',
        tone: 'urgent',
        list: dayItems,
        count: dayItems.length
      }]
      this.setData({ dayBanner: { date: D.shortDate(df), count: dayItems.length } })
    } else {
      this.setData({ dayBanner: null })
    if (this.data.groupBy === 'rank') {
      // 按等级分组：评职称凑「省部级 X 项」时，这个视角最直接
      const buckets = {}
      marked.forEach(function (item) {
        const k = item.rankFull || '未分级'
        if (!buckets[k]) buckets[k] = { w: item.rankWeight || 0, list: [] }
        buckets[k].list.push(item)
      })
      sections = Object.keys(buckets)
        .sort(function (a, b) { return buckets[b].w - buckets[a].w })
        .map(function (k) {
          return {
            key: 'r_' + k,
            title: k,
            sub: '按等级',
            tone: 'rank',
            list: buckets[k].list,
            count: buckets[k].list.length
          }
        })
    } else if (this.data.groupBy === 'dis' && mineDis.length) {
      const buckets = {}
      mineDis.forEach(function (d) { buckets[d] = [] })
      marked.forEach(function (item) {
        for (let i = 0; i < mineDis.length; i++) {
          if (item.disAll.indexOf(mineDis[i]) > -1) {
            buckets[mineDis[i]].push(item)
            return
          }
        }
      })
      sections = mineDis
        .filter(function (d) { return buckets[d].length > 0 })
        .map(function (d) {
          return { key: 'd_' + d, title: d, sub: '我的关注学科', tone: 'dis', list: buckets[d], count: buckets[d].length }
        })
    } else {
      const urgent = []
      const month = []
      const later = []
      const tbd = []
      marked.forEach(function (item) {
        if (item.days === 9999) tbd.push(item)
        else if (item.days <= 7) urgent.push(item)
        else if (item.days <= 30) month.push(item)
        else later.push(item)
      })
      if (urgent.length) sections.push({ key: 'urgent', title: '7 天内截止', sub: '先处理这些', tone: 'urgent', list: urgent, count: urgent.length })
      if (month.length) sections.push({ key: 'month', title: '8–30 天', sub: '本月要动手', tone: 'month', list: month, count: month.length })
      if (later.length) sections.push({ key: 'later', title: '30 天以后', sub: '可以先备材料', tone: 'later', list: later, count: later.length })
      if (tbd.length) sections.push({ key: 'tbd', title: '日期待定', sub: '官方时间未明确', tone: 'later', list: tbd, count: tbd.length })
    }

    // 时间快捷筛选：点顶部数字只看对应的段（聚焦某天时跳过，避免和当日清单冲突）
    if (range === 'week' && !this.data.dayFilter) sections = sections.filter(function (s) { return s.key === 'urgent' })
    if (range === 'month' && !this.data.dayFilter) sections = sections.filter(function (s) { return s.key === 'urgent' || s.key === 'month' })
    } // end dayFilter else

    // 被筛掉多少条 —— 必须让用户看见，否则会以为「就这么点」
    let hiddenTip = ''
    if (byType.length > 0) {
      if (mineDis.length && curType === 'all' && !kw) {
        hiddenTip = '另有 ' + byType.length + ' 条不在你勾选的学科/条件内'
      } else {
        hiddenTip = '另有 ' + byType.length + ' 条被筛选条件排除'
      }
    }

    // 红条跟随当前筛选：看到的就是能点进去的那条，不做「点进去发现被筛掉」的错位提醒
    // 聚焦某天时隐藏红条，避免和「当日清单」抢注意力（重点突出）
    let alert = null
    if (marked.length && marked[0].days <= 7 && !this.data.dayFilter) {
      alert = { id: marked[0].id, title: marked[0].title, days: marked[0].days, org: marked[0].org }
    }

    this.setData({
      sections: sections,
      alert: alert,
      stats: Object.assign({}, this.data.stats, { week: this.data.stats.week, month: this.data.stats.month, total: this.data.stats.total, mine: mine }),
      hidden: byType.length,
      hiddenTip: hiddenTip,
      hasPrefs: mineDis.length > 0 || mineProv.length > 0
    })
  },

  onType (e) {
    const t = e.currentTarget.dataset.t
    const sub = t !== 'all' && t !== 'open' && lib.TYPE_MAP[t] && lib.TYPE_MAP[t].secondary
    this.setData({
      curType: t,
      range: 'all',
      isSubType: !!sub,
      // 选中职业周期类时自动展开「更多」，保证高亮可见；否则保持更多当前的开合状态
      moreOpen: sub ? true : this.data.moreOpen
    }, this.applyFilter)
  },

  toggleMore () {
    this.setData({ moreOpen: !this.data.moreOpen })
  },

  onSearch (e) {
    this.setData({ keyword: e.detail.value }, this.applyFilter)
  },

  onRange (e) {
    const r = e.currentTarget.dataset.r
    this.setData({ range: this.data.range === r ? 'all' : r }, this.applyFilter)
  },

  onGroup (e) {
    const g = e.currentTarget.dataset.g
    this.setData({ groupBy: g }, this.applyFilter)
  },

  clearPrefsFilter () {
    const p = store.getPrefs()
    p.disciplines = []
    p.provinces = []
    store.savePrefs(p)
    this.setData({ range: 'all' }, this.applyFilter)
    wx.showToast({ title: '已显示全部信息', icon: 'none' })
  },

  togglePast () {
    this.setData({ pastOpen: !this.data.pastOpen })
  },

  // 从日历跳过来聚焦某天后，点横幅「返回全部」回到正常列表
  clearDay () {
    this.setData({ dayFilter: '', dayBanner: null }, this.applyFilter)
  },

  // 打开详情：先过激励视频门（会员 / 24 小时通行证直接进）
  goDetail (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    ads.gate(function () {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    })
  },

  goMine () {
    wx.switchTab({ url: '/pages/mine/mine' })
  },

  onShareAppMessage () {
    return {
      title: '青椒的日历 · 不放过任何一个科研截止日',
      path: '/pages/index/index'
    }
  }
})

function stampToDate (ts) {
  const d = new Date(ts)
  const m = d.getMonth() + 1
  const day = d.getDate()
  return d.getFullYear() + '-' + (m < 10 ? '0' + m : m) + '-' + (day < 10 ? '0' + day : day)
}
