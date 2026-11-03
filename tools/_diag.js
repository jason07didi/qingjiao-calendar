// 诊断：看 /new 页面实际渲染了什么
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const SHOTS = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto/shots'

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 940 })

  const resp = await page.goto('https://github.com/new', { waitUntil: 'networkidle2', timeout: 60000 }).catch(e => null)
  await new Promise(r => setTimeout(r, 3000))
  await page.screenshot({ path: SHOTS + '/diag.png', fullPage: false })

  const d = await page.evaluate(() => {
    const inputs = Array.from(document.querySelectorAll('input')).map(i => ({
      id: i.id, name: i.name, type: i.type, ph: i.placeholder || '', vis: !!(i.offsetWidth || i.offsetHeight)
    }))
    return {
      url: location.href,
      title: document.title,
      status: document.readyState,
      text: (document.body ? document.body.innerText : '').slice(0, 900),
      inputs: inputs.slice(0, 25),
      buttons: Array.from(document.querySelectorAll('button')).map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 15)
    }
  })
  console.log('URL:', d.url)
  console.log('标题:', d.title)
  console.log('httpStatus:', resp && resp.status())
  console.log('--- inputs ---')
  d.inputs.forEach(i => console.log('  #' + i.id + ' name=' + i.name + ' type=' + i.type + ' visible=' + i.vis + ' ph=' + i.ph))
  console.log('--- buttons ---')
  console.log('  ' + d.buttons.join(' | '))
  console.log('--- 文本 ---')
  console.log(d.text)
  fs.writeFileSync(SHOTS + '/diag.json', JSON.stringify(d, null, 1))
  await page.close()
  browser.disconnect()
})()
