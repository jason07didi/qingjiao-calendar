const api = require('../../utils/api.js')
const noticesLib = require('../../utils/notices.js')
const rankLib = require('../../utils/rank.js')
const D = require('../../utils/date.js')
const store = require('../../utils/store.js')
const EL = require('../../utils/eligibility.js')
const officialLib = require('../../utils/official.js')
const ads = require('../../utils/ads.js')

const BLOCK_LABELS = {
  default: { info: '申报信息', cond: '基本条件', file: '相关文件' },
  special: { info: '征稿信息', cond: '投稿要求', file: '相关文件' },
  conference: { info: '会议信息', cond: '投稿要求', file: '相关文件' },
  competition: { info: '竞赛信息', cond: '参赛条件', file: '相关文件' },
  talent: { info: '支持信息', cond: '申报条件', file: '相关文件' },
  standard: { info: '征求意见信息', cond: '反馈要点', file: '相关文件' },
  license: { info: '考试信息', cond: '报考条件', file: '相关文件' },
  postdoc: { info: '资助信息', cond: '申报条件', file: '相关文件' },
  visit: { info: '选派信息', cond: '申报条件', file: '相关文件' },
  review: { info: '评审信息', cond: '申报条件', file: '相关文件' },
  student: { info: '项目信息', cond: '申报条件', file: '相关文件' },
  growth: { info: '培养信息', cond: '申报条件', file: '相关文件' }
}

const INFO_LABELS = {
  default: { amount: '资助额度', target: '申报对象', quota: '限项要求', channel: '申报方式' },
  special: { amount: '费用与出版', target: '征稿对象', quota: '篇数限制', channel: '投稿系统' },
  conference: { amount: '注册费用', target: '参会对象', quota: '投稿限制', channel: '投稿方式' },
  competition: { amount: '奖项设置', target: '参赛对象', quota: '作品限制', channel: '报名方式' },
  talent: { amount: '支持强度', target: '申报对象', quota: '申报名额', channel: '申报渠道' },
  standard: { amount: '反馈方式', target: '涉及范围', quota: '反馈截止', channel: '反馈渠道' },
  license: { amount: '考试 / 报名', target: '报考对象', quota: '报考要求', channel: '报名方式' },
  postdoc: { amount: '资助额度', target: '申报对象', quota: '名额 / 限项', channel: '申报渠道' },
  visit: { amount: '选派规模', target: '留学身份', quota: '申报条件', channel: '申报渠道' },
  review: { amount: '评审层级', target: '适用对象', quota: '关键节点', channel: '材料与流程' },
  student: { amount: '资助 / 奖励', target: '面向对象', quota: '名额', channel: '申报方式' },
  growth: { amount: '资助 / 支持', target: '面向对象', quota: '名额 / 周期', channel: '申报渠道' }
}

const GOV_NAME = { national: '国家级', province: '省级', city: '市级' }

