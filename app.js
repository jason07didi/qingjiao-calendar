// app.js
const api = require('./utils/api.js')
const ads = require('./utils/ads.js')

App({
  onLaunch () {
    // 尽量早初始化云开发，避免首屏请求时才建立连接
    api.cloudEnabled()

    // 预热激励视频实例：第一次点开详情时能快一点
    ads.preload()

    const first = wx.getStorageSync('pc_first_launch')
    if (!first) {
      wx.setStorageSync('pc_first_launch', Date.now())
    }
  },

  globalData: {
    brand: '#123B5B'
  }
})
