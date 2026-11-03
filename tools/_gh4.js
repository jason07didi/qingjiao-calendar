// 临时脚本：独立启动带调试端口的 Chrome（脱离父进程），再连接检查 GitHub 登录态
const { spawn } = require('child_process')
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const http = require('http')

const CHROME = process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
const PROFILE = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto'
const PORT = 9222

function waitPort (ms) {
  const end = Date.now() + ms
  return new Promise(function (resolve) {
    (function tick () {
      http.get('http://127.0.0.1:' + PORT + '/json/version', function (r) {
        resolve(true)
      }).on('error', function () {
        if (Date.now() > end) return resolve(false)
        setTimeout(tick, 400)
      })
    })()
  })
}

;(async () => {
  // 1) 启动（headless 关闭，方便你看到窗口）
  const child = spawn(CHROME, [
    '--user-data-dir=' + PROFILE,
    '--remote-debugging-port=' + PORT,
    '--no-first-run',
    '--no-default-browser-check',
    '--window-size=1280,900',
    'https://github.com/'
  ], { detached: true, stdio: 'ignore' })
  child.unref()

  const ok = await waitPort(20000)
  if (!ok) {
    console.log('调试端口未打开')
    process.exit(1)
  }

  // 2) 连接
  const browser = await puppeteer.connect({
    browserURL: 'http://127.0.0.1:' + PORT,
    defaultViewport: null
  })
  const pages = await browser.pages()
  let page = null
  for (const p of pages) {
    if (/github\.com/.test(p.url())) { page = p; break }
  }
  if (!page) {
    page = pages[0] || await browser.newPage()
    await page.goto('https://github.com/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  }
  await new Promise(r => setTimeout(r, 3000))

  const info = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="user-login"]')
    return {
      title: document.title,
      href: location.href,
      userLogin: meta ? meta.getAttribute('content') : null,
      hasSignin: !!document.querySelector('a[href="/login"]')
    }
  })
  const cookies = await browser.cookies()
  const gh = cookies.filter(c => /(^|\.)github\.com$/.test(c.domain)).map(c => c.name)

  console.log('URL        :', info.href)
  console.log('标题       :', info.title)
  console.log('user-login :', info.userLogin)
  console.log('有登录链接 :', info.hasSignin)
  console.log('cookie 名  :', gh.join(', ') || '(无)')

  fs.writeFileSync(PROFILE + '/_login.json', JSON.stringify({ info, cookies: gh }, null, 1))
  browser.disconnect()
})()