// 所有类目统一成同一张「关键信息卡」：一条大字 + 3–5 行要点。
// 会议看城市，项目看额度，特刊看期刊等级，学术岗看岗位性质——
// 但结构一样，用户换类目不用重新学怎么读。
function buildKeyInfo (n, conf, info, disc, rank) {
  const rows = []
  const add = function (l, v) { if (v) rows.push({ label: l, value: v }) }
  const t = n.type

  if (t === 'conference') {
    if (!conf) return null
    const ok = conf.venueStatus === 'confirmed'
    add('会址', conf.venueHall)
    const roles = conf.roles || []
    for (let i = 0; i < roles.length; i++) add(roles[i].role, roles[i].name)
    add('注册费', conf.fee)
    add('规模与语言', [conf.scale, conf.language].filter(function (x) { return !!x }).join(' · '))
    return {
      headLabel: '举办城市',
      head: ok ? conf.venueCity : '待公布',
      headSub: ok ? '' : (conf.prevVenue ? '上届 ' + conf.prevVenue : '以官网公告为准'),
      sub: conf.dates || '',
      tone: ok ? 'strong' : 'weak',
      rows: rows
    }
  }

  if (t === 'position') {
    add('招募单位', n.org)
    add('名额', info.quota)
    add('能换来什么', info.amount)
    add('申请方式', info.channel)
    return {
      headLabel: '岗位性质',
      head: (rank && rank.name) || '学术兼职',
      headSub: '',
      sub: n.freq || '常年可申请',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'standard') {
    add('涉及范围', info.target)
    add('反馈渠道', info.channel)
    add('反馈方式', info.amount)
    return {
      headLabel: '意见反馈截止',
      head: (n.deadlineText && /截止/.test(n.deadlineText)) ? n.deadlineText
        : (n.freq ? '常年征集意见' : '见原文'),
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'license') {
    add('报考对象', info.target)
    add('报考要求', info.quota)
    add('报名方式', info.channel)
    return {
      headLabel: '考试与报名',
      head: info.amount || '见报名公告',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'postdoc') {
    add('申报对象', info.target)
    add('名额 / 限项', info.quota)
    add('申报渠道', info.channel)
    return {
      headLabel: '资助强度',
      head: info.amount || '见原文',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'visit') {
    add('留学身份', info.target)
    add('申报条件', info.quota)
    add('申报渠道', info.channel)
    return {
      headLabel: '选派规模',
      head: info.amount || '见原文',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'review') {
    add('适用对象', info.target)
    add('关键节点', info.quota)
    add('材料与流程', info.channel)
    return {
      headLabel: '评审层级',
      head: (rank && rank.name) || '评审信息',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'student') {
    add('面向对象', info.target)
    add('名额', info.quota)
    add('申报方式', info.channel)
    return {
      headLabel: '资助 / 奖励',
      head: info.amount || '见原文',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'growth') {
    add('面向对象', info.target)
    add('申报渠道', info.channel)
    add('名额 / 周期', info.quota)
    return {
      headLabel: '培养定位',
      head: (rank && rank.name) || '成长型项目',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  if (t === 'special') {
    add('征稿对象', info.target)
    add('篇数限制', info.quota)
    add('投稿系统', info.channel)
    add('费用与出版', info.amount)
    return {
      headLabel: '期刊等级',
      head: (rank && rank.label) || (rank && rank.name) || '见原文',
      headSub: '',
      sub: n.org || '',
      tone: 'strong',
      rows: rows
    }
  }

  // 项目 / 人才 / 奖项 / 竞赛：都是「给多少 + 给谁 + 限几项 + 怎么交」
  const HEAD_LABEL = { project: '资助额度', talent: '支持强度', award: '奖励设置', competition: '奖项设置' }
  add('申报对象', info.target)
  add('限项 / 名额', info.quota)
  add('申报渠道', info.channel)
  if (disc.length) add('面向学科', disc.slice(0, 4).join('、'))
  return {
    headLabel: HEAD_LABEL[t] || '资助额度',
    head: info.amount || '见原文',
    headSub: '',
    sub: n.startAt && n.deadline ? (n.startAt + ' 起报 · ' + n.deadline + ' 截止') : '',
    tone: info.amount ? 'strong' : 'weak',
    rows: rows
  }
}

Page({
  data: {
    id: '',
    notice: null,
    days: 0,
    level: 'normal',
    isFav: false,
    isApplied: false,
    labels: BLOCK_LABELS.default,
    infoRows: [],
    keyInfo: null,
    conf: null,
    confEdition: '',
    confRoles: [],
    confFee: '',
    confFeeNote: '',
    confVenueLine: '',
    confVenueHall: '',
    confDates: '',
    confVenueOk: false,
    confMeta: '',
    confSessions: [],
    confTopics: [],
    confWho: [],
    confNote: '',
    official: null,
    officialUrl: '',
    noticeUrl: '',
    searchUrl: '',
    rank: null,
    ladder: [],
    ladderOpen: false,
    related: [],
    govName: '',
    freq: '',
    peerNote: '',
    dateWarn: '',
    typeName: '',
    loading: true,
    isRaw: false,
    err: '',
    remindText: '',
    adBanner: ''
  },

  onLoad (options) {
    const id = options && options.id ? decodeURIComponent(options.id) : ''
    this._id = id
    // 不从详情页弹广告（那会打断阅读）。这里预热，是为了用户接着点「相关信息」时不用等。
    ads.preload()
    this.load(id)
  },

  // 广告位写错、审核中、无填充都会走到这里：直接摘掉，不影响页面任何功能
  onAdError () {
    this.setData({ adBanner: '' })
  },

  load (id) {
    const self = this
    api.getById(id).then(function (n) {
      if (!n) {
        self.setData({ loading: false, err: '没有找到这条信息，可能已经下线' })
        return
      }
      self.render(n)
    }).catch(function (e) {
      // 绝不白屏：把失败原因直接摆出来，并给回列表的出口
      self.setData({ loading: false, err: '加载失败：' + (e && e.message ? e.message : '未知错误') })
    })
  },

  render (n) {
    try {
      // 归一化：wxml 里只做取值，不做存在性判断，避免 undefined.length 崩掉整页
      const conditions = Array.isArray(n.conditions) ? n.conditions : []
      const files = Array.isArray(n.files) ? n.files : []
      const info = n.info || {}
      const disc = Array.isArray(n.disciplines) ? n.disciplines : []
      const safe = Object.assign({}, n, { conditions: conditions, files: files, info: info, disciplines: disc })

      const days = D.daysLeft(n.deadline)
      const t = noticesLib.TYPE_MAP[n.type]
      const key = BLOCK_LABELS[n.type] ? n.type : 'default'
      const lbl = BLOCK_LABELS[key]
      const ilbl = INFO_LABELS[key]

      const conf = n.conf || null
      const rank = n.rank || rankLib.of(n)

      // 这里只留「我能不能报」的三行；额度、对象、渠道都收进下面那张关键信息卡。
      // 面向地区只对项目/人才/奖项/竞赛这类「属地限制」的有意义：
      // 会议的地点在会议卡里大字显示，期刊特刊只看刊不看地区——都别再拿出来占一行。
      const rows = []
      if (n.type !== 'conference' && n.type !== 'special' && n.region) {
        rows.push({ label: '面向地区', value: n.region === '国家' ? '全国' : n.region })
      }
      const el = EL.parse(n)
      if (el.ageText) rows.push({ label: '年龄要求', value: el.ageText })
      if (el.tierText) rows.push({ label: '职称要求', value: el.tierText })

      const keyInfo = buildKeyInfo(n, conf, info, disc, rank)

      // 到场单位压成一行一组，wxml 里不能 join，先算好
      const confWho = conf
        ? (conf.who || []).map(function (w) {
            return { group: w.group, text: (w.list || []).join('、') }
          })
        : []

      const ladder = rankLib.ladder(n.type).map(function (r) {
        return {
          key: r.key,
          name: r.name,
          use: r.use,
          eg: r.eg || '',
          active: r.key === rank.key
        }
      })

      const related = noticesLib.getRelated(n.id, 3).map(function (x) {
        const dd = D.daysLeft(x.deadline)
        return {
          id: String(x.id),
          title: x.title,
          typeName: (noticesLib.TYPE_MAP[x.type] || {}).name || '',
          days: dd === null ? null : dd,
          rankName: x.rank ? x.rank.short : ''
        }
      })

      let dateWarn = ''
      if (n.deadlineEstimated) {
        dateWarn = n.freq
          ? '日期按往年规律推算（' + n.freq + '），今年以官方通知为准'
          : '日期由正文推断或按往年规律推算，请以官方通知为准'
      }

      const prefs = store.getPrefs()
      const remindDay = (prefs.remindDays && prefs.remindDays[0]) || 3
      const canPush = !!api.CFG.subscribeTmplId && String(n.id).indexOf('c_') === 0

      // 官方来源：每条都要落到一个可核对的机构官网
      const official = officialLib.siteOf(n)

      this.setData({
        id: n.id,
        notice: safe,
        days: days === null ? -1 : days,
        level: D.level(days),
        isFav: store.isFavorite(n.id),
        isApplied: store.isApplied(n.id),
        labels: lbl,
        infoRows: rows,
        keyInfo: keyInfo,
        conf: conf,
        confEdition: (conf && conf.edition) || '',
        confRoles: (conf && conf.roles) || [],
        confFee: (conf && conf.fee) || '',
        confFeeNote: (conf && conf.feeNote) || '',
        confVenueLine: (conf && conf.venueLine) || '',
        confVenueHall: (conf && conf.venueHall) || '',
        confDates: (conf && conf.dates) || '',
        confVenueOk: !!(conf && conf.venueStatus === 'confirmed'),
        confTopics: (conf && conf.topics) || [],
        confSessions: (conf && conf.sessions) || [],
        confWho: confWho,
        official: official,
        officialUrl: (official && official.url) || '',
        noticeUrl: (official && official.noticeUrl) || '',
        searchUrl: (official && official.searchUrl) || '',
        rank: rank,
        ladder: ladder,
        related: related,
        govName: GOV_NAME[n.level] || '',
        freq: n.freq || '',
        peerNote: n.peerNote || n.curated || '',
        confNote: (conf && conf.note && conf.note !== n.peerNote && conf.note !== n.curated) ? conf.note : '',
        dateWarn: dateWarn,
        typeName: t ? t.name : '',
        loading: false,
        err: '',
        isRaw: n.status === 'raw' && conditions.length === 0,
        remindText: '截止前 ' + remindDay + ' 天 · ' + (canPush ? '微信推送' : '写入手机日历响铃'),
        adBanner: ads.bannerId()
      })

      wx.setNavigationBarTitle({ title: n.title.length > 12 ? n.title.slice(0, 12) + '…' : n.title })
    } catch (e) {
      this.setData({ loading: false, err: '页面渲染出错：' + e.message })
    }
  },

  onShow () {
    if (!this.data.notice) return
    this.setData({
      isFav: store.isFavorite(this.data.id),
      isApplied: store.isApplied(this.data.id)
    })
  },

  toggleLadder () {
    this.setData({ ladderOpen: !this.data.ladderOpen })
  },

  toggleFav () {
    const on = store.toggleFavorite(this.data.id)
    this.setData({ isFav: on })
    wx.showToast({ title: on ? '已收藏' : '已取消收藏', icon: 'none' })
    // 收藏变化同步上云（subs 集合），供每天 08:00 的 notify 只推收藏的临期项
    const n = this.data.notice
    if (n) {
      if (on) {
        api.syncFavs([{ id: this.data.id, title: n.title, deadline: n.deadline, type: n.type, org: n.org }])
      } else {
        api.syncFavs([], [String(this.data.id)])
      }
    }
  },

  toggleApplied () {
    const on = store.toggleApplied(this.data.id)
    this.setData({ isApplied: on })
    wx.showToast({ title: on ? '已标记为已申报' : '已取消标记', icon: 'none' })
  },

  // 信息报错 / 补充：引导到公众号「创艺喵」反馈（原占位邮箱，现统一为公众号）
  onFeedback () {
    const name = '创艺喵'
    wx.showModal({
      title: '信息报错 / 补充',
      content: '发现截止时间有误、信息过期，或漏了某条申报？关注公众号「' + name + '」发消息反馈，核实后会上架或更正。',
      confirmText: '复制公众号名',
      cancelText: '知道了',
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

  // 提醒：优先写进手机系统日历（不依赖云开发）；有订阅模板时叠加微信推送
  remind () {
    const n = this.data.notice
    const self = this
    if (!n) return
    if (!n.deadline) {
      wx.showToast({ title: '这条还没确认截止时间', icon: 'none' })
      return
    }

    const tmplId = api.CFG.subscribeTmplId
    const canPush = !!tmplId && String(n.id).indexOf('c_') === 0

    if (!canPush) {
      wx.showModal({
        title: '加入手机日历',
        content: '会写一条日历事件到你的手机，并提前 ' + this._remindDay() + ' 天响铃。不需要联网，也不用授权小程序推送。',
        confirmText: '加入日历',
        cancelText: '取消',
        success: function (res) {
          if (res.confirm) self.addCalendar()
        }
      })
      return
    }

    wx.requestSubscribeMessage({
      tmplIds: [tmplId],
      success: function (res) {
        if (res[tmplId] !== 'accept') {
          wx.showToast({ title: '未开启提醒', icon: 'none' })
          return
        }
        api.subscribe({
          noticeId: String(n.id).slice(2),
          deadline: n.deadline,
          remindDay: self._remindDay()
        }).then(function (r) {
          if (r && r.ok) {
            store.toggleFavorite(n.id)
            self.setData({ isFav: true })
            wx.showToast({ title: '已设置提醒', icon: 'success' })
          } else {
            wx.showToast({ title: (r && r.msg) || '设置失败', icon: 'none' })
          }
        })
      },
      fail: function () {
        wx.showToast({ title: '未开启提醒', icon: 'none' })
      }
    })
  },

  _remindDay () {
    const prefs = store.getPrefs()
    return (prefs.remindDays && prefs.remindDays[0]) || 3
  },

  addCalendar () {
    const n = this.data.notice
    if (!n || !n.deadline) return
    if (!wx.addPhoneCalendar) {
      wx.showModal({
        title: '当前微信版本不支持',
        content: '请把微信升级到最新版本，或手动记下截止日：' + (n.deadlineText || n.deadline),
        showCancel: false
      })
      return
    }
    const p = String(n.deadline).split('-')
    const ts = Math.floor(new Date(
      parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10), 9, 0, 0
    ).getTime() / 1000)
    try {
      wx.addPhoneCalendar({
        title: '截止：' + n.title,
        startTime: ts,
        endTime: ts + 3600,
        allDay: false,
        alarm: true,
        alarmOffset: this._remindDay() * 86400,
        description: (n.org || '') + '\n' + (n.sourceUrl || ''),
        success: function () {
          wx.showToast({ title: '已加入手机日历', icon: 'success' })
        },
        fail: function (err) {
          const m = (err && err.errMsg) || ''
          if (m.indexOf('cancel') > -1) return
          wx.showToast({ title: '写入失败，可手动记录', icon: 'none' })
        }
      })
    } catch (e) {
      wx.showToast({ title: '写入失败，可手动记录', icon: 'none' })
    }
  },

  // 官方来源：优先原文页，其次栏目列表，最后机构首页；三级在界面上要说清楚
  copyOfficial () {
    const o = this.data.official || {}
    const url = o.url || ''
    if (!url) {
      wx.showModal({
        title: '未收录官网',
        content: '这条来自「' + (o.name || '发布机构') + '」。该机构没有稳定可收录的官网地址，建议在微信「搜一搜」里直接搜机构全名。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    const tip = o.level === 'notice'
      ? '原文链接已复制'
      : (o.level === 'section' ? '栏目地址已复制' : '官网地址已复制')
    wx.setClipboardData({
      data: url,
      success: function () { wx.showToast({ title: tip, icon: 'success' }) }
    })
  },

  // 只有栏目、没有原文时的兜底：复制一条直达这篇通知的站内检索式
  copySearch () {
    const url = this.data.searchUrl
    if (!url) {
      wx.showToast({ title: '暂无检索链接', icon: 'none' })
      return
    }
    wx.setClipboardData({
      data: url,
      success: function () { wx.showToast({ title: '检索链接已复制', icon: 'success' }) }
    })
  },

  copyLink () {
    const url = this.bestLink()
    if (!url) {
      wx.showModal({
        title: '没有可复制的地址',
        content: '这条信息的发布机构没有稳定官网，给不出直达地址。建议在微信「搜一搜」里搜通知标题。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }
    wx.setClipboardData({
      data: url,
      success: function () {
        wx.showToast({ title: '链接已复制', icon: 'success' })
      }
    })
  },

  // 附件本体不转载（合规要求：只存结构化摘要 + 原文地址），
  // 所以「获取」能给的只有「去哪拿」。但绝不能给一个空窗口——
  // 必须按 原文页 > 栏目页 > 首页 > 检索式 的顺序，总能落到一个可复制的地址。
  bestLink () {
    const n = this.data.notice || {}
    const o = this.data.official || {}
    if (n.sourceUrl) return n.sourceUrl
    if (o.level === 'notice' && o.url) return o.url
    if (o.url) return o.url
    return this.data.searchUrl || ''
  },

  onFile (e) {
    const name = e.currentTarget.dataset.name || '附件'
    const url = e.currentTarget.dataset.url || ''
    const link = url || this.bestLink()

    if (!link) {
      wx.showModal({
        title: name,
        content: '这条信息的发布机构没有稳定官网，给不出直达地址。可以在微信「搜一搜」里搜通知标题找原文。',
        showCancel: false,
        confirmText: '知道了'
      })
      return
    }

    // 一步到位：点一下就复制，不再让用户点第二遍
    wx.setClipboardData({
      data: link,
      success: function () {
        try {
          if (wx.vibrateShort) wx.vibrateShort({ type: 'light' })
        } catch (err) {}
        wx.showModal({
          title: '已复制',
          content: url
            ? '这是附件本身的下载地址，粘贴到浏览器即可下载。'
            : '「' + name + '」不在小程序内转载（只做摘要，避免版权与更新问题）。链接已复制到剪贴板，粘贴到浏览器或电脑打开，附件在原文页底部。',
          showCancel: false,
          confirmText: '知道了'
        })
      },
      fail: function () {
        wx.showToast({ title: '复制失败，请长按链接手动复制', icon: 'none' })
      }
    })
  },

  goRelated (e) {
    const id = e.currentTarget.dataset.id
    if (!id) return
    // 分享进来直接落在详情、或通行证已过期时，这里也要过一次门
    ads.gate(function () {
      wx.redirectTo({ url: '/pages/detail/detail?id=' + id })
    })
  },

  goBack () {
    wx.navigateBack({
      fail: function () { wx.switchTab({ url: '/pages/index/index' }) }
    })
  },

  onShareAppMessage () {
    const n = this.data.notice
    const d = this.data.days
    let title = '青椒的日历 · 科研申报截止日历'
    if (n) {
      title = d >= 0 ? (n.title + '（' + d + ' 天后截止）') : n.title
    }
    return {
      title: title,
      path: '/pages/detail/detail?id=' + this.data.id
    }
  }
})
