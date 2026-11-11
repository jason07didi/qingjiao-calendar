// 原生自定义 tabBar（app.json 里 tabBar.custom = true 时由框架挂载）
//
// 【为什么不用「组件 + redirectTo」的老办法】
// 老办法每切一次 tab 都 redirectTo：当前页被销毁、目标页重新 onLoad，
// 于是每次切换都是「白屏 → loading → 数据回来」，滚动位置也丢了。
// 换用框架级 tabBar 后走 wx.switchTab，页面实例保留，切回来只触发 onShow，
// 是秒切，不刷新。
Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/index/index', icon: '📋', text: '今日' },
      { pagePath: '/pages/calendar/calendar', icon: '🗓', text: '日历' },
      { pagePath: '/pages/fund/fund', icon: '🔍', text: '基金' },
      { pagePath: '/pages/mine/mine', icon: '👤', text: '我的' }
    ]
  },

  methods: {
    onTap (e) {
      const i = Number(e.currentTarget.dataset.index)
      const item = this.data.list[i]
      if (!item) return
      if (i === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})
