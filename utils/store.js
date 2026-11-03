// utils/store.js
// 本地存储：收藏、已申报、订阅偏好、用户资料

const KEY_FAV = 'pc_favorites'
const KEY_APPLIED = 'pc_applied'
const KEY_PREFS = 'pc_prefs'
const KEY_PENDING_DAY = 'pc_pending_day'
const KEY_AVATAR = 'avatar'
const KEY_NAME = 'username'
const KEY_BIO = 'bio'

function getArr (key) {
  const v = wx.getStorageSync(key)
  return Array.isArray(v) ? v : []
}

function setArr (key, arr) {
  wx.setStorageSync(key, arr)
}

function has (key, id) {
  return getArr(key).indexOf(id) > -1
}

function toggle (key, id) {
  const arr = getArr(key)
  const i = arr.indexOf(id)
  if (i > -1) {
    arr.splice(i, 1)
  } else {
    arr.unshift(id)
  }
  setArr(key, arr)
  return arr.indexOf(id) > -1
}

const store = {
  getFavorites: function () { return getArr(KEY_FAV) },
  isFavorite: function (id) { return has(KEY_FAV, id) },
  toggleFavorite: function (id) { return toggle(KEY_FAV, id) },

  getApplied: function () { return getArr(KEY_APPLIED) },
  isApplied: function (id) { return has(KEY_APPLIED, id) },
  toggleApplied: function (id) { return toggle(KEY_APPLIED, id) },

  getPrefs: function () {
    const p = wx.getStorageSync(KEY_PREFS)
    const d = { disciplines: [], provinces: [], types: [], remindDays: [7, 3, 1] }
    if (p && typeof p === 'object') {
      if (!Array.isArray(p.disciplines)) p.disciplines = []
      if (!Array.isArray(p.provinces)) p.provinces = []
      if (!Array.isArray(p.remindDays)) p.remindDays = [7, 3, 1]
      return p
    }
    return d
  },
  savePrefs: function (prefs) {
    wx.setStorageSync(KEY_PREFS, prefs)
  },

  // 日历点「看全部」跳到首页列表时，暂存要聚焦的那天（tab 间不能传参，靠本地存储桥接）
  getPendingDay: function () { return wx.getStorageSync(KEY_PENDING_DAY) || '' },
  setPendingDay: function (ds) { wx.setStorageSync(KEY_PENDING_DAY, ds) },
  clearPendingDay: function () { wx.setStorageSync(KEY_PENDING_DAY, '') },

  getProfile: function () {
    return {
      avatar: wx.getStorageSync(KEY_AVATAR) || '青',
      username: wx.getStorageSync(KEY_NAME) || '微信用户',
      bio: wx.getStorageSync(KEY_BIO) || '点击设置个性签名'
    }
  },
  setProfile: function (k, v) {
    if (k === 'avatar') wx.setStorageSync(KEY_AVATAR, v)
    if (k === 'username') wx.setStorageSync(KEY_NAME, v)
    if (k === 'bio') wx.setStorageSync(KEY_BIO, v)
  }
}

module.exports = store
