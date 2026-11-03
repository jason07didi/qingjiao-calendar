// scripts/setup_github.js
// 一条命令做完：建仓库 → 推送代码 → 开启 Pages（源 = main 分支 /docs）→ 验证数据地址
//
// 用法：
//   GITHUB_TOKEN=ghp_xxx node scripts/setup_github.js
//   GITHUB_TOKEN=ghp_xxx node scripts/setup_github.js --repo qingjiao-calendar
//
// Token 需要的 scope：repo（勾选后含 repo:status / public_repo 等全部仓库权限）
// 说明：token 只在这个进程的内存里用，不写入 .git/config、不落任何文件。

const https = require('https')
const { execSync } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || ''
const REPO = (function () {
  const i = process.argv.indexOf('--repo')
  return i > -1 ? process.argv[i + 1] : 'qingjiao-calendar'
})()

function api (method, p, body) {
  return new Promise(function (resolve, reject) {
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'api.github.com',
      path: p,
      method: method,
      headers: Object.assign({
        'User-Agent': 'qingjiao-setup',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'token ' + TOKEN
      }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
    }, function (r) {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', function () {
        let j = null
        try { j = JSON.parse(d) } catch (e) {}
        resolve({ status: r.statusCode, body: j || d })
      })
    })
    req.on('error', reject)
    if (data) req.write(data)
    req.end()
  })
}

function getJson (url) {
  return new Promise(function (resolve) {
    https.get(url, { headers: { 'User-Agent': 'wx' }, timeout: 15000 }, function (r) {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', () => resolve({ status: r.statusCode, len: d.length }))
    }).on('error', () => resolve({ status: 0, len: 0 }))
  })
}

function git (args, withToken) {
  const url = 'https://x-access-token:' + TOKEN + '@github.com/' + USER + '/' + REPO + '.git'
  const cmd = args.map(a => (a === '__URL__' ? (withToken ? url : 'https://github.com/' + USER + '/' + REPO + '.git') : a))
  // 用 git -c 传凭据，避免写进 .git/config
  const c = withToken
    ? 'git -c credential.helper= ' + cmd.join(' ')
    : 'git ' + cmd.join(' ')
  return execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', maxBuffer: 20 * 1024 * 1024 })
}

let USER = ''

;(async function () {
  if (!TOKEN) {
    console.error('缺少 GITHUB_TOKEN。\n')
    console.error('生成方法：https://github.com/settings/tokens/new')
    console.error('  Note 随便填，Expiration 选 30 days，勾选 repo（workflow 建议一起勾）')
    console.error('然后：GITHUB_TOKEN=ghp_xxx node scripts/setup_github.js')
    process.exit(1)
  }

  // ------ 1. 我是谁 ------
  console.log('=== 1. 校验 token ===')
  const me = await api('GET', '/user')
  if (me.status !== 200) {
    console.error('  ❌ token 无效：HTTP ' + me.status + ' ' + (me.body && me.body.message ? me.body.message : ''))
    process.exit(1)
  }
  USER = me.body.login
  const scopes = me.body.plan ? '' : ''
  console.log('  ✅ 已认证：' + USER)

  // ------ 2. 建仓库 ------
  console.log('\n=== 2. 创建仓库 ' + USER + '/' + REPO + ' ===')
  let r = await api('POST', '/user/repos', {
    name: REPO,
    description: '青椒的日历 —— 高校青年教师科研申报截止日提醒小程序（含每日自动抓取与 Pages 数据发布）',
    private: false,
    has_issues: true,
    has_wiki: false,
    auto_init: false
  })
  if (r.status === 201) {
    console.log('  ✅ 已创建：' + r.body.html_url)
  } else if (r.status === 422) {
    console.log('  ℹ️  仓库已存在，直接复用')
  } else {
    console.error('  ❌ 创建失败：HTTP ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 300))
    process.exit(1)
  }

  // ------ 3. 推送 ------
  console.log('\n=== 3. 推送代码 ===')
  try {
    try { execSync('git remote remove origin', { cwd: ROOT, stdio: 'pipe' }) } catch (e) {}
    execSync('git remote add origin https://github.com/' + USER + '/' + REPO + '.git', { cwd: ROOT, stdio: 'pipe' })
    const out = git(['push', '-u', '__URL__', 'HEAD:main', '--force'], true)
    console.log('  ✅ 推送完成：' + out.split('\n').filter(l => /main|->/.test(l)).slice(-2).join(' '))
  } catch (e) {
    const msg = ((e.stdout || '') + (e.stderr || '')).trim()
    console.error('  ❌ 推送失败：')
    console.error('     ' + msg.split('\n').slice(-4).join('\n     '))
    if (/workflow/i.test(msg)) {
      console.error('     → token 缺 workflow 权限：重新生成 token，把 workflow 也勾上')
    }
    process.exit(1)
  }

  // ------ 4. 开 Pages ------
  console.log('\n=== 4. 开启 Pages（源 = main 分支 /docs 目录）===')
  r = await api('POST', '/repos/' + USER + '/' + REPO + '/pages', {
    source: { branch: 'main', path: '/docs' }
  })
  if (r.status === 201 || r.status === 204) {
    console.log('  ✅ Pages 已开启')
  } else if (r.status === 409) {
    console.log('  ℹ️  Pages 本来就开着，改为更新源')
    r = await api('PUT', '/repos/' + USER + '/' + REPO + '/pages', { source: { branch: 'main', path: '/docs' } })
    console.log('  ' + (r.status === 204 ? '✅ 已更新' : '⚠️  HTTP ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 200)))
  } else {
    console.log('  ⚠️  HTTP ' + r.status + ' ' + JSON.stringify(r.body).slice(0, 300))
    console.log('     （Pages 可能需要手动开：仓库 Settings → Pages → Source 选 main / docs）')
  }

  // ------ 5. 验证 ------
  const URL_DATA = 'https://' + USER.toLowerCase() + '.github.io/' + REPO + '/data/notices.json'
  console.log('\n=== 5. 等待 Pages 发布并验证 ===')
  console.log('  数据地址：' + URL_DATA)
  let ok = false
  for (let i = 1; i <= 30; i++) {
    const v = await getJson(URL_DATA)
    const tag = v.status === 200 ? '✅' : '…'
    console.log('  第 ' + String(i).padStart(2) + ' 次：HTTP ' + v.status + '（' + v.len + ' 字节）' + (v.status === 200 ? '  ' + tag : ''))
    if (v.status === 200 && v.len > 1000) { ok = true; break }
    await new Promise(r2 => setTimeout(r2, 10000))
  }

  console.log('\n================ 结果 ================')
  if (ok) {
    console.log('✅ 全部完成，数据已经可以从 GitHub Pages 读到了。')
    console.log('\n接下来只差一步：把这行填进小程序后台')
    console.log('  公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名')
    console.log('  填：' + USER.toLowerCase() + '.github.io   （只填域名，不要 https:// 和路径）')
    console.log('\n数据地址：' + URL_DATA)
  } else {
    console.log('⚠️  代码已推送，但 Pages 还没发布出来（首次发布通常 1-3 分钟）。')
    console.log('   稍等一下再打开：' + URL_DATA)
    console.log('   如果一直 404：仓库 Settings → Pages，确认 Source 是 main / docs')
  }
})()
