// 诊断：经典 PAT 创建页的结构
const puppeteer = require('puppeteer-core')
const fs = require('fs')
const SHOTS = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto/shots'

;(async () => {
  fs.mkdirSync(SHOTS, { recursive: true })
  const browser = await puppeteer.connect({ browserURL: 'http://127.0.0.1:9222', defaultViewport: null })
  const page = await browser.newPage()
  await page.setViewport({ width: 1280, height: 940 })

  await page.goto('https://github.com/settings/tokens/new?scopes=repo,workflow&description=qingjiao-calendar', {
    waitUntil: 'domcontentloaded', timeout: 60000
  })
  await new Promise(r => setTimeout(r, 4000))
  await page.screenshot({ path: SHOTS + '/token-page.png', fullPage: true })

  const d = await page.evaluate(() => {
    const q = s => Array.from(document.querySelectorAll(s))
    return {
      url: location.href,
      title: document.title,
      inputs: q('input').map(i => ({ id: i.id, name: i.name, type: i.type, val: i.type === 'checkbox' ? String(i.checked) : (i.value || '').slice(0, 40) })).slice(0, 30),
      selects: q('select').map(s => ({ id: s.id, name: s.name, val: s.value, opts: Array.from(s.options).map(o => o.value).slice(0, 8) })),
      buttons: q('button').map(b => (b.textContent || '').trim()).filter(Boolean).slice(0, 12),
      text: (document.body.innerText || '').slice(0, 700)
    }
  })
  console.log('URL:', d.url)
  console.log('标题:', d.title)
  console.log('--- inputs ---')
  d.inputs.forEach(i => console.log('  #' + i.id + ' name=' + i.name + ' type=' + i.type + ' val=' + i.val))
  console.log('--- selects ---')
  d.selects.forEach(s => console.log('  #' + s.id + ' val=' + s.val + ' opts=' + s.opts.join(',')))
  console.log('--- buttons ---')
  console.log('  ' + d.buttons.join(' | '))
  console.log('--- 文本 ---')
  console.log(d.text)
  fs.writeFileSync(SHOTS + '/token-diag.json', JSON.stringify(d, null, 1))
  await page.close()
  browser.disconnect()
})()
