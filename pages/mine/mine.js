const api = require('../../utils/api.js')
const noticesLib = require('../../utils/notices.js')
const store = require('../../utils/store.js')
const vip = require('../../utils/vip.js')

function fmtTime (ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const p = function (n) { return n < 10 ? '0' + n : '' + n }
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + p(d.getHours()) + ':' + p(d.getMinutes())
}

Page({
  data: {
    avatar: '青',
    avatarIsImg: false,
    username: '科研用户',
    bio: '城乡规划 · 城市气候',
    avatars: ['🐱', '🐶', '🐼', '🦊', '🐰', '🐻', '🐯', '🦁', '🐨', '🦉', '🐧', '🦌'],
    showAvatar: false,
    pickPanel: '',
    disText: '',
    provText: '',
    disSel: {},
    provSel: {},
    disciplines: noticesLib.DISCIPLINES,
    provinces: noticesLib.PROVINCES,
    titleOptions: ['不限', '助教', '讲师', '副教授', '教授'],
    identityOptions: ['不限', '高校教师', '博士后'],
    identityText: '',
    prefs: { disciplines: [], provinces: [], age: '', title: '', identity: '' },
    favCount: 0,
    appliedCount: 0,
    totalCount: 0,
    metaText: '',
    metaOk: false,
    vip: { on: false, code: '', since: '' }
  },

  onShow () {
    const tb = typeof this.getTabBar === 'function' ? this.getTabBar() : null
    if (tb) tb.setData({ selected: 3 })

    const p = store.getProfile()
    const prefs = store.getPrefs()
    this.setData(Object.assign({
      avatar: p.avatar,
      avatarIsImg: /^data:image|^https?:|^wxfile:/.test(p.avatar || ''),
      username: p.username,
      bio: p.bio,
      prefs: prefs,
      disText: (prefs.disciplines || []).join('、'),
      provText: (prefs.provinces || []).join('、'),
      identityText: prefs.identity === 'postdoc' ? '博士后' : (prefs.identity === 'teacher' ? '高校教师' : ''),
      favCount: store.getFavorites().length,
      appliedCount: store.getApplied().length,
      vip: vip.status()
    }, this.buildSel(prefs)))
    this.loadMeta()
  },

  /* 点昵称旁的 VIP 徽标 = 会员码唯一入口
     已开通 → 问要不要退出；未开通 → 直接弹出输入框 */
  onVipBadge () {
    const self = this
    if (this.data.vip.on) {
      wx.showModal({
        title: '会员已开通',
        content: '全站不看广告，点开信息直接进详情。要退出吗？',
        confirmText: '退出会员',
        cancelText: '知道了',
        success: function (res) {
          if (res.confirm) self.clearVip()
        }
      })
      return
    }
    wx.showModal({
      title: '输入会员码',
      editable: true,
      placeholderText: '会员码',
      confirmText: '激活',
      success: function (res) {
        if (!res.confirm) return
        const r = vip.activate(res.content || '')
        if (!r.ok) {
          wx.showToast({ title: r.msg, icon: 'none' })
          return
        }
        self.setData({ vip: vip.status() })
        wx.showToast({ title: r.msg, icon: 'none' })
      }
    })
  },

  clearVip () {
    const self = this
    wx.showModal({
      title: '退出会员',
      content: '退出后会重新显示广告，其他功能不受影响。确定退出？',
      confirmText: '退出',
      success: function (res) {
        if (!res.confirm) return
        vip.clear()
        self.setData({ vip: vip.status() })
        wx.showToast({ title: '已退出会员', icon: 'none' })
      }
    })
  },

  /* 把选中数组转成映射表，供 wxml 做属性查找（wxml 不支持方法调用） */
  buildSel (prefs) {
    const disSel = {}
    const provSel = {}
    ;(prefs.disciplines || []).forEach(function (d) { disSel[d] = true })
    ;(prefs.provinces || []).forEach(function (d) { provSel[d] = true })
    return { disSel: disSel, provSel: provSel }
  },

  commitPrefs (prefs) {
    store.savePrefs(prefs)
    this.setData(Object.assign({
      prefs: prefs,
      disText: (prefs.disciplines || []).join('、'),
      provText: (prefs.provinces || []).join('、')
    }, this.buildSel(prefs)))
  },

  loadMeta () {
    const self = this
    api.getMeta().then(function (m) {
      if (!m) {
        const all = noticesLib.getAll()
        const fd = noticesLib.FETCHED_AT
        const tag = fd ? fmtTime(fd) + ' 抓取' : '本地数据'
        self.setData({
          totalCount: all.length,
          metaText: tag + ' · 已收录 ' + all.length + ' 条真实申报',
          metaOk: false
        })
        return
      }
      const parts = ['已收录 ' + m.total + ' 条']
      if (m.lastRunAt) parts.push('最近抓取 ' + fmtTime(m.lastRunAt))
      self.setData({
        totalCount: m.total,
        metaText: parts.join(' · '),
        metaOk: true
      })
    }).catch(function () {
      const all = noticesLib.getAll()
      const fd = noticesLib.FETCHED_AT
      const d = fd ? new Date(fd) : null
      const tag = d ? (d.getMonth() + 1) + '月' + d.getDate() + '日抓取' : '本地数据'
      self.setData({
        totalCount: all.length,
        metaText: tag + ' · 已收录 ' + all.length + ' 条真实申报',
        metaOk: false
      })
    })
  },

  /* 头像 */
  openAvatar () {
    this.setData({ showAvatar: true })
  },

  closeAvatar () {
    this.setData({ showAvatar: false })
  },

  stopTap () {},

  selectAvatar (e) {
    const v = e.currentTarget.dataset.v
    store.setProfile('avatar', v)
    this.setData({ avatar: v, avatarIsImg: false, showAvatar: false })
  },

  chooseImage () {
    const self = this
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: function (res) {
        const fp = res.tempFiles[0].tempFilePath
        wx.compressImage({
          src: fp,
          quality: 60,
          success: function (c) {
            const fs = wx.getFileSystemManager()
            fs.readFile({
              filePath: c.tempFilePath,
              encoding: 'base64',
              success: function (r) {
                const b64 = 'data:image/png;base64,' + r.data
                store.setProfile('avatar', b64)
                self.setData({ avatar: b64, avatarIsImg: true, showAvatar: false })
                wx.showToast({ title: '头像已更新', icon: 'success' })
              }
            })
          }
        })
      }
    })
  },

  /* 昵称 */
  changeName () {
    const that = this
    wx.showModal({
      title: '修改昵称',
      editable: true,
      placeholderText: '请输入昵称',
      success: function (res) {
        if (res.confirm && res.content) {
          store.setProfile('username', res.content)
          that.setData({ username: res.content })
        }
      }
    })
  },

  /* 简介 */
  changeBio () {
    const that = this
    wx.showModal({
      title: '修改简介',
      editable: true,
      placeholderText: '请输入个性签名',
      success: function (res) {
        if (res.confirm && res.content) {
          store.setProfile('bio', res.content)
          that.setData({ bio: res.content })
        }
      }
    })
  },

  /* 学科 / 地区：下拉多选弹层 */

  openPick (e) {
    this.setData({ pickPanel: e.currentTarget.dataset.dim })
  },

  closePick () {
    this.setData({ pickPanel: '' })
  },

  togglePick (e) {
    const v = e.currentTarget.dataset.v
    const dim = this.data.pickPanel
    const prefs = this.data.prefs
    const key = dim === 'dis' ? 'disciplines' : 'provinces'
    const arr = prefs[key] || []
    const i = arr.indexOf(v)

    if (i > -1) arr.splice(i, 1)
    else arr.push(v)

    prefs[key] = arr
    this.commitPrefs(prefs)
  },

  clearDim (e) {
    const dim = e.currentTarget.dataset.dim
    const prefs = this.data.prefs
    if (dim === 'dis') {
      prefs.disciplines = []
    } else {
      prefs.provinces = []
    }
    this.commitPrefs(prefs)
  },

  /* 身份：教师 / 博士后（首页据此标注「跟我有关」） */
  onIdentityChange (e) {
    const v = this.data.identityOptions[parseInt(e.detail.value, 10)] || '不限'
    const prefs = this.data.prefs
    prefs.identity = v === '高校教师' ? 'teacher' : (v === '博士后' ? 'postdoc' : '')
    store.savePrefs(prefs)
    this.setData({
      prefs: prefs,
      identityText: prefs.identity === 'postdoc' ? '博士后' : (prefs.identity === 'teacher' ? '高校教师' : '')
    })
  },

  /* 个人条件：年龄 / 职称 */
  onAgeInput (e) {
    const v = String(e.detail.value || '').replace(/\D/g, '').slice(0, 2)
    const prefs = this.data.prefs
    prefs.age = v
    store.savePrefs(prefs)
    this.setData({ prefs: prefs })
  },

  onTitleChange (e) {
    const v = this.data.titleOptions[parseInt(e.detail.value, 10)] || ''
    const prefs = this.data.prefs
    prefs.title = v === '不限' ? '' : v
    store.savePrefs(prefs)
    this.setData({ prefs: prefs })
  },

  clearCond () {
    const prefs = this.data.prefs
    prefs.age = ''
    prefs.title = ''
    prefs.identity = ''
    store.savePrefs(prefs)
    this.setData({ prefs: prefs, identityText: '' })
  },

  goFavorites () {
    // 收藏已从 tabBar 移到「我的」里，不再是 tab 页，用 navigateTo 打开
    wx.navigateTo({ url: '/pages/favorites/favorites' })
  },

  about () {
    wx.showModal({
      title: '关于本小程序',
      content: '面向城乡规划、建筑、风景园林、环境设计的科研申报聚合工具。信息由后台定时抓取各省厅、国家部委与学会的官方通知，抽取标题、截止时间与申报要点，最终以官方原文为准。',
      confirmText: '知道了',
      showCancel: false
    })
  },

  /* 联系我们：统一引导关注公众号【创艺喵】反馈 */
  feedback () {
    const name = '创艺喵'
    wx.showModal({
      title: '联系我们',
      content: '请关注公众号【' + name + '】向我们反馈\n\n信息报错、数据补充、功能建议或合作洽谈，都可以在公众号后台留言，看到后会尽快回复。',
      confirmText: '复制公众号名',
      cancelText: '关闭',
      success: function (res) {
        if (res.confirm) {
          wx.setClipboardData({
            data: name,
            success: function () { wx.showToast({ title: '已复制，去微信搜索关注', icon: 'none' }) }
          })
        }
      }
    })
  },

  onShareAppMessage () {
    return {
      title: '青椒的日历｜科研申报截止提醒',
      path: '/pages/index/index'
    }
  }
})
