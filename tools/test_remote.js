// tools/_test_remote.js  端到端自测：假 wx + 本地 HTTP 服务，跑真实 api.getList()
const http = require('http')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const DATA = fs.readFileSync(path.join(ROOT, 'docs/data/notices.json'))

// ---------- 假 wx ----------
const store = {}
let reqCount = 0
global.wx = {
  request: function (o) {
    reqCount++
    const u = new URL(o.url)
    http.get({ host: u.hostname, port: u.port, path: u.pathname + u.search, timeout: o.timeout }, function (r) {
      let d = ''
      r.on('data', c => d += c)
      r.on('end', function () {
        o.success({ statusCode: r.statusCode, data: d, header: r.headers })
      })
    }).on('error', function (e) {
      o.fail({ errMsg: 'request:fail ' + e.message })
    })
  },
  getStorageSync: function (k) { return store[k] === undefined ? '' : store[k] },
  setStorageSync: function (k, v) { store[k] = v }
}

const CFG = require(path.join(ROOT, 'utils/config.js'))
const api = require(path.join(ROOT, 'utils/api.js'))

// ---------- 服务 ----------
function serve (port) {
  return new Promise(function (res) {
    const s = http.createServer(function (req, r) {
      if (req.url.indexOf('/data/notices.json') === 0) {
        r.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' })
        r.end(DATA)
      } else {
        // 模拟 GitHub Pages 的 404 HTML
        r.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' })
        r.end('<!DOCTYPE html><html><body>404 Not Found</body></html>')
      }
    })
    s.listen(port, '127.0.0.1', function () { res(s) })
  })
}

function reset () {
  Object.keys(store).forEach(k => delete store[k])
  reqCount = 0
}

(async function () {
  const PORT = 18731
  const server = await serve(PORT)

  // ---------- 用例 1：正常读到远程数据 ----------
  console.log('========== 用例 1：远程文件正常 ==========')
  reset()
  CFG.remoteUrls = ['http://127.0.0.1:' + PORT + '/data/notices.json']
  CFG.enableRemote = true
  let t0 = Date.now()
  let r = await api.getList({ force: true })
  console.log('  from        :', r.from, '（应为 remote）')
  console.log('  dataUpdatedAt:', r.dataUpdatedAt)
  console.log('  条数        :', r.list.length)
  console.log('  耗时        :', (Date.now() - t0) + 'ms')
  console.log('  请求次数    :', reqCount)
  const remoteOnly = r.list.filter(x => x.source === 'auto').length
  console.log('  其中自动抓取:', remoteOnly)
  const sample = r.list[0]
  console.log('  首条 id/title:', sample.id, '/', String(sample.title).slice(0, 24))
  console.log('  首条 conf 字段:', sample.conf ? '已补算' : '(非会议，正常)')

  // ---------- 用例 2：二次调用命中缓存，不发请求 ----------
  console.log('\n========== 用例 2：30 分钟内再打开，走缓存不重复请求 ==========')
  reset()
  t0 = Date.now()
  r = await api.getList({ force: false })
  console.log('  from        :', r.from, '（应为 remote，来自本地缓存）')
  console.log('  条数        :', r.list.length)
  console.log('  耗时        :', (Date.now() - t0) + 'ms')
  console.log('  请求次数    :', reqCount, '（应为 0）')

  // ---------- 用例 3：404 → 优雅降级 ----------
  console.log('\n========== 用例 3：路径写错返回 404 HTML ==========')
  reset()
  CFG.remoteUrls = ['http://127.0.0.1:' + PORT + '/wrong/notices.json']
  t0 = Date.now()
  r = await api.getList({ force: true })
  console.log('  from        :', r.from, '（应降级，不是 remote）')
  console.log('  条数        :', r.list.length, '（包内数据兜底，不能白屏）')
  console.log('  耗时        :', (Date.now() - t0) + 'ms  ← 失败要快，不能卡住')

  // ---------- 用例 4：地址全挂 ----------
  console.log('\n========== 用例 4：域名根本连不上 ==========')
  reset()
  CFG.remoteUrls = ['http://127.0.0.1:19999/data/notices.json']
  t0 = Date.now()
  r = await api.getList({ force: true })
  console.log('  from        :', r.from)
  console.log('  条数        :', r.list.length)
  console.log('  耗时        :', (Date.now() - t0) + 'ms')

  // ---------- 用例 5：schema 不对（拿真实 GitHub 上的 news.json 试）----------
  console.log('\n========== 用例 5：真实 GitHub Pages 上格式不符的文件 ==========')
  reset()
  CFG.remoteUrls = ['https://jason07didi.github.io/icat-radar/data/news.json']
  global.wx.request = function (o) {
    reqCount++
    require('https').get(o.url, { headers: { 'User-Agent': 'wx' }, timeout: 15000 }, function (res) {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => o.success({ statusCode: res.statusCode, data: d, header: res.headers }))
    }).on('error', e => o.fail({ errMsg: 'request:fail ' + e.message }))
  }
  t0 = Date.now()
  r = await api.getList({ force: true })
  console.log('  from        :', r.from, '（该文件的 items 缺 type，应全部被拒 → 降级）')
  console.log('  条数        :', r.list.length)
  console.log('  耗时        :', (Date.now() - t0) + 'ms')

  server.close()
  console.log('\n完成。')
})()
