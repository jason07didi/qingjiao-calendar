// 会员码：离线校验，包里不留码表（固定码除外）。
//
// 两种码并存：
//   1. 固定码（FIXED）—— 短、好记、便于口头传达，当前为 62547
//   2. 算法码 —— "QT" + 8 位主体 + 4 位校验位，校验位由主体算出，可无限发码
// 算法码的好处：可无限发码、不用维护清单、断网也能验证。
//
// 【安全边界，必须说清】
// 没有服务端时，任何本地校验都能被解包破解——这里的定位是
// 「防手误、防随手转发」，不是防破解。云开发开通后应改为：
//   codes 集合（code / used / openid / usedAt）由云函数一次性核销，
// 客户端只拿结果，不再做本地判断。

const KEY = 'qt_vip_v1'
const PREFIX = 'QT'

// 固定码表：加一个码就往数组里加一条，改完重新编译即生效。
// 短码便于口头/微信里传达；代价是容易被猜到，只做免广告用途。
const FIXED = ['62547']

// 打散的盐。让算法不那么一眼看穿，不是密钥。
const S = [0x2f, 0x1b, 0x6d, 0x07, 0x93, 0x3a]

// 去掉了 I 和 O，避免和 1、0 抄错
const ALPHA = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function p2 (n) { return n < 10 ? '0' + n : '' + n }

// 统一输入：去符号、转大写、剥掉前缀（只有总长 14 位时才剥，
// 否则主体恰好以 QT 开头的码会被误剥）
function norm (raw) {
  let s = String(raw || '').toUpperCase().replace(/[^0-9A-Z]/g, '')
  if (s.length === PREFIX.length + 12 && s.slice(0, PREFIX.length) === PREFIX) {
    s = s.slice(PREFIX.length)
  }
  return s
}

// 由 8 位主体算出 4 位校验位
function check (body) {
  let h = 0x811c9dc5
  for (let i = 0; i < body.length; i++) {
    h = (h ^ body.charCodeAt(i)) >>> 0
    h = ((h * 0x01000193) >>> 0)
    h = (h ^ S[i % S.length]) >>> 0
  }
  const L = ALPHA.length
  let n = h % (L * L * L * L)
  let out = ''
  for (let j = 0; j < 4; j++) {
    out = ALPHA.charAt(n % L) + out
    n = Math.floor(n / L)
  }
  return out
}

function isFixed (s) {
  return FIXED.indexOf(String(s || '')) > -1
}

function verify (raw) {
  const s = norm(raw)
  if (!s) return false
  if (isFixed(s)) return true
  if (s.length !== 12) return false
  return check(s.slice(0, 8)) === s.slice(8)
}

// 生成一个码（供 tools/gen_vip_code.js 使用，页面里不调用）
function makeCode (body) {
  let b = ''
  if (body) {
    const raw = String(body).toUpperCase().replace(/[^0-9A-Z]/g, '')
    for (let i = 0; i < raw.length && b.length < 8; i++) {
      if (ALPHA.indexOf(raw.charAt(i)) > -1) b += raw.charAt(i)
    }
  }
  while (b.length < 8) {
    b += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length))
  }
  return PREFIX + b + check(b)
}

// 带连字符的展示形式，方便手抄
function pretty (code) {
  const s = norm(code)
  if (s.length !== 12) return s
  return PREFIX + '-' + s.slice(0, 4) + '-' + s.slice(4, 8) + '-' + s.slice(8)
}

function status () {
  let v = null
  try { v = wx.getStorageSync(KEY) } catch (e) { v = null }
  if (!v || !v.code || !verify(v.code)) {
    return { on: false, code: '', since: '' }
  }
  const s = norm(v.code)
  return {
    on: true,
    // 已被用户自己看过一遍，展示时一律打码，避免截图外泄
    code: isFixed(s) ? '•••••' : (PREFIX + '-' + s.slice(0, 4) + '-••••-' + s.slice(8)),
    since: v.since || ''
  }
}

function isVip () {
  return status().on
}

function activate (raw) {
  const s = norm(raw)
  if (!s) return { ok: false, msg: '请先输入会员码' }
  if (!verify(s)) {
    return { ok: false, msg: '会员码不对，检查一下有没有多输或抄错' }
  }
  const d = new Date()
  const since = d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate())
  try {
    wx.setStorageSync(KEY, { code: s, since: since })
  } catch (e) {
    return { ok: false, msg: '保存失败，请重试' }
  }
  return { ok: true, msg: '已开通，不再显示广告' }
}

function clear () {
  try { wx.removeStorageSync(KEY) } catch (e) {}
}

module.exports = {
  norm: norm,
  check: check,
  verify: verify,
  isFixed: isFixed,
  FIXED: FIXED,
  makeCode: makeCode,
  pretty: pretty,
  status: status,
  isVip: isVip,
  activate: activate,
  clear: clear
}
