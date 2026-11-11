const api = require('../../utils/api.js')
const noticesLib = require('../../utils/notices.js')
const D = require('../../utils/date.js')
const store = require('../../utils/store.js')
const ads = require('../../utils/ads.js')

Page({
  data: {
    tab: 'fav',
    list: [],
    favCount: 0,
    appliedCount: 0,
    loading: true
  },

  onShow () {
    // 收藏已不是 tab 页（移到「我的」入口进入），不再操作 tabBar
    this.load()
  },

  load () {
    const self = this
    api.getList({}).then(function (r) {
      self._map = {}
      ;(r.list || []).forEach(function (n) { self._map[n.id] = n })
      self.setData({ loading: false })
      self.build()
    }).catch(function () {
      self._map = {}
      noticesLib.getAll().forEach(function (n) {
        const o = Object.assign({}, n, { id: String(n.id) })
        self._map[o.id] = o
      })
      self.setData({ loading: false })
      self.build()
    })
  },

  build () {
    const favIds = store.getFavorites()
    const appliedIds = store.getApplied()
    const ids = this.data.tab === 'fav' ? favIds : appliedIds
    const map = this._map || {}

    const list = []
    for (let i = 0; i < ids.length; i++) {
      const n = map[ids[i]]
      if (!n) continue
      const d = D.daysLeft(n.deadline)
      const t = noticesLib.TYPE_MAP[n.type]
      list.push({
        id: n.id,
        title: n.title,
        org: n.org,
        type: n.type,
        typeName: t ? t.name : '',
        deadlineShort: D.shortDate(n.deadline),
        days: d === null ? -999 : d,
        level: D.level(d),
        closed: d !== null && d < 0,
        estimated: !!n.deadlineEstimated
      })
    }

    this.setData({
      list: list,
      favCount: favIds.length,
      appliedCount: appliedIds.length
    })
  },

  switchTab (e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab: tab }, this.build)
  },

  goDetail (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    ads.gate(function () {
      wx.navigateTo({ url: '/pages/detail/detail?id=' + id })
    })
  },

  goIndex () {
    wx.switchTab({ url: '/pages/index/index' })
  }
})
