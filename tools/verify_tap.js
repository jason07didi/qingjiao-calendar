// tools/verify_tap.js — 逐个按钮点一遍，确认不是摆设
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const out = []
const log = function (s) { out.push(s) }

let copyData = null
let modal = null
let toast = null
let cal = null
let vibration = 0
const store = {}

global.wx = {
  getStorageSync: function (k) { return store[k] === undefined ? null : store[k] },
  setStorageSync: function (k, v) { store[k] = v },
  showToast: function (o) { toast = o },
  showModal: function (o) { modal = o; if (o && o.success) o.success({ confirm: true }) },
  showActionSheet: function () {},
  setClipboardData: function (o) {
    copyData = o.data
    if (o.success) o.success()
  },
  vibrateShort: function () { vibration++ },
  setNavigationBarTitle: function () {},
  navigateBack: function () {},
  switchTab: function () {},
  redirectTo: function () {},
  navigateTo: function () {},
  stopPullDownRefresh: function () {},
  requestSubscribeMessage: function () {},
  addPhoneCalendar: function (o) { cal = o; if (o.success) o.success() }
}

const lib = require(path.join(ROOT, 'utils/notices.js'))
const api = require(path.join(ROOT, 'utils/api.js'))
const off = require(path.join(ROOT, 'utils/official.js'))
const all = lib.getAll()

let fail = 0
function ok (name, cond, extra) {
  if (!cond) fail++
  log((cond ? '  OK  ' : '  ✗✗  ') + name + (extra ? '   [' + extra + ']' : ''))
}

let def = null
global.Page = function (o) { def = o }
require(path.join(ROOT, 'pages/detail/detail.js'))
const ctx = Object.assign({}, def)
ctx.data = JSON.parse(JSON.stringify(def.data))
ctx.setData = function (patch, cb) { Object.assign(this.data, patch); if (cb) cb.call(this) }

function tap (handler, dataset) {
  copyData = null
  modal = null
  toast = null
  cal = null
  vibration = 0
  ctx[handler]({ currentTarget: { dataset: dataset || {} } })
}

// ---------- 1. 附件「复制链接」逐条打 ----------
log('[1] 附件点击（101 条逐条打）')
let noLink = 0
let badUrl = 0
let noFeedback = 0
const samples = []
all.forEach(function (n) {
  ctx.render(Object.assign({}, n, { id: String(n.id) }))
  const files = n.files || []
  const f = files[0] || { name: '（无附件）' }
  tap('onFile', { name: f.name, url: f.url })

  const got = copyData
  const reacted = !!got || !!modal || !!toast
  if (!reacted) { noFeedback++; log('    无任何反馈: ' + n.id + ' ' + n.type) }
  if (!got) { noLink++; log('    复制为空: ' + n.id + ' ' + n.type + '  ' + (n.org || '')); return }
  if (!/^https?:\/\//.test(got)) { badUrl++; log('    非 http 地址: ' + n.id + '  ' + got) }
  if (samples.length < 6) samples.push(n.id + ' → ' + got.slice(0, 72))
})
ok('点击全部有反馈', noFeedback === 0, noFeedback + ' 条无反应')
ok('复制内容全部非空', noLink === 0, noLink + ' 条为空')
ok('复制内容全部是 http 地址', badUrl === 0)
log('  抽样：')
samples.forEach(function (s) { log('    ' + s) })

// ---------- 2. 其它按钮 ----------
log('\n[2] 其它按钮')
const one = all.find(function (n) { return (n.files || []).length && n.sourceUrl }) || all[0]
ctx.render(Object.assign({}, one, { id: String(one.id) }))

tap('copyLink')
ok('复制原文链接有内容', !!copyData, (copyData || '').slice(0, 50))

tap('copyOfficial')
ok('复制官方来源有内容', !!copyData, (copyData || '').slice(0, 50))

tap('copySearch')
ok('复制检索式可用（无原文时）', !!copyData || !!toast, (copyData || '').slice(0, 60))

tap('toggleFav')
ok('收藏切换有反馈', !!toast, toast ? toast.title : '')
tap('toggleFav')
ok('取消收藏有反馈', !!toast && toast.title.indexOf('取消') > -1, toast ? toast.title : '')

tap('toggleApplied')
ok('标记申报有反馈', !!toast, toast ? toast.title : '')
tap('toggleApplied')

const beforeCal = cal
tap('remind')
ok('提醒走日历或弹窗', !!cal || !!modal,
  cal ? 'wx.addPhoneCalendar 已调用' : (modal ? modal.title : '无'))

// 无截止日的条目不该崩溃
const noDl = all.find(function (n) { return !n.deadline })
if (noDl) {
  ctx.render(Object.assign({}, noDl, { id: String(noDl.id) }))
  tap('remind')
  ok('无截止日条目点提醒有提示', !!toast || !!modal, toast ? toast.title : (modal ? modal.title : ''))
}

// 同类推荐跳转
ctx.render(Object.assign({}, one, { id: String(one.id) }))
if (ctx.data.related.length) {
  let jumped = null
  wx.redirectTo = function (o) { jumped = o.url }
  tap('goRelated', { id: ctx.data.related[0].id })
  ok('同类推荐可跳转', !!jumped && jumped.indexOf('id=') > -1, jumped || '')
}

// ---------- 3. 官方来源三级都有出口 ----------
log('\n[3] 官方来源出口')
let dead = 0
all.forEach(function (n) {
  const s = off.siteOf(n)
  const hasExit = !!(s.url || s.searchUrl)
  if (!hasExit) { dead++; log('    无出口: ' + n.id + ' ' + (n.org || '')) }
})
ok('每条都能落到一个可复制地址', dead === 0, dead + ' 条无出口')

log('\n' + (fail === 0 ? '===== 全部通过 =====' : '===== ' + fail + ' 项未通过 ====='))
fs.writeFileSync(path.join(__dirname, 'tap_out.txt'), out.join('\n'), 'utf8')
