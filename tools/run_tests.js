// 一键跑所有自测，并把结果写进 tools/_test_out.txt（方便在没有控制台回显的环境里查看）
const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const NODE = process.execPath

const files = [
  'tools/verify_ads.js',
  'tools/verify_vip.js',
  'tools/verify_ux.js',
  'tools/verify_conf.js',
  'tools/verify_tap.js',
  'tools/verify_all.js'
]

let text = ''
let failed = 0
files.forEach(function (f) {
  const r = cp.spawnSync(NODE, [path.join(ROOT, f)], { encoding: 'utf8' })
  const out = (r.stdout || '') + (r.stderr || '')
  text += '\n===== ' + f + ' =====\n' + out
  const bad = /未通过|✗|Error/.test(out) || r.status !== 0
  if (bad) failed++
})

text += '\n===== 汇总 =====\n' + (failed === 0 ? '全部脚本通过' : failed + ' 个脚本有问题') + '\n'
fs.writeFileSync(path.join(__dirname, '_test_out.txt'), text, 'utf8')
console.log(text.slice(-1600))
process.exitCode = failed === 0 ? 0 : 1
