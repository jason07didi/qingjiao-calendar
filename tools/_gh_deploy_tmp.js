/* v4：诊断 tokens/new 页面结构 + 自适应点击 + 推送 */
const fs = require('fs')
const path = require('path')
const cp = require('child_process')

const CHROME = 'C:/Users/Administrator/AppData/Local/Google/Chrome/Application/chrome.exe'
const USER_DATA = process.env.LOCALAPPDATA + '/Google/Chrome/User Data'
const TMP = 'C:/Users/Administrator/.workbuddy/tmp/ghprofile-v4'
const GIT = 'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/mingw64/bin/git.exe'
const REPO = 'jason07didi/qingjiao-calendar'
const PORT = 9225
const T0 = Date.now()

function log (m) { console.log(new Date().toISOString().slice(11, 19), '[' + Math.round((Date.now() - T0) / 1000) + 's]', m) }

setTimeout(() => { console.error('WATCHDOG 8min'); try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) {}; process.exit(2) }, 8 * 60 * 1000).unref()

async function main () {
  log('关闭 Chrome')
  try { cp.execSync('powershell -NoProfile -Command "Get-Process chrome -EA SilentlyContinue | %{ $_.CloseMainWindow() | Out-Null }"', { timeout: 20000 }) } catch (e) {}
  await new Promise(r => setTimeout(r, 4000))
  try { cp.execSync('taskkill /IM chrome.exe /F', { stdio: 'ignore' }) } catch (e) {}

  log('复制配置')
  fs.rmSync(TMP, { recursive: true, force: true })
  fs.mkdirSync(path.join(TMP, 'Default/Network'), { recursive: true })
  for (const f of ['Local State', 'Default/Network/Cookies', 'Default/Preferences', 'Default/Secure Preferences']) {
    fs.copyFileSync(path.join(USER_DATA, f), path.join(TMP, f))
  }

  const child = cp.spawn(CHROME, [
    '--user-data-dir=' + TMP, '--remote-debugging-port=' + PORT,
    '--headless=new', '--no-first-run', '--no-default-browser-check', 'about:blank'
  ], { stdio: 'ignore' })

  try {
    const puppeteer = require('puppeteer-core')
    let browser = null
    for (let i = 0; i < 25 && !browser; i++) {
      await new Promise(r => setTimeout(r, 1000))
      try { browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null }) } catch (e) {}
    }
    if (!browser) throw new Error('调试端口连不上')
    const page = (await browser.pages())[0] || await browser.newPage()
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36')
    await page.goto('https://github.com/settings/tokens/new?scopes=repo,workflow&description=qingjiao-deploy-v4', { waitUntil: 'networkidle2', timeout: 60000 })
    log('页面加载完成: ' + page.url())

    await new Promise(r => setTimeout(r, 5000))
    // 诊断：转储页面结构
    const diag = await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button')].map(b => (b.textContent || '').trim().slice(0, 40) + (b.id ? '#' + b.id : '') + (b.type ? '[' + b.type + ']' : ''))
      const forms = [...document.querySelectorAll('form')].map(f => (f.action || '') + ' method=' + (f.method || ''))
      return { title: document.title, text: (document.body ? document.body.innerText : '').slice(0, 1200), btns, forms }
    })
    log('title=' + diag.title)
    log('按钮: ' + JSON.stringify(diag.btns))
    log('表单: ' + JSON.stringify(diag.forms))
    log('页面文本前600: ' + diag.text.slice(0, 600).replace(/\n+/g, ' | '))

    // 自适应点击
    const clicked = await page.evaluate(() => {
      const cands = [...document.querySelectorAll('button')]
      let b = cands.find(x => x.textContent.trim() === 'Generate token')
      if (!b) b = cands.find(x => /generate token/i.test(x.textContent))
      if (!b) b = document.querySelector('#generateTokenBtn') || document.querySelector('button[type="submit"]')
      if (b) { b.click(); return b.textContent.trim().slice(0, 40) }
      return null
    })
    log('点击结果: ' + clicked)

    let token = null
    for (let i = 0; i < 40 && !token; i++) {
      await new Promise(r => setTimeout(r, 1500))
      for (const p of await browser.pages()) {
        try {
          const txt = await p.evaluate(() => document.body ? document.body.innerText : '')
          const m = txt && txt.match(/ghp_[A-Za-z0-9]{20,}/)
          if (m) { token = m[0]; break }
        } catch (e) {}
      }
    }
    if (!token) throw new Error('未捕获 token（见上方诊断）')
    log('已获取 token: ' + token.slice(0, 8) + '****')

    log('开始推送')
    const env = Object.assign({}, process.env, {
      GIT_EXEC_PATH: 'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/mingw64/bin',
      GIT_TERMINAL_PROMPT: '0'
    })
    const push = cp.spawnSync(GIT, [
      '-c', 'http.version=HTTP/1.1', '-c', 'credential.helper=',
      'push', 'https://x-access-token:' + token + '@github.com/' + REPO + '.git', 'main:main'
    ], { cwd: 'F:/微信开发平台/jason-v1.1', encoding: 'utf8', timeout: 300000, env })
    log('push exit=' + push.status)
    if (push.stderr) log('err: ' + push.stderr.slice(-300))
    if (push.status !== 0) throw new Error('push 失败')

    const local = cp.execSync('"' + GIT + '" rev-parse HEAD', { cwd: 'F:/微信开发平台/jason-v1.1', encoding: 'utf8' }).trim()
    log('本地 HEAD: ' + local)
  } finally {
    try { child.kill() } catch (e) {}
    await new Promise(r => setTimeout(r, 1500))
    try { fs.rmSync(TMP, { recursive: true, force: true }) } catch (e) {}
    try { cp.spawn(CHROME, ['--restore-last-session'], { detached: true, stdio: 'ignore' }).unref() } catch (e) {}
    log('收尾完成')
  }
}

main().then(() => { log('DONE'); process.exit(0) }).catch(e => { console.error('FAIL: ' + e.message); process.exit(1) })
