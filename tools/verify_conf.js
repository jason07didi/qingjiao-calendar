// tools/verify_conf.js
// 会议维度自测：地点必须是具体城市、六项关键信息齐全、每条详情都有官方来源
const path = require('path')
const ROOT = path.resolve(__dirname, '..')

global.wx = {
  getStorageSync: function () { return null },
  setStorageSync: function () {},
  showToast: function () {},
  showModal: function () {},
  stopPullDownRefresh: function () {},
  navigateTo: function () {},
  redirectTo: function () {},
  switchTab: function () {},
  setNavigationBarTitle: function () {},
  setClipboardData: function () {}
}

let ok = 0
let bad = 0
function check (cond, msg, extra) {
  if (cond) { ok++; console.log('  ✓ ' + msg) } else {
    bad++; console.log('  ✗ ' + msg + (extra ? '  → ' + extra : ''))
  }
}

const api = require(path.join(ROOT, 'utils/api.js'))
const lib = require(path.join(ROOT, 'utils/notices.js'))
const confInfo = require(path.join(ROOT, 'utils/conf_info.js'))
const officialLib = require(path.join(ROOT, 'utils/official.js'))

async function main () {
  const all = lib.getAll()
  const confs = all.filter(function (n) { return n.type === 'conference' })

  console.log('\n[1] 会议条目')
  check(confs.length >= 10, '共 ' + confs.length + ' 条')

  console.log('\n[2] 地点必须是具体城市，不能是「轮值城市」')
  confs.forEach(function (n) {
    const c = n.conf
    const line = c.venueLine || ''
    const badWord = /轮值城市/.test(line)
    check(!badWord, n.title.slice(0, 20) + ' 地点=' + line, badWord ? '仍是轮值城市' : '')
  })

  console.log('\n[3] 关键六项齐全')
  confs.forEach(function (n) {
    const c = n.conf
    const miss = []
    if (!c.roles || !c.roles.length) miss.push('主办')
    if (!c.venueCity) miss.push('地点')
    if (!c.fee) miss.push('注册费')
    if (!c.topics || !c.topics.length) miss.push('主题')
    if (!c.sessions || !c.sessions.length) miss.push('分论坛')
    if (!c.official) miss.push('官网')
    check(miss.length === 0, n.title.slice(0, 20), miss.join(','))
  })

  console.log('\n[4] 已确认的场次必须写真实城市')
  const plan = confs.find(function (n) { return /中国城市规划年会/.test(n.title) })
  check(!!plan && plan.conf.venueCity === '广州', '规划年会 2026 → 广州', plan && plan.conf.venueCity)
  check(!!plan && plan.conf.venueStatus === 'confirmed', '规划年会地点状态=已确认')
  check(!!plan && plan.deadline === '2026-11-20', '规划年会截止=2026-11-20 注册截止', plan && plan.deadline)

  console.log('\n[5] 未公布的必须写「待公布 + 上届在哪」')
  const pending = confs.filter(function (n) { return n.conf.venueStatus !== 'confirmed' })
  pending.forEach(function (n) {
    check(/待公布/.test(n.conf.venueLine), n.title.slice(0, 18) + ' → ' + n.conf.venueLine)
  })

  console.log('\n[6] 每条详情都能取到官方来源')
  let noName = 0
  for (let i = 0; i < all.length; i++) {
    const site = officialLib.siteOf(all[i])
    if (!site || !site.name) { noName++; console.log('    缺来源名：', all[i].title.slice(0, 24)) }
  }
  check(noName === 0, all.length + ' 条全部有官方来源机构名')
  const withSite = all.filter(function (n) {
    const s = officialLib.siteOf(n)
    return s.url || s.noticeUrl
  })
  console.log('    其中带可复制地址的 ' + withSite.length + ' / ' + all.length + ' 条')
  check(withSite.length >= 60, '可复制地址覆盖 ≥ 60 条', withSite.length)

  console.log('\n[7] 详情链路取数')
  for (let i = 0; i < confs.length; i++) {
    const n = confs[i]
    const got = await api.getById(String(n.id))
    check(!!got && !!got.conf && !!got.conf.venueLine, '详情可取 ' + n.id + ' → ' + (got && got.conf ? got.conf.venueLine : '空'))
  }

  console.log('\n[8] 兜底不空')
  const fake = confInfo.enrich({ type: 'conference', title: '某未知会议', org: '某学会', region: '陕西省', info: { amount: '800 元' } })
  check(!!fake && !!fake.venueCity && !!fake.roles.length, '未知会议有兜底地点与主办')
  check(fake.estimate === true, '兜底数据标 estimate')

  console.log('\n结果：' + ok + ' 项通过，' + bad + ' 项失败')
  process.exit(bad ? 1 : 0)
}

main().catch(function (e) {
  console.log('运行出错:', e.message)
  process.exit(1)
})
