// 广告策略：激励视频门 + 24 小时通行证
//
// 【现在的规则】
//   点任意一条信息 → 若没有通行证、也不是会员 → 先播一条激励视频
//     · 看完   → 发放 24 小时通行证，直接进详情，之后 24 小时内全部直通
//     · 没看完 → 也放行（不把广告做成唯一入口），但不发通行证
//     · 播不出 → 直接放行（广告位审核中/无填充/开发者工具不支持都会走到这）
//   会员码（vip.isVip）→ 永远直通，一个广告都不请求
//
// 【为什么「没看完」和「播不出」也放行】
// 微信《小程序运营规范》2.5.13 与激励视频文档都禁止把「看完广告」设为使用
// 功能的必要条件，也不允许诱导观看。硬拦的结果：审核驳回、限期整改，
// 以及真实用户直接退出——这个产品的价值是「别错过截止日」，不是「广告墙」。
// 所以策略是：广告是门槛的默认形态，但每一层都有出口。
//
// 【激励视频实例的作用域】
// wx.createRewardedVideoAd 同一 adUnitId 全局单例，这里放在模块级缓存，
// 跨页面复用；首页 onLaunch/onLoad 时 preload 一次，减少点开时的等待。
//
// 【插屏与 banner】
// 保留代码但实际不启用（ID 为空即不生效）。当前只走激励视频，不再在
// 详情页底部放 banner、也不在返回列表时弹插屏——一个入口只放一种广告。
const vip = require('./vip.js')

// 通行证到期时间戳（毫秒）。存本地：换手机或清缓存会重看一次广告，无伤大雅。
const PASS_KEY = 'qt_ad_pass_until'

const CFG = {
  // 总开关：false = 全站零广告、零广告请求，所有门直接放行
  enabled: true,

  rewarded: 'adunit-182cec688b088602',  // 激励视频广告位
  passHours: 24,                        // 看完一次管多久

  detailBanner: '',       // 详情页 banner（留空 = 不渲染）
  interstitial: '',       // 插屏（留空 = 不创建）

  backCooldown: 3 * 60 * 1000,
  backMaxPerSession: 2,
  readWindow: 60 * 1000
}

let rv = null          // 激励视频实例
let rvDead = false     // 环境不支持 / 创建失败，永久不再尝试
let rvReady = false    // 是否已 load 到可播
let pending = null     // 正在等待 onClose 的回调

/* ---------------- 小工具 ---------------- */

function toast (title, icon) {
  if (typeof wx === 'undefined' || !wx.showToast) return
  try { wx.showToast({ title: title, icon: icon || 'none', duration: 1800 }) } catch (e) {}
}

function showLoading (title) {
  if (typeof wx === 'undefined' || !wx.showLoading) return
  try { wx.showLoading({ title: title || '加载中', mask: true }) } catch (e) {}
}

function hideLoading () {
  if (typeof wx === 'undefined' || !wx.hideLoading) return
  try { wx.hideLoading() } catch (e) {}
}

/* ---------------- 通行证 ---------------- */

function passUntil () {
  try { return Number(wx.getStorageSync(PASS_KEY)) || 0 } catch (e) { return 0 }
}

function hasPass () {
  return Date.now() < passUntil()
}

function passLeftMs () {
  const left = passUntil() - Date.now()
  return left > 0 ? left : 0
}

// 给「我的」页显示用：还剩多久
function passLeftText () {
  const ms = passLeftMs()
  if (!ms) return ''
  const h = Math.floor(ms / 3600000)
  const m = Math.round((ms % 3600000) / 60000)
  if (h >= 1) return h + ' 小时'
  return (m < 1 ? 1 : m) + ' 分钟'
}

function grantPass () {
  try { wx.setStorageSync(PASS_KEY, Date.now() + CFG.passHours * 3600000) } catch (e) {}
}

function clearPass () {
  try { wx.removeStorageSync(PASS_KEY) } catch (e) {}
}

// 这次点击要不要过广告门
function needGate () {
  if (!CFG.enabled) return false
  if (!CFG.rewarded) return false
  if (vip.isVip()) return false       // 会员永远直通
  if (hasPass()) return false         // 24 小时内直通
  return true
}

/* ---------------- 激励视频实例 ---------------- */

function setupRewarded () {
  if (rv) return rv
  if (rvDead) return null
  if (typeof wx === 'undefined' || !wx.createRewardedVideoAd) {
    rvDead = true
    return null
  }
  try {
    rv = wx.createRewardedVideoAd({ adUnitId: CFG.rewarded })
    rv.onLoad(function () { rvReady = true })
    rv.onError(function () {
      rvReady = false
      // 拉不到广告时不能把人挡在门外
      if (pending) settle(null)
    })
    rv.onClose(function (res) {
      // 基础库低于 2.1.0 时 res 是 undefined，旧版本按「看完」处理
      const ended = !res ? true : !!res.isEnded
      settle(ended)
    })
  } catch (e) {
    rvDead = true
    rv = null
  }
  return rv
}

// 统一收口：无论看完 / 跳过 / 失败，都只走这里一次
function settle (ended) {
  hideLoading()
  const cb = pending
  pending = null
  if (ended === true) {
    grantPass()
    toast('已获得 ' + CFG.passHours + ' 小时免广告')
  }
  if (cb) cb(ended)
}

