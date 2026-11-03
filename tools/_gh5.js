// 临时脚本：在已登录会话里创建仓库 qingjiao-calendar（适配 2026 新版建仓页）
const puppeteer = require('puppeteer-core')
const fs = require('fs')

const PORT = 9222
const SHOTS = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto/shots'
const NAME = 'qingjiao-calendar'

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:' + PORT, defaultViewport: null })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 940 })

  await page.goto('https://github.com/new', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('#repository-name-input', { timeout: 20000 })
  await new Promise(r => setTimeout(r, 1200))

  // 仓库名
  await page.click('#repository-name-input')
  await page.type('#repository-name-input', NAME, { delay: 50 })

  // 描述
  const descSel = 'input[name="Description"]'
  if (await page.$(descSel)) {
    await page.click(descSel)
    await page.type(descSel, '青椒的日历 · 数据源（每日自动抓取，供小程序 wx.request 读取）', { delay: 8 })
  }

  await new Promise(r => setTimeout(r, 800))
  await page.screenshot({ path: SHOTS + '/1-filled.png' })

  // 点 Create repository
  const ok = await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(x => /^Create repository$/i.test((x.textContent || '').trim()))
    if (b) { b.click(); return true }
    return false
  })
  if (!ok) { console.log('未找到创建按钮'); process.exit(1) }

  // 等待跳转
  let finalUrl = ''
  for (let i = 0; i < 25; i++) {
    await new Promise(r => setTimeout(r, 800))
    finalUrl = page.url()
    if (!/\/new/.test(finalUrl)) break
  }
  await new Promise(r => setTimeout(r, 2500))
  await page.screenshot({ path: SHOTS + '/2-created.png' })

  const d = await page.evaluate(() => ({
    url: location.href,
    title: document.title,
    text: (document.body.innerText || '').slice(0, 700)
  }))
  console.log('最终 URL:', d.url)
  console.log('标题    :', d.title)
  console.log('--- 页面文本 ---')
  console.log(d.text)

  fs.writeFileSync(SHOTS + '/2-result.json', JSON.stringify(d, null, 1))
  await page.close()
  browser.disconnect()
})()
