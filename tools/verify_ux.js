// tools/verify_ux.js —— 交互逻辑自测（不依赖微信开发者工具）
// 用法：node tools/verify_ux.js

const path = require('path')
const fs = require('fs')

const ROOT = path.join(__dirname, '..')
let failed = 0
function ok (name, cond, extra) {
  if (cond) {
    console.log('  ✓ ' + name + (extra ? '  ' + extra : ''))
  } else {
    failed++
    console.log('  ✗ ' + name + (extra ? '  ' + extra : ''))
  }
}

// ---------- 1. 数据层 ----------
console.log('\n[1] 数据合并')
const lib = require(path.join(ROOT, 'utils/notices.js'))
const all = lib.getAll()
ok('条目总数 > 60', all.length > 60, '实际 ' + all.length)
ok('六类齐全', ['project', 'talent', 'award', 'conference', 'special', 'competition']
  .every(function (t) { return all.some(function (n) { return n.type === t }) }))
ok('带条件的条目 > 50', all.filter(function (n) { return (n.conditions || []).length }).length > 50)
ok('带附件的条目 > 50', all.filter(function (n) { return (n.files || []).length }).length > 50)
ok('每条都有 level', all.every(function (n) { return !!n.level }))
ok('每条都有 disciplines', all.every(function (n) { return (n.disciplines || []).length > 0 }))
ok('id 不重复', new Set(all.map(function (n) { return String(n.id) })).size === all.length)

const D = require(path.join(ROOT, 'utils/date.js'))
// 无固定截止日的（青年编委这类常年招募）也算「在申报」，与首页口径保持一致
const live = all.filter(function (n) { const d = D.daysLeft(n.deadline); return d === null || d >= 0 })
const past = all.filter(function (n) { const d = D.daysLeft(n.deadline); return d !== null && d < 0 })
ok('未截止 > 50', live.length > 50, '未截止 ' + live.length + ' / 已截止 ' + past.length)
ok('7 天内截止 >= 1', live.filter(function (n) {
  const d = D.daysLeft(n.deadline)
  return d !== null && d <= 7
}).length >= 1,
  '共 ' + live.filter(function (n) {
    const d = D.daysLeft(n.deadline)
    return d !== null && d <= 7
  }).length + ' 条')

// ---------- 2. 页面逻辑 ----------
console.log('\n[2] 首页分段与筛选')
global.wx = {
  getStorageSync: function () { return null },
  setStorageSync: function () {},
  showToast: function () {},
  showModal: function () {},
  stopPullDownRefresh: function () {},
  navigateTo: function () {},
  switchTab: function () {},
  setNavigationBarTitle: function () {},
  setClipboardData: function () {},
  requestSubscribeMessage: function () {}
}
let pageDef = null
global.Page = function (o) { pageDef = o }
const apiStub = require.cache[path.join(ROOT, 'utils/api.js')]
require(path.join(ROOT, 'pages/index/index.js'))
ok('index.js 注册成功', !!pageDef)

function makeCtx () {
  const ctx = Object.assign({}, pageDef)
  ctx.data = JSON.parse(JSON.stringify(pageDef.data))
  ctx.setData = function (patch, cb) {
    Object.assign(this.data, patch)
    if (cb) cb.call(this)
  }
  return ctx
}

const ctx = makeCtx()
const mapped = lib.getAll().map(function (n) {
  return Object.assign({}, n, { id: String(n.id), deadlineEstimated: !!n.deadlineEstimated })
})
ctx.build(mapped, 'local')
ok('sections 生成', ctx.data.sections.length > 0, '段数 ' + ctx.data.sections.length)
ok('stats.total 与未截止数一致', ctx.data.stats.total === live.length,
  ctx.data.stats.total + ' vs ' + live.length)