function retryShow (ad) {
  const fail = function () { settle(null) }
  let p
  try { p = ad.load() } catch (e) { return fail() }
  if (!p || !p.then) return fail()
  p.then(function () {
    return ad.show()
  }).then(function () {
    hideLoading()
  }).catch(fail)
}

// 预加载：首页启动时调一次，点开时就不用等
function preload () {
  if (!needGate()) return
  const ad = setupRewarded()
  if (!ad || rvReady) return
  try {
    const p = ad.load()
    if (p && p.catch) p.catch(function () {})
  } catch (e) {}
}

// 主入口。onDone(ok, reason)
//   ok     恒为 true（当前策略永远是放行，保留参数是为了以后能改）
//   reason 'free' | 'watched' | 'skipped' | 'failed' | 'unavailable'
function gate (onDone) {
  const done = typeof onDone === 'function' ? onDone : function () {}

  if (!needGate()) {
    done(true, 'free')
    return
  }
  // 已经在等一次播放结果，忽略重复点击，避免白看两条
  if (pending) return

  const ad = setupRewarded()
  if (!ad) {
    done(true, 'unavailable')
    return
  }

  pending = function (ended) {
    done(true, ended === true ? 'watched' : (ended === false ? 'skipped' : 'failed'))
  }

  showLoading('加载视频')

  let p
  try { p = ad.show() } catch (e) {
    settle(null)
    return
  }
  if (!p || !p.then) {
    // 老基础库的 show() 不返回 Promise，靠 onClose 收尾
    hideLoading()
    return
  }
  p.then(function () {
    // 广告已经在播，收掉 loading，等用户关闭
    hideLoading()
    // 兜底解锁：极少数机型上 onClose 不回调，3 分钟后把锁放开，
    // 只是清 pending（不导航、不发证），避免用户被永久卡在「正在播放」状态
    const pid = pending
    setTimeout(function () {
      if (pending && pending === pid) pending = null
    }, 3 * 60 * 1000)
  }).catch(function () {
    retryShow(ad)
  })
}

/* ---------------- 插屏 / banner（保留但默认不启用） ---------------- */

let sessionCount = 0
let lastAt = 0
let inst = null
let broken = false

function bannerId () {
  if (!CFG.enabled) return ''
  if (vip.isVip()) return ''
  return CFG.detailBanner || ''
}

function setupInterstitial () {
  if (!CFG.enabled || !CFG.interstitial || broken) return null
  if (inst) return inst
  if (typeof wx === 'undefined' || !wx.createInterstitialAd) {
    broken = true
    return null
  }
  try {
    inst = wx.createInterstitialAd({ adUnitId: CFG.interstitial })
    inst.onError(function () { broken = true })
    if (inst.load) {
      const p = inst.load()
      if (p && p.catch) p.catch(function () {})
    }
  } catch (e) {
    broken = true
    inst = null
  }
  return inst
}

function warmup () { setupInterstitial() }

function resetSession () {
  sessionCount = 0
  lastAt = 0
}

function onDetailPage () {
  if (typeof getCurrentPages !== 'function') return false
  try {
    const ps = getCurrentPages()
    const cur = ps[ps.length - 1]
    if (!cur || !cur.route) return false
    return String(cur.route).indexOf('pages/detail/detail') > -1
  } catch (e) {
    return false
  }
}

function canShow () {
  if (!CFG.enabled) return false
  if (vip.isVip()) return false
  if (!CFG.interstitial) return false
  if (onDetailPage()) return false
  if (sessionCount >= CFG.backMaxPerSession) return false
  if (Date.now() - lastAt < CFG.backCooldown) return false
  return true
}

function showOnBack () {
  if (!canShow()) return false
  const ad = setupInterstitial()
  if (!ad) return false
  sessionCount++
  lastAt = Date.now()
  try {
    const p = ad.show()
    if (p && p.catch) p.catch(function () {})
    return true
  } catch (e) {
    return false
  }
}

module.exports = {
  CFG: CFG,
  PASS_KEY: PASS_KEY,

  // 激励视频门
  gate: gate,
  needGate: needGate,
  preload: preload,
  hasPass: hasPass,
  passLeftMs: passLeftMs,
  passLeftText: passLeftText,
  grantPass: grantPass,
  clearPass: clearPass,

  // banner / 插屏
  bannerId: bannerId,
  warmup: warmup,
  showOnBack: showOnBack,
  canShow: canShow,
  resetSession: resetSession,

  // 供自测使用
  _state: function () {
    return { count: sessionCount, lastAt: lastAt, broken: broken, ready: rvReady, dead: rvDead, pending: !!pending }
  },
  _setState: function (s) {
    if (s && s.count !== undefined) sessionCount = s.count
    if (s && s.lastAt !== undefined) lastAt = s.lastAt
    if (s && s.broken !== undefined) broken = s.broken
    if (s && s.ready !== undefined) rvReady = s.ready
    if (s && s.dead !== undefined) rvDead = s.dead
    if (s && s.pending !== undefined) pending = s.pending ? function () {} : null
    if (s && s.resetInst) { inst = null; rv = null }
  }
}
