// 广告（激励视频门 + 24 小时通行证）与会员码自测
// 不打开开发者工具也能验证：看完发证、跳过不发、失败放行、会员直通。
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
let pass = 0
const fails = []

function ok (name, cond, extra) {
  if (cond) {
    pass++
  } else {
    fails.push(name + (extra ? ' → ' + extra : ''))
    console.log('  ✗ ' + name + (extra ? '  ' + extra : ''))
  }
}

/* ---------- mock 运行环境 ---------- */
const mem = {}
let rvCtl = { created: 0, shown: 0, loaded: 0, showFail: 0, loadFail: false, lastId: '' }
let rvH = {}
let ui = { toast: [], loading: 0, hide: 0, nav: [] }

global.wx = {
  getStorageSync: function (k) { return mem[k] === undefined ? '' : mem[k] },
  setStorageSync: function (k, v) { mem[k] = v },
  removeStorageSync: function (k) { delete mem[k] },
  showToast: function (o) { ui.toast.push(o && o.title) },
  showLoading: function () { ui.loading++ },
  hideLoading: function () { ui.hide++ },
  showModal: function () {},
  navigateTo: function (o) { ui.nav.push(o.url) },
  redirectTo: function (o) { ui.nav.push(o.url) },
  switchTab: function () {},
  setNavigationBarTitle: function () {},
  setClipboardData: function () {},
  stopPullDownRefresh: function () {},
  createRewardedVideoAd: function (cfg) {
    rvCtl.created++
    rvCtl.lastId = cfg.adUnitId
    return {
      onLoad: function (f) { rvH.load = f },
      onError: function (f) { rvH.error = f },
      onClose: function (f) { rvH.close = f },
      load: function () {
        rvCtl.loaded++
        if (rvCtl.loadFail) return Promise.reject(new Error('no fill'))
        return Promise.resolve()
      },
      show: function () {
        rvCtl.shown++
        if (rvCtl.showFail > 0) {
          rvCtl.showFail--
          return Promise.reject(new Error('not ready'))
        }
        return Promise.resolve()
      }
    }
  }
}

global.getApp = function () { return { globalData: { brand: '#123B5B' } } }
global.getCurrentPages = function () { return [{ route: 'pages/index/index' }] }

const vip = require(path.join(ROOT, 'utils/vip.js'))
const ads = require(path.join(ROOT, 'utils/ads.js'))

function resetAd () {
  rvCtl = { created: 0, shown: 0, loaded: 0, showFail: 0, loadFail: false, lastId: '' }
  ui = { toast: [], loading: 0, hide: 0, nav: [] }
}

function tick (ms) {
  return new Promise(function (r) { setTimeout(r, ms || 5) })
}

