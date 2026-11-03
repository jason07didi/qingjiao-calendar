Component({
  properties: {
    active: {
      type: String,
      value: ''
    }
  },

  data: {
    list: [
      { key: 'index',      icon: '📋', name: '今日', path: '/pages/index/index' },
      { key: 'calendar',   icon: '🗓', name: '日历', path: '/pages/calendar/calendar' },
      { key: 'favorites',  icon: '⭐', name: '收藏', path: '/pages/favorites/favorites' },
      { key: 'mine',       icon: '👤', name: '我的', path: '/pages/mine/mine' }
    ]
  },

  methods: {
    goPage (e) {
      const key = e.currentTarget.dataset.key
      if (key === this.data.active) return

      const list = this.data.list
      let path = ''
      for (let i = 0; i < list.length; i++) {
        if (list[i].key === key) {
          path = list[i].path
          break
        }
      }
      if (!path) return

      wx.redirectTo({ url: path })
    }
  }
})
