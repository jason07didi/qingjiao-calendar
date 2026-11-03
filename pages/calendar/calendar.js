const api = require('../../utils/api.js')
const noticesLib = require('../../utils/notices.js')
const D = require('../../utils/date.js')
const ads = require('../../utils/ads.js')
const store = require('../../utils/store.js')
const filter = require('../../utils/filter.js')

Page({
  data: {
    weekdays: ['一', '二', '三', '四', '五', '六', '日'],
    year: 0,
    month: 0,
    label: '',
    cells: [],
    selected: '',
    selectedLabel: '',
    dayList: [],
    monthCount: 0,
    filterHint: '',
    todayLabel: '',
    loading: true
  },

  onLoad () {
    this._all = []
    const t = D.today()
    this.setData({
      year: t.getFullYear(),
      month: t.getMonth(),
      label: D.monthLabel(t.getFullYear(), t.getMonth())
    })
    this.load(false)
  },

  onShow () {
    const tb = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tb) tb.setData({ selected: 1 })
    // 从「我的」切回来时，偏好可能已改（勾了省份/学科），用当前偏好重渲染，
    // 保证日历和首页跟着「我的」同步过滤。
    if (this._all && this._all.length) {
      this.render(this.data.year, this.data.month, this.data.selected)
    }
  },

  onPullDownRefresh () {
    this.load(true)
  },

  load (force) {
    const self = this
    api.getList({ force: force }).then(function (r) {
      self._all = r.list || []
      const t = D.today()
      self.render(t.getFullYear(), t.getMonth(), D.todayStr())
      self.setData({ loading: false })
      wx.stopPullDownRefresh()
    }).catch(function () {
      self._all = noticesLib.getAll().map(function (n) {
        return Object.assign({}, n, { id: String(n.id) })
      })
      const t = D.today()
      self.render(t.getFullYear(), t.getMonth(), D.todayStr())
      self.setData({ loading: false })
      wx.stopPullDownRefresh()
    })
  },

  render (year, month, keepSelected) {
    const prefs = store.getPrefs()
    // 按「我的」偏好（省份 + 学科）过滤，和首页 applyFilter 同一套规则
    const raw = (this._all || []).filter(function (n) { return filter.keepByPrefs(n, prefs) })
    const tk0 = D.today()
    const weekNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    const todayLabel = (tk0.getMonth() + 1) + '月' + tk0.getDate() + '日 ' + weekNames[tk0.getDay()]

    const prefix = year + '-' + D.pad(month + 1)
    // dayMeta: 每个有截止的日期 → { count: 条数, level: 当天最紧急级别 }。
    // level 取当天所有条目里剩余天数最小的那个（urgent<soon<normal<later），
    // 让「3 天内到期」的格子一眼跳出来，而不是和远期混成一样的小点。
    const RANK = { urgent: 0, soon: 1, normal: 2, later: 3 }
    const dayMeta = {}
    let monthCount = 0

    for (let i = 0; i < raw.length; i++) {
      const ds = raw[i].deadline
      if (!ds) continue
      const lv = D.level(D.daysLeft(ds))
      const m = dayMeta[ds] || { count: 0, level: 'later' }
      m.count++
      if (RANK[lv] != null && RANK[lv] < RANK[m.level]) m.level = lv
      dayMeta[ds] = m
      if (ds.indexOf(prefix) === 0) monthCount++
    }

    let selected = keepSelected || ''
    // 若选中日期不在当前月、或当月已无截止（被筛选掉了），默认选中本月第一个有截止的日期
    if (!selected || selected.indexOf(prefix) !== 0 || !(dayMeta[selected] && dayMeta[selected].count)) {
      const keys = Object.keys(dayMeta).sort()
      selected = ''
      for (let i = 0; i < keys.length; i++) {
        if (keys[i].indexOf(prefix) === 0) {
          selected = keys[i]
          break
        }
      }
    }

    const cells = D.monthGrid(year, month, dayMeta)

    // 顶部提示：告诉用户日历当前已按哪些偏好过滤
    const mineProv = prefs.provinces || []
    const mineDis = prefs.disciplines || []
    const filterHint = (mineProv.length || mineDis.length)
      ? '已按「我的」筛选：' +
        (mineProv.length ? mineProv.length + ' 个地区' : '') +
        (mineProv.length && mineDis.length ? ' · ' : '') +
        (mineDis.length ? mineDis.length + ' 个学科' : '')
      : ''

    this.setData({
      year: year,
      month: month,
      label: D.monthLabel(year, month),
      cells: cells,
      selected: selected,
      monthCount: monthCount,
      filterHint: filterHint,
      todayLabel: todayLabel
    })

    this.fillDay(selected)
  },

  fillDay (dateStr) {
    if (!dateStr) {
      this.setData({ dayList: [], selectedLabel: '' })
      return
    }

    const prefs = store.getPrefs()
    const raw = (this._all || []).filter(function (n) { return filter.keepByPrefs(n, prefs) })
    const out = []
    for (let i = 0; i < raw.length; i++) {
      const n = raw[i]
      if (n.deadline !== dateStr) continue
      const t = noticesLib.TYPE_MAP[n.type]
      out.push({
        id: n.id,
        title: n.title,
        org: n.org,
        type: n.type,
        typeName: t ? t.name : '',
        amountShort: n.info && n.info.amount ? n.info.amount.split('，')[0] : ''
      })
    }

    this.setData({
      dayList: out,
      selectedLabel: D.shortDate(dateStr)
    })
  },

  prevMonth () {
    if (!this._all || !this._all.length) return
    let y = this.data.year
    let m = this.data.month - 1
    if (m < 0) { m = 11; y = y - 1 }
    this.render(y, m, '')
  },

  nextMonth () {
    if (!this._all || !this._all.length) return
    let y = this.data.year
    let m = this.data.month + 1
    if (m > 11) { m = 0; y = y + 1 }
    this.render(y, m, '')
  },

  onPick (e) {
    const ds = e.currentTarget.dataset.ds
    if (!ds) return
    this.setData({ selected: ds })
    this.fillDay(ds)
  },

  goDetail (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    ads.gate(function () {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    })
  },

  goToday () {
    if (!this._all || !this._all.length) return
    const t = D.today()
    this.render(t.getFullYear(), t.getMonth(), D.todayStr())
  },

  // 把当前选中的那天带到首页列表去看「当日全部」（打通日历与列表，符合「导航明确」）
  openDayInList () {
    if (!this.data.selected || !this.data.dayList.length) return
    store.setPendingDay(this.data.selected)
    wx.switchTab({ url: '/pages/index/index' })
  }
})