async function main () {
  /* ---------- 1. 会员码 ---------- */
  console.log('\n[1] 会员码生成与校验')

  let genOk = 0
  for (let i = 0; i < 200; i++) {
    if (vip.verify(vip.makeCode())) genOk++
  }
  ok('200 个随机码全部通过校验', genOk === 200, genOk + '/200')
  ok('码长度恒为 14（QT + 12）', vip.makeCode().length === 14)
  ok('错一位必须失败', (function () {
    const c = vip.norm(vip.makeCode())
    const bad = c.slice(0, 11) + (c.charAt(11) === 'A' ? 'B' : 'A')
    return vip.verify(bad) === false
  })())
  ok('空值必须失败', vip.verify('') === false)
  ok('随便一串必须失败', vip.verify('helloworld12') === false)
  ok('连字符/空格不影响', vip.verify(vip.pretty(vip.makeCode()).replace(/-/g, ' ')))
  ok('小写也能识别', vip.verify(vip.makeCode().toLowerCase()))
  ok('主体以 QT 开头也不会误剥', (function () {
    const c = vip.makeCode('QTQQ1234')
    return vip.verify(c) && vip.norm(c).length === 12
  })())
  ok('activate 错码给出明确提示', (function () {
    const r = vip.activate('QT123')
    return r.ok === false && r.msg.indexOf('会员码') > -1
  })())
  ok('固定码 62547 可激活', (function () {
    vip.clear()
    const r = vip.activate('62547')
    const on = vip.isVip()
    vip.clear()
    return r.ok === true && on === true
  })())
  ok('activate 错码不会写入', (function () {
    vip.clear()
    const r = vip.activate('QTZZZZZZZZZZ')
    return r.ok === false && vip.isVip() === false
  })())

  /* ---------- 2. 会员状态 ---------- */
  console.log('\n[2] 会员状态与存储')

  vip.activate(vip.makeCode())
  ok('激活后 isVip 为真', vip.isVip() === true)
  const st = vip.status()
  ok('状态里带开通日期', /^\d{4}-\d{2}-\d{2}$/.test(st.since), st.since)
  ok('码在页面上打码显示', st.code.indexOf('••••') > -1, st.code)
  vip.clear()
  ok('退出后 isVip 为假', vip.isVip() === false)

  /* ---------- 3. 通行证 ---------- */
  console.log('\n[3] 24 小时通行证')

  vip.clear()
  ads.clearPass()
  ok('广告位 ID 已配置', ads.CFG.rewarded === 'adunit-182cec688b088602', ads.CFG.rewarded)
  ok('通行证时长是 24 小时', ads.CFG.passHours === 24)
  ok('非会员且无通行证 → 需要看广告', ads.needGate() === true)
  ok('没有通行证时剩余文案为空', ads.passLeftText() === '')

  ads.grantPass()
  ok('发放后 hasPass 为真', ads.hasPass() === true)
  ok('剩余时间显示为 24 小时', /^2[34] 小时$/.test(ads.passLeftText()), ads.passLeftText())
  ok('有通行证 → 不用再看广告', ads.needGate() === false)

  // 手动把到期时间改成过去，验证会自动失效
  mem[ads.PASS_KEY] = Date.now() - 1000
  ok('过期后自动失效', ads.hasPass() === false && ads.needGate() === true)
  ads.clearPass()

  vip.activate('62547')
  ok('会员 → 永远不需要看广告', ads.needGate() === false)
  vip.clear()

  /* ---------- 4. 激励视频门的行为 ---------- */
  console.log('\n[4] 激励视频门')

  // 4.1 看完 → 发证 + 放行
  resetAd()
  ads.clearPass()
  let r1 = null
  ads.gate(function (okv, reason) { r1 = { ok: okv, reason: reason } })
  ok('点了才创建实例', rvCtl.created === 1 && rvCtl.shown === 1)
  ok('用的是配置里的广告位 ID', rvCtl.lastId === ads.CFG.rewarded)
  ok('播放中不重复进详情（等 onClose）', r1 === null)
  rvH.close({ isEnded: true })
  ok('看完 → 放行并标记 watched', r1 && r1.ok === true && r1.reason === 'watched', JSON.stringify(r1))
  ok('看完 → 发放 24 小时通行证', ads.hasPass() === true)
  ok('看完 → 有提示文案', ui.toast.join('/').indexOf('24 小时') > -1, ui.toast.join('/'))

  // 4.2 跳过 → 放行但不发证（不把广告做成唯一入口）
  resetAd()
  ads.clearPass()
  let r2 = null
  ads.gate(function (okv, reason) { r2 = { ok: okv, reason: reason } })
  rvH.close({ isEnded: false })
  ok('中途关掉 → 仍然放行', r2 && r2.ok === true, JSON.stringify(r2))
  ok('中途关掉 → 不给通行证', ads.hasPass() === false)
  ok('中途关掉 → 标记 skipped', r2 && r2.reason === 'skipped')

  // 4.3 会员直通：一个广告请求都不发
  resetAd()
  ads.clearPass()
  vip.activate('62547')
  let r3 = null
  ads.gate(function (okv, reason) { r3 = { ok: okv, reason: reason } })
  ok('会员直通，不发广告请求', rvCtl.created === 0 && rvCtl.shown === 0)
  ok('会员直通标记 free', r3 && r3.reason === 'free')
  vip.clear()

  // 4.4 有通行证直通
  resetAd()
  ads.grantPass()
  let r4 = null
  ads.gate(function (okv, reason) { r4 = { ok: okv, reason: reason } })
  ok('通行证期内直通，不发广告请求', rvCtl.created === 0 && r4 && r4.reason === 'free')
  ads.clearPass()

  // 4.5 第一次 show 失败 → 自动重试后成功
  resetAd()
  ads._setState({ resetInst: true, dead: false })
  rvCtl.showFail = 1
  let r5 = null
  ads.gate(function (okv, reason) { r5 = { ok: okv, reason: reason } })
  await tick(20)
  ok('show 失败会自动 load 后重试', rvCtl.shown === 2 && rvCtl.loaded >= 1)
  rvH.close({ isEnded: true })
  ok('重试成功看完仍然发证', r5 && r5.reason === 'watched' && ads.hasPass() === true)

  // 4.6 两次都失败 → 直接放行，绝不挡人
  resetAd()
  ads.clearPass()
  ads._setState({ resetInst: true, dead: false })
  rvCtl.showFail = 1
  rvCtl.loadFail = true
  let r6 = null
  ads.gate(function (okv, reason) { r6 = { ok: okv, reason: reason } })
  await tick(20)
  ok('广告拉不到 → 仍然放行', r6 && r6.ok === true, JSON.stringify(r6))
  ok('广告拉不到 → 标记 failed', r6 && r6.reason === 'failed')
  ok('广告拉不到 → 不发放通行证', ads.hasPass() === false)

  // 4.7 环境不支持（低版本 / 工具里没有该能力）
  resetAd()
  ads._setState({ resetInst: true, dead: true })
  let r7 = null
  ads.gate(function (okv, reason) { r7 = { ok: okv, reason: reason } })
  ok('不支持激励视频 → 直接放行', r7 && r7.ok === true && r7.reason === 'unavailable')
  ads._setState({ dead: false, resetInst: true })

  // 4.8 连点只播一次
  resetAd()
  ads.clearPass()
  let count = 0
  ads.gate(function () { count++ })
  ads.gate(function () { count++ })
  ok('连点两次只播一条', rvCtl.shown === 1)
  rvH.close({ isEnded: true })
  ok('连点只回调一次', count === 1)

  // 4.9 总开关关掉 = 全站零广告
  ads.clearPass()
  ads.CFG.enabled = false
  resetAd()
  let r9 = null
  ads.gate(function (okv, reason) { r9 = { ok: okv, reason: reason } })
  ok('总开关关闭 → 直通且不请求广告', r9 && r9.reason === 'free' && rvCtl.created === 0)
  ads.CFG.enabled = true

  /* ---------- 5. 广告位（banner/插屏保持关闭） ---------- */
  console.log('\n[5] banner 与插屏保持静默')

  ok('详情页 banner 未配置', ads.CFG.detailBanner === '' && ads.bannerId() === '')
  ok('插屏未配置', ads.CFG.interstitial === '' && ads.canShow() === false)
  ok('返回列表不会弹插屏', ads.showOnBack() === false)

  /* ---------- 6. 页面接线 ---------- */
  console.log('\n[6] 页面是否真的走了这道门')

  const pages = [
    ['pages/index/index.js', '首页'],
    ['pages/calendar/calendar.js', '日历页'],
    ['pages/favorites/favorites.js', '收藏页'],
    ['pages/detail/detail.js', '详情页「相关信息」']
  ]
  pages.forEach(function (p) {
    const src = fs.readFileSync(path.join(ROOT, p[0]), 'utf8')
    const hasGate = src.indexOf('ads.gate(') > -1
    // 跳转必须在 gate 的回调里，不能写在 gate 外面
    const inCallback = /ads\.gate\(function[\s\S]{0,120}?navigateTo|ads\.gate\(function[\s\S]{0,120}?redirectTo/.test(src)
    ok(p[1] + ' 打开详情前先过广告门', hasGate, '未找到 ads.gate')
    ok(p[1] + ' 跳转写在 gate 回调里', inCallback, '跳转可能在门外')
  })

  const dw = fs.readFileSync(path.join(ROOT, 'pages/detail/detail.wxml'), 'utf8')
  ok('详情页 banner 仍有 wx:if 守卫', /<view class="ad-slot" wx:if="\{\{adBanner\}\}">/.test(dw))

  const mw = fs.readFileSync(path.join(ROOT, 'pages/mine/mine.wxml'), 'utf8')
  const mjs = fs.readFileSync(path.join(ROOT, 'pages/mine/mine.js'), 'utf8')
  ok('会员码入口挂在 VIP 徽标上', mw.indexOf('catchtap="onVipBadge"') > -1 && mjs.indexOf('editable: true') > -1)
  ok('会员区不再单独放输入框', mw.indexOf('vip-input') === -1 && mw.indexOf('activateVip') === -1)
  ok('「会员」「提醒节点」两块已移除', mw.indexOf('remind-wrap') === -1 && mw.indexOf('class="pass-row"') === -1)

  /* ---------- 汇总 ---------- */
  console.log('\n' + '='.repeat(46))
  if (fails.length === 0) {
    console.log('全部通过：' + pass + ' 项')
  } else {
    console.log('通过 ' + pass + ' 项，未通过 ' + fails.length + ' 项：')
    fails.forEach(function (f) { console.log('  - ' + f) })
    process.exitCode = 1
  }
  console.log('='.repeat(46))
  // ads.js 里有 3 分钟兜底解锁定时器，直接退出，避免测试进程挂着
  process.exit(fails.length === 0 ? 0 : 1)
}

main().catch(function (e) {
  console.log('  ✗ 跑了异常：' + e.message)
  process.exitCode = 1
})
