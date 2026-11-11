// utils/remote.js
// 远程静态数据源：用 wx.request 拉 GitHub Pages 上的 notices.json。
//
// 为什么用这条路：
//   小程序唯一合法的联网出口是「已备案 + 已进白名单」的域名。github.io 走的是
//   github.io 这个域，只要它在【开发管理 → 开发设置 → 服务器域名】的 request
//   合法域名里，wx.request 就能直连，不需要云开发、不需要服务器。
//
// 数据格式（data/notices.json，由 tools/build_remote.js 生成）：
//   { v:1, updatedAt:'2026-11-03', generatedAt:'...', count:305, items:[...] }
//
// 设计原则：这里只负责「拿到并校验」，拿不到就抛错，由 api.js 决定降级。

const CFG = require('./config.js')

const KEY = 'pc_remote_cache'
const KEY_AT = 'pc_remote_at'

// 一次请求：拿到 URL 上的 JSON，任何异常都 reject
function request (url) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: 'GET',
      timeout: CFG.remoteTimeout || 10000,
      header: { 'content-type': 'application/json' },
      success: function (res) {
        if (res.statusCode !== 200) {
          return reject(new Error('HTTP ' + res.statusCode + ' @ ' + url))
        }
        let d = res.data
        if (typeof d === 'string') {
          // GitHub Pages 的 404 会返回 HTML，这里会解析失败并降级，不会被当成数据
          try {
            d = JSON.parse(d)
          } catch (e) {
            return reject(new Error('返回的不是 JSON（可能路径写错命中 404 页面）'))
          }
        }
        resolve(d)
      },
      fail: function (e) {
        reject(new Error((e && e.errMsg) || 'request fail'))
      }
    })
  })
}

// 只保留我们认识的字段，防止脏数据把页面搞崩
function clean (n) {
  if (!n || typeof n !== 'object') return null
  const title = String(n.title || '').trim()
  const type = String(n.type || '').trim()
  if (!title || !type) return null
  if (n.id === undefined || n.id === null || String(n.id) === '') return null
  return {
    // id 与包内数据同一套（r7 / auto_xxx），收藏不会因为切数据源而失效
    id: String(n.id),
    type: type,
    title: title,
    org: n.org || '',
    region: n.region || '',
    level: n.level || '',
    rank: n.rank || null,
    disciplines: Array.isArray(n.disciplines) ? n.disciplines : [],
    startAt: n.startAt || '',
    // 截止日铁律：没核实就只能是空字符串，绝不在这里补、也绝不推算
    deadline: n.deadline || '',
    deadlineText: n.deadlineText || '',
    deadlineEstimated: !!n.deadlineEstimated,
    // 截止日来源：detail = 从通知正文摘录（真实但需核对）/ freq = 按往年规律推算
    deadlineFrom: n.deadlineFrom || '',
    deadlineSnippet: n.deadlineSnippet || '',
    openApply: !!n.openApply,
    info: n.info || {},
    conditions: Array.isArray(n.conditions) ? n.conditions : [],
    files: Array.isArray(n.files) ? n.files : [],
    summary: n.summary || '',
    curated: n.curated || '',
    peerNote: n.peerNote || '',
    freq: n.freq || '',
    sourceUrl: n.sourceUrl || '',
    sourceName: n.sourceName || '',
    source: n.source || 'curated',
    auto: !!n.auto
  }
}

// 校验整包：条数、版本、字段
function validate (d, url) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('数据结构不对 @ ' + url)
  const items = d.items
  if (!Array.isArray(items) || !items.length) throw new Error('items 为空 @ ' + url)
  const out = []
  const seen = {}
  for (let i = 0; i < items.length; i++) {
    const c = clean(items[i])
    if (!c || seen[c.id]) continue
    seen[c.id] = 1
    out.push(c)
  }
  if (!out.length) throw new Error('没有一条合法数据 @ ' + url)
  return {
    items: out,
    updatedAt: d.updatedAt || '',
    generatedAt: d.generatedAt || '',
    version: d.v || 0,
    url: url,
    dropped: items.length - out.length
  }
}

function readCache () {
  try {
    const list = wx.getStorageSync(KEY)
    if (!list || !list.length) return null
    return { at: wx.getStorageSync(KEY_AT) || 0, items: list }
  } catch (e) {
    return null
  }
}

function writeCache (r) {
  try {
    wx.setStorageSync(KEY, r.items)
    wx.setStorageSync(KEY_AT, Date.now())
  } catch (e) {}
}

/**
 * 依次尝试配置里的地址，第一个成功的就用。
 * 同一域名下多个路径 → 后台只配一条域名就行。
 * @returns {Promise<{items:Array, updatedAt:string, url:string, fromCache?:boolean}>}
 */
async function load () {
  const urls = CFG.remoteUrls || []
  if (!urls.length) throw new Error('未配置 remoteUrls')

  let lastErr = null
  for (let i = 0; i < urls.length; i++) {
    try {
      const raw = await request(urls[i])
      const r = validate(raw, urls[i])
      writeCache(r)
      return r
    } catch (e) {
      lastErr = e
    }
  }

  // 全部失败：有旧缓存就先顶着，总比白屏好
  const c = readCache()
  if (c && c.items.length) {
    return { items: c.items, updatedAt: '', url: '', fromCache: true }
  }
  throw lastErr || new Error('远程数据不可用')
}

module.exports = {
  load: load,
  request: request,
  validate: validate,
  cacheAge: function () {
    const c = readCache()
    return c ? Date.now() - c.at : -1
  }
}
