#!/usr/bin/env node
/**
 * upload_ci.js —— 用 miniprogram-ci 自动上传体验版
 *
 * 读取环境变量 MP_UPLOAD_KEY（小程序代码上传密钥的全文），
 * 写成临时文件后调用 ci.upload。没有密钥则安静跳过，不算失败。
 *
 * 本地手动上传：
 *   set MP_UPLOAD_KEY=...   （或 PowerShell: $env:MP_UPLOAD_KEY="..."）
 *   node scripts/upload_ci.js
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const ROOT = path.resolve(__dirname, '..')
const APPID = 'wxb0b73a71fced2201'

function main () {
  const rawKey = process.env.MP_UPLOAD_KEY || ''
  if (!rawKey.trim()) {
    console.log('[upload] 未提供 MP_UPLOAD_KEY，跳过上传（只更新了数据文件）')
    process.exit(0)
  }

  // 密钥写临时文件，避免放进仓库
  const keyPath = path.join(os.tmpdir(), 'mp_upload_private.key')
  fs.writeFileSync(keyPath, rawKey.replace(/\\n/g, '\n').trim() + '\n', { mode: 0o600 })
  console.log('[upload] 密钥已写入临时文件:', keyPath)

  let ci
  try {
    ci = require('miniprogram-ci')
  } catch (e) {
    console.error('[upload] 缺少 miniprogram-ci，请先运行 npm install miniprogram-ci')
    process.exit(1)
  }

  // 版本号：优先用 CI 的构建序号，本地跑退化为日期时分
  const now = new Date()
  const pad = function (n) { return String(n).padStart(2, '0') }
  const dateTag = now.getFullYear() + pad(now.getMonth() + 1) + pad(now.getDate())
  const runNo = process.env.GITHUB_RUN_NUMBER || (pad(now.getHours()) + pad(now.getMinutes()))
  const version = '1.0.' + String(runNo).replace(/\D/g, '').slice(-6)

  let count = 0
  try {
    const pack = require(path.join(ROOT, 'utils', 'data_crawl.js'))
    count = (pack.ITEMS || []).length
  } catch (e) {}

  const project = new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: ROOT,
    privateKeyPath: keyPath,
    ignores: ['node_modules/**/*', 'tools/**/*', 'docs/**/*', 'data/**/*', 'scripts/**/*', '.github/**/*']
  })

  console.log('[upload] 开始上传 版本 ' + version + '，数据 ' + count + ' 条')

  ci.upload({
    project: project,
    version: version,
    desc: dateTag + ' 自动更新 · 待核实通知 ' + count + ' 条',
    setting: { es6: true, minify: true, autoPrefixWXSS: true },
    onProgressUpdate: function (t) {
      if (t && t._msg) console.log('[upload]', t._msg)
    }
  }).then(function (res) {
    console.log('[upload] 上传成功:', JSON.stringify(res && res.subPackageInfo ? 'ok' : res).slice(0, 200))
    console.log('[upload] 下一步：登录微信公众平台 → 版本管理 → 提交审核')
    try { fs.unlinkSync(keyPath) } catch (e) {}
  }).catch(function (err) {
    console.error('[upload] 上传失败:', err && (err.message || err))
    try { fs.unlinkSync(keyPath) } catch (e) {}
    process.exit(1)
  })
}

main()
