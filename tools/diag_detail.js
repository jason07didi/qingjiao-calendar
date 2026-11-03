// tools/diag_detail.js —— 走真实 api 链路，检查每个 id 能否取到详情
const path = require('path')
const ROOT = path.join(__dirname, '..')

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

const api = require(path.join(ROOT, 'utils/api.js'))
const lib = require(path.join(ROOT, 'utils/notices.js'))

;(async function () {
  const r = await api.getList({ force: true })
  console.log('getList from=' + r.from + ' count=' + r.list.length)
  const ids = r.list.map(function (n) { return n.id })
  console.log('前 8 个 id:', ids.slice(0, 8).join(', '))

  let fail = 0
  for (let i = 0; i < ids.length; i++) {
    const one = await api.getById(ids[i])
    if (!one) {
      fail++
      console.log('  取不到: ' + ids[i])
    }
  }
  console.log('详情可达 ' + (ids.length - fail) + '/' + ids.length)

  // 检查字段是否被 mapLocal 丢掉
  const sample = await api.getById(ids[0])
  console.log('\n样本字段:', Object.keys(sample).join(','))
  console.log('level=' + sample.level + ' source=' + sample.source +
    ' estimated=' + sample.deadlineEstimated + ' freq=' + (sample.freq || '空'))

  // id 形态分布
  const shapes = {}
  ids.forEach(function (id) {
    const k = /^r\d+$/.test(id) ? 'r数字' : (/^n\d+$/.test(id) ? 'n数字' : (/^\d+$/.test(id) ? '纯数字' : '其他:' + id))
    shapes[k] = (shapes[k] || 0) + 1
  })
  console.log('\nid 形态分布:', JSON.stringify(shapes))
})()
