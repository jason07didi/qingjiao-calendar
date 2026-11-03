// 常驻：启动带调试端口的 Chrome 并保持运行（供后续脚本 puppeteer.connect）
const { spawn } = require('child_process')
const fs = require('fs')

const CHROME = process.env.LOCALAPPDATA + '/Google/Chrome/Application/chrome.exe'
const PROFILE = 'C:/Users/Administrator/AppData/Local/Temp/qt-auto'
const PORT = 9222

const child = spawn(CHROME, [
  '--user-data-dir=' + PROFILE,
  '--remote-debugging-port=' + PORT,
  '--no-first-run',
  '--no-default-browser-check',
  '--hide-crash-restore-bubble',
  '--window-size=1280,940',
  'https://github.com/'
], { detached: true, stdio: 'ignore' })
child.unref()

fs.writeFileSync(PROFILE + '/_pid.txt', String(child.pid))
console.log('chrome 已启动 pid=' + child.pid + ' port=' + PORT)

// 保活：不退出，浏览器就不会被回收
setInterval(function () {}, 1 << 30)