ok('已截止进 past 而非消失', ctx.data.past.length === past.length, 'past ' + ctx.data.past.length)
ok('有最近截止红条', !!ctx.data.alert)
ok('卡片字段完整', ctx.data.sections[0].list.every(function (i) {
  return i.id && i.title && i.typeName && i.govName !== undefined && i.cdLevel && i.deadlineShort
}))
ok('卡片带学科标签', ctx.data.sections.every(function (s) {
  return s.list.every(function (i) { return Array.isArray(i.dis) })
}))

// 有学科偏好时：国家级不能被地区筛选吃掉
wx.getStorageSync = function (k) {
  if (k === 'pc_prefs') return { disciplines: ['城乡规划'], provinces: ['陕西省'], remindDays: [7, 3, 1] }
  return null
}
const ctx2 = makeCtx()
ctx2.build(mapped, 'local')
const hasNational = ctx2.data.sections.some(function (s) {
  return s.list.some(function (i) { return i.region === '国家' })
})
ok('只勾本省时国家级仍可见', hasNational)
ok('被筛掉的条数有提示', ctx2.data.hidden > 0, ctx2.data.hiddenTip)

// 按学科分组
const ctx3 = makeCtx()
ctx3.build(mapped, 'local')
ctx3.setData({ groupBy: 'dis' }, function () { ctx3.applyFilter() })
ok('按学科分组可切换', ctx3.data.sections.length > 0 &&
  ctx3.data.sections.every(function (s) { return s.key.indexOf('d_') === 0 }),
  '组数 ' + ctx3.data.sections.length)

// ---------- 3. 详情页 ----------
console.log('\n[3] 详情页')
let detailDef = null
global.Page = function (o) { detailDef = o }
require(path.join(ROOT, 'pages/detail/detail.js'))
const dctx = Object.assign({}, detailDef)
dctx.data = JSON.parse(JSON.stringify(detailDef.data))
dctx.setData = function (patch, cb) { Object.assign(this.data, patch); if (cb) cb.call(this) }

let rendered = 0
let noKey = 0
all.forEach(function (n) {
  try {
    dctx.render(Object.assign({}, n, { id: String(n.id) }))
    if (dctx.data.notice) rendered++
    if (!dctx.data.keyInfo || !dctx.data.keyInfo.head) noKey++
  } catch (e) {
    console.log('    渲染异常 ' + n.id + ': ' + e.message)
  }
})
ok('全部条目可渲染详情', rendered === all.length, rendered + '/' + all.length)
ok('每条都有统一的关键信息卡', noKey === 0, noKey + ' 条缺失')
ok('同类推荐可用', dctx.data.related.length > 0, '当前条推荐 ' + dctx.data.related.length + ' 条')
ok('推算日期有提示', dctx.data.dateWarn.length > 0 || !dctx.data.notice.deadlineEstimated)

// ---------- 4. wxml 结构 ----------
console.log('\n[4] wxml 标签平衡')
const files = ['pages/index/index.wxml', 'pages/detail/detail.wxml']
files.forEach(function (f) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8')
  const open = (src.match(/<(view|block|scroll-view|text)\b[^>]*?(?<!\/)>/g) || []).length
  const close = (src.match(/<\/(view|block|scroll-view|text)>/g) || []).length
  ok(f + ' 开闭标签一致', open === close, open + ' / ' + close)
  const badCall = /{{[^}]*\.(indexOf|filter|map|splice)\(/.test(src)
  ok(f + ' 无 wxml 方法调用', !badCall)
})

// ---------- 5. 语法 ----------
console.log('\n[5] 脚本语法')
const jsFiles = ['utils/notices.js', 'utils/notices_extra.js', 'utils/api.js',
  'pages/index/index.js', 'pages/detail/detail.js']
jsFiles.forEach(function (f) {
  try {
    new Function(fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/^const |^let /gm, 'var '))
    ok(f, true)
  } catch (e) {
    // const/let 在 Function 里合法，报错只可能是真语法问题
    ok(f, false, e.message)
  }
})

console.log(failed === 0 ? '\n全部通过 ✅' : '\n有 ' + failed + ' 项未通过 ❌')
process.exit(failed === 0 ? 0 : 1)
