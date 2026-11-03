// 会员码自测：node tools/verify_vip.js
// 覆盖固定码 62547、算法码、错误码、展示打码、ads 联动（是否还出广告）

const store = {}
global.wx = {
  getStorageSync: function (k) { return store[k] },
  setStorageSync: function (k, v) { store[k] = v },
  removeStorageSync: function (k) { delete store[k] }
}

const vip = require('../utils/vip.js')
const ads = require('../utils/ads.js')

let pass = 0
let fail = 0

function ok (name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name) } else { fail++; console.log('  ✗ ' + name + (extra ? '  → ' + extra : '')) }
}

console.log('\n[1] 固定码 62547')
ok('原样通过', vip.verify('62547') === true)
ok('带空格通过', vip.verify(' 62547 ') === true)
ok('带连字符通过', vip.verify('625-47') === true)
ok('错误码不通过', vip.verify('62457') === false)
ok('少一位不通过', vip.verify('6254') === false)
ok('多一位不通过', vip.verify('625477') === false)
ok('空值不通过', vip.verify('') === false)

console.log('\n[2] 算法码仍可用（以后要发码时）')
const c1 = vip.makeCode('ABCD1234')
ok('生成码可自校验 ' + c1, vip.verify(c1) === true)
ok('改一位即失效', vip.verify(c1.slice(0, 11) + (c1.slice(11) === 'A' ? 'B' : 'A')) === false)

console.log('\n[3] 激活与状态')
store.qt_vip_v1 = null
ok('未激活时 isVip=false', vip.isVip() === false)
let r = vip.activate('62547')
ok('激活成功', r.ok === true, r.msg)
ok('激活后 isVip=true', vip.isVip() === true)
const st = vip.status()
ok('状态展示已打码（不含明文 62547）', st.code.indexOf('62547') === -1 && st.code.length > 0, st.code)
ok('开通日期有值', /^\d{4}-\d{2}-\d{2}$/.test(st.since), st.since)

console.log('\n[4] 免广告联动')
ok('详情页 banner 不再返回广告位', ads.bannerId() === '')
ok('返回列表不再插屏', ads.canShow() === false)
ok('showOnBack 返回 false', ads.showOnBack() === false)

console.log('\n[5] 退出会员')
vip.clear()
ok('退出后 isVip=false', vip.isVip() === false)
ok('横幅恢复（未配 adunit 时仍为空串）', ads.bannerId() === '')

console.log('\n结果：' + pass + ' 通过，' + fail + ' 失败\n')
process.exit(fail ? 1 : 0)
