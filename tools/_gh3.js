// 临时脚本：用复制出来的 Chrome 配置启动带调试端口的实例，检查 GitHub 登录态
const puppeteer = require('puppeteer-core')
const fs = require('fs')

const CHROME = process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
const PROFILE = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto'

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    userDataDir: PROFILE,
    headless: false,
    defaultViewport: null,
    args: [
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-features=Translate',
      '--window-size=1280,900'
    ]
  })
  const pages = await browser.pages()
  const page = pages[0] || await browser.newPage()

  await page.goto('https://github.com/', { waitUntil: 'domcontentloaded', timeout: 45000 })
  await new Promise(r => setTimeout(r, 2500))

  const info = await page.evaluate(() => {
    const meta = document.querySelector('meta[name="user-login"]')
    const dashboard = document.querySelector('a[href="/dashboard"]')
    const signin = document.querySelector('a[href="/login"]')
    return {
      title: document.title,
      userLogin: meta ? meta.getAttribute('content') : null,
      hasDashboard: !!dashboard,
      hasSignin: !!signin
    }
  })

  const cookies = await browser.cookies()
  const ghCookies = cookies.filter(c => /(^|\.)github\.com$/.test(c.domain)).map(c => c.name)

  console.log('URL      :', page.url())
  console.log('标题     :', info.title)
  console.log('user-login meta :', info.userLogin)
  console.log('有 dashboard 链接:', info.hasDashboard, '| 有登录链接:', info.hasSignin)
  console.log('github cookie 名 :', ghCookies.join(', ') || '(无)')

  fs.writeFileSync(PROFILE + '/_login.json', JSON.stringify({
    url: page.url(), info, cookies: ghCookies
  }, null, 1))
})()
