// 一次性：生成 PAT → 推送本地仓库 → 开启 GitHub Pages → 验证可访问
const puppeteer = require('puppeteer-core')
const { execSync } = require('child_process')
const fs = require('fs')
const https = require('https')

const PORT = 9222
const SHOTS = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto/shots'
const ROOT = 'F:/微信开发平台/jason-v1.1'
const GIT = '"C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe"'
const OWNER = 'jason07didi'
const REPO = 'qingjiao-calendar'

function sleep (ms) { return new Promise(r => setTimeout(r, ms)) }

function api (token, method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null
    const req = https.request({
      hostname: 'api.github.com',
      path: path,
      method: method,
      headers: Object.assign({
        'User-Agent': 'qingjiao-bot',
        'Accept': 'application/vnd.github+json',
        'Authorization': 'Bearer ' + token
      }, data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {})
    }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => resolve({ status: res.statusCode, body: d }))
    })
    req.on('error', e => resolve({ status: 0, body: 'ERR ' + e.message }))
    if (data) req.write(data)
    req.end()
  })
}

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 940 })

  // ---------- 1. 生成 token ----------
  await page.goto('https://github.com/settings/tokens/new?scopes=repo,workflow&description=qingjiao-calendar-ci', {
    waitUntil: 'domcontentloaded', timeout: 60000
  })
  await page.waitForSelector('#oauth_access_description', { timeout: 20000 })
  await sleep(2500)

  const scopeState = await page.evaluate(() => {
    const out = []
    document.querySelectorAll('input[name="oauth_access[scopes][]"]').forEach(cb => {
      if (!cb.checked) return
      let label = ''
      const wrap = cb.closest('li,div')
      if (wrap) label = (wrap.innerText || '').split('\n')[0].trim()
      out.push(label || cb.parentElement ? (cb.parentElement.innerText || '').split('\n')[0].trim() : '?')
    })
    return out
  })
  console.log('已勾选的 scope:', scopeState.join(' | ') || '(空)')

  const needRepo = scopeState.some(s => /^repo\b/i.test(s))
  const needWf = scopeState.some(s => /^workflow\b/i.test(s))
  console.log('repo:', needRepo, '| workflow:', needWf)
  if (!needRepo || !needWf) {
    console.log('scope 预勾选不完整，改为手动勾选')
    await page.evaluate(() => {
      document.querySelectorAll('input[name="oauth_access[scopes][]"]').forEach(cb => {
        const wrap = cb.closest('li,div')
        const t = wrap ? (wrap.innerText || '').trim() : ''
        if (/^repo\b/i.test(t) || /^workflow\b/i.test(t)) {
          if (!cb.checked) cb.click()
        }
      })
    })
    await sleep(800)
  }

  await page.screenshot({ path: SHOTS + '/3-token-form.png' })

  const gen = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^Generate token$/i.test((x.textContent || '').trim()))
    if (b) { b.click(); return true }
    return false
  })
  if (!gen) { console.log('未找到 Generate token'); process.exit(1) }

  let token = ''
  for (let i = 0; i < 25; i++) {
    await sleep(900)
    const txt = await page.evaluate(() => document.body.innerText)
    const m = txt.match(/ghp_[A-Za-z0-9]{20,}/) || txt.match(/github_pat_[A-Za-z0-9_]{20,}/)
    if (m) { token = m[0]; break }
  }
  await page.screenshot({ path: SHOTS + '/4-token-created.png' })
  if (!token) {
    console.log('没有抓到 token 文本，页面 URL:', page.url())
    const t = await page.evaluate(() => document.body.innerText.slice(0, 600))
    console.log(t)
    process.exit(1)
  }
  console.log('token 已生成: ' + token.slice(0, 7) + '...' + token.slice(-4) + ' (长度 ' + token.length + ')')

  // ---------- 2. 推送 ----------
  function git (c) {
    try {
      const o = execSync(c, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe', maxBuffer: 40 * 1024 * 1024 })
      return { ok: true, out: (o || '').trim() }
    } catch (e) { return { ok: false, out: ((e.stdout || '') + (e.stderr || '')).trim() } }
  }
  const remoteUrl = 'https://x-access-token:' + token + '@github.com/' + OWNER + '/' + REPO + '.git'
  console.log('\n--- 推送 ---')
  let r = git(GIT + ' push ' + remoteUrl + ' main:main 2>&1')
  console.log(r.ok ? 'push 成功' : 'push 失败:\n' + r.out.slice(0, 900))

  if (r.ok) {
    git(GIT + ' remote remove origin')
    const add = git(GIT + ' remote add origin https://github.com/' + OWNER + '/' + REPO + '.git')
    console.log('已设置 origin（不含 token）:', add.ok)
    const head = git(GIT + ' log --oneline -1')
    console.log('远端分支 head:', head.out)
  }

  // ---------- 3. 开启 Pages ----------
  console.log('\n--- 开启 Pages ---')
  let p = await api(token, 'GET', '/repos/' + OWNER + '/' + REPO + '/pages')
  console.log('当前 Pages 状态:', p.status, p.body.slice(0, 160))
  if (p.status === 404) {
    const c = await api(token, 'POST', '/repos/' + OWNER + '/' + REPO + '/pages', {
      source: { branch: 'main', path: '/docs' }
    })
    console.log('创建 Pages:', c.status, c.body.slice(0, 300))
  } else if (p.status === 200) {
    const u = await api(token, 'PUT', '/repos/' + OWNER + '/' + REPO + '/pages', {
      source: { branch: 'main', path: '/docs' }
    })
    console.log('更新 Pages 源:', u.status, u.body.slice(0, 200))
  }

  // ---------- 4. 等构建并验证 ----------
  console.log('\n--- 等待构建 ---')
  for (let i = 0; i < 20; i++) {
    await sleep(6000)
    const b = await api(token, 'GET', '/repos/' + OWNER + '/' + REPO + '/pages/builds/latest')
    let st = ''
    try { st = JSON.parse(b.body).status } catch (e) {}
    console.log('  build status:', st || b.status)
    if (st === 'built') break
  }

  const url = 'https://' + OWNER + '.github.io/' + REPO + '/data/notices.json'
  for (let i = 0; i < 15; i++) {
    const res = await new Promise(resolve => {
      https.get(url, { headers: { 'User-Agent': 'node' }, timeout: 20000 }, rr => {
        let d = ''
        rr.on('data', c => d += c)
        rr.on('end', () => resolve({ s: rr.statusCode, len: d.length, head: d.slice(0, 120) }))
      }).on('error', e => resolve({ s: 'ERR', len: 0, head: e.message }))
    })
    console.log('  验证', url, '→', res.s, res.len + ' bytes')
    if (res.s === 200 && res.len > 1000) {
      console.log('  ✅ 数据可访问，开头:', res.head.replace(/\s+/g, ' ').slice(0, 100))
      break
    }
    await sleep(8000)
  }

  fs.writeFileSync(SHOTS + '/5-done.json', JSON.stringify({
    repo: 'https://github.com/' + OWNER + '/' + REPO,
    pages: 'https://' + OWNER + '.github.io/' + REPO + '/data/notices.json',
    tokenMasked: token.slice(0, 7) + '...' + token.slice(-4),
    tokenLength: token.length
  }, null, 1))

  // token 只落临时目录，便于后续步骤复用；用完由用户撤销
  fs.writeFileSync('C:/Users/Administrator/AppData/Local/Temp/qt-auto/_token.txt', token)
  console.log('\n完成。token 已存临时文件（用完建议撤销）：https://github.com/settings/tokens')

  await page.close()
  browser.disconnect()
})()
