// 生成会员码。用法：
//   node tools/gen_vip_code.js        → 5 个
//   node tools/gen_vip_code.js 20     → 20 个
const path = require('path')
const vip = require(path.join(__dirname, '..', 'utils', 'vip.js'))

const n = Math.min(parseInt(process.argv[2], 10) || 5, 200)
const codes = []

for (let i = 0; i < n; i++) {
  const c = vip.makeCode()
  if (!vip.verify(c)) {
    console.error('生成失败，校验不通过：' + c)
    process.exit(1)
  }
  codes.push(c)
}

console.log('')
console.log('生成 ' + n + ' 个会员码。每个给一个人，别公开发（发到群里等于免费送）。')
console.log('')
codes.forEach(function (c, i) {
  console.log('  ' + String(i + 1).padStart(2, '0') + '.  ' + vip.pretty(c) + '      紧凑写法：' + c)
})
console.log('')
console.log('对方在「我的 → 会员」里输入，连字符可有可无，大小写不敏感。')
console.log('会员权益：全站不显示广告，信息与功能完全不变。')
console.log('')
