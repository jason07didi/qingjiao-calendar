// tools/verify_all.js — 全量自检：类目 / 学科 / 关键信息卡 / 官方来源三级
const fs = require('fs')
const path = require('path')
const ROOT = path.join(__dirname, '..')
const out = []
const log = function (s) { out.push(s) }

global.wx = {
  getStorageSync: function () { return null },
  setStorageSync: function () {},
  showToast: function () {},
  stopPullDownRefresh: function () {},
  navigateTo: function () {},
  redirectTo: function () {},
  switchTab: function () {},
  setNavigationBarTitle: function () {},
  addPhoneCalendar: function () {}
}

const lib = require(path.join(ROOT, 'utils/notices.js'))
const off = require(path.join(ROOT, 'utils/official.js'))
const D = require(path.join(ROOT, 'utils/date.js'))
const all = lib.getAll()

let fail = 0
function ok (name, cond, extra) {
  if (!cond) fail++
  log((cond ? '  OK  ' : '  ✗✗  ') + name + (extra ? '   [' + extra + ']' : ''))
}

log('总条数 ' + all.length)

// 1. 类目
log('\n[1] 类目覆盖')
const byType = {}
all.forEach(function (n) { byType[n.type] = (byType[n.type] || 0) + 1 })
lib.TYPES.forEach(function (t) {
  ok('类目「' + t.name + '」有内容', (byType[t.key] || 0) > 0, (byType[t.key] || 0) + ' 条')
})

// 2. 学科
log('\n[2] 学科覆盖（' + lib.DISCIPLINES.length + ' 个）')
lib.DISCIPLINES.forEach(function (d) {
  const c = all.filter(function (n) { return (n.disciplines || []).indexOf(d) > -1 }).length
  ok(d, c > 0, c + ' 条')
})

// 3. 官方来源三级
log('\n[3] 官方来源')
const lv = { notice: 0, section: 0, home: 0, '': 0 }
all.forEach(function (n) {
  const s = off.siteOf(n)
  lv[s.level || ''] = (lv[s.level || ''] || 0) + 1
})
log('  原文级 ' + lv.notice + ' / 栏目级 ' + lv.section + ' / 首页级 ' + lv.home + ' / 未收录 ' + lv[''])
ok('每条都有机构名', all.every(function (n) { return !!off.siteOf(n).name }))
ok('原文+栏目 占比 > 25%', (lv.notice + lv.section) / all.length > 0.25,
  Math.round((lv.notice + lv.section) / all.length * 100) + '%')
ok('栏目级都是实测过的深链接', all.every(function (n) {
  const s = off.siteOf(n)
  return s.level !== 'section' || !off.isRoot(s.url)
}))
ok('无原文时给出检索式', all.every(function (n) {
  const s = off.siteOf(n)
  return s.level === 'notice' || !!s.searchUrl
}))

// 4. 关键信息卡
log('\n[4] 关键信息卡（全类目统一）')
let detailDef = null
global.Page = function (o) { detailDef = o }
require(path.join(ROOT, 'pages/detail/detail.js'))
const ctx = Object.assign({}, detailDef)
ctx.data = JSON.parse(JSON.stringify(detailDef.data))
ctx.setData = function (patch, cb) { Object.assign(this.data, patch); if (cb) cb.call(this) }

let noHead = 0
let noRows = 0
let renderErr = 0
all.forEach(function (n) {
  try {
    ctx.render(Object.assign({}, n, { id: String(n.id) }))
    if (!ctx.data.keyInfo || !ctx.data.keyInfo.head) { noHead++; log('    缺 head: ' + n.id + ' ' + n.type) }
    else if (!ctx.data.keyInfo.rows.length) { noRows++; log('    无要点行: ' + n.id + ' ' + n.type) }
  } catch (e) {
    renderErr++
    log('    渲染异常 ' + n.id + ': ' + e.message)
  }
})
ok('全部条目可渲染', renderErr === 0, renderErr + ' 条异常')
ok('全部有关键信息卡', noHead === 0, noHead + ' 条缺失')
ok('全部有要点行', noRows === 0, noRows + ' 条为空')

// 抽样看三种类型
;['q01', 'p01', '1', '19', 'q06'].forEach(function (id) {
  const n = lib.getById(id)
  if (!n) { log('  未找到 ' + id); return }
  ctx.render(Object.assign({}, n, { id: String(n.id) }))
  const k = ctx.data.keyInfo
  log('  · ' + (n.title || '').slice(0, 24))
  log('      ' + k.headLabel + '：' + k.head + (k.sub ? '   （' + k.sub + '）' : ''))
  k.rows.slice(0, 3).forEach(function (r) { log('        ' + r.label + ' · ' + String(r.value).slice(0, 40)) })
})

// 5. 紧急条目
log('\n[5] 7 天内截止')
const urgent = all.map(function (n) {
  return { n: n, d: D.daysLeft(n.deadline) }
}).filter(function (x) { return x.d !== null && x.d >= 0 && x.d <= 7 })
  .sort(function (a, b) { return a.d - b.d })
urgent.forEach(function (x) {
  log('  ' + x.d + ' 天  ' + x.n.title.slice(0, 34) + '   ' + (x.n.org || '').slice(0, 14))
})
ok('存在 7 天内截止的信息', urgent.length > 0, urgent.length + ' 条')

// 6. 已截止
const pastN = all.filter(function (n) {
  const d = D.daysLeft(n.deadline)
  return d !== null && d < 0
}).length
log('\n[6] 已截止 ' + pastN + ' 条（首页折叠展示，不删除）')

log('\n' + (fail === 0 ? '===== 全部通过 =====' : '===== ' + fail + ' 项未通过 ====='))
fs.writeFileSync(path.join(__dirname, 'verify_out.txt'), out.join('\n'), 'utf8')
console.log(out.join('\n'))
