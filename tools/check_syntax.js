// 语法体检：对项目内所有 .js 跑 node --check，结果写 tools/_syntax.txt
const cp = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const SKIP = ['node_modules', '.git', 'miniprogram_npm']

function walk (dir, out) {
  fs.readdirSync(dir, { withFileTypes: true }).forEach(function (e) {
    if (SKIP.indexOf(e.name) > -1) return
    const p = path.join(dir, e.name)
    if (e.isDirectory()) return walk(p, out)
    if (/\.js$/.test(e.name) && e.name !== 'check_syntax.js') out.push(p)
  })
  return out
}

const files = walk(ROOT, [])
const bad = []
files.forEach(function (f) {
  const r = cp.spawnSync(process.execPath, ['--check', f], { encoding: 'utf8' })
  if (r.status !== 0) bad.push(path.relative(ROOT, f) + ' :: ' + (r.stderr || '').split('\n')[1])
})

let text = '检查 ' + files.length + ' 个 JS 文件\n'
text += bad.length ? '有问题：\n' + bad.join('\n') : '全部通过'
fs.writeFileSync(path.join(__dirname, '_syntax.txt'), text, 'utf8')
console.log(text)
process.exitCode = bad.length ? 1 : 0
