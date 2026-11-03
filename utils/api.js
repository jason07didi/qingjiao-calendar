// utils/api.js
// 数据层：远程静态数据（GitHub Pages）→ 云开发数据库 → 本地缓存 → 包内数据。
// 页面只跟这里打交道，不直接碰 wx.request / wx.cloud，方便以后换后端。

const CFG = require('./config.js')
const local = require('./notices.js')
const confInfo = require('./conf_info.js')
const remote = require('./remote.js')

const KEY_CACHE = 'pc_cache_list'
const KEY_CACHE_AT = 'pc_cache_at'
const KEY_CACHE_META = 'pc_cache_meta'

let inited = false
let cloudOK = false
let dbRef = null

function initCloud () {
  if (inited) return cloudOK
  inited = true
  if (!CFG.enableCloud || !CFG.cloudEnv) return (cloudOK = false)
  if (!wx.cloud) return (cloudOK = false)
  try {
    wx.cloud.init({ env: CFG.cloudEnv, traceUser: true })
    cloudOK = true
  } catch (e) {
    cloudOK = false
  }
  return cloudOK
}

function db () {
  if (!dbRef && cloudOK) dbRef = wx.cloud.database()
  return dbRef
}

// 统一字段与 id 前缀：c_ 云端 / l_ 本地，避免两套 id 撞车
function mapCloud (d) {
  return {
    id: 'c_' + d._id,
    type: d.type || 'project',
    title: d.title || '',
    org: d.org || '',
    region: d.region || '',
    level: d.level || '',
    rank: d.rank || null,
    disciplines: d.disciplines || [],
    startAt: d.startAt || '',
    deadline: d.deadline || '',
    deadlineText: d.deadlineText || '',
    deadlineEstimated: !!d.deadlineEstimated,
    // 开放课题/开放基金：穿透省份与学科过滤，全国可申
    openApply: !!d.openApply,
    info: d.info || {},
    conditions: d.conditions || [],
    files: d.files || [],
    summary: d.summary || '',
    curated: d.curated || '',
    peerNote: d.peerNote || '',
    freq: d.freq || '',
    sourceUrl: d.sourceUrl || '',
    sourceName: d.sourceName || '',
    source: d.source || (d.status === 'raw' ? 'crawl' : 'curated'),
    status: d.status || 'raw',
    // 云端会议条目没存 conf 时本地补算，保证详情页的会议组织/分论坛/到场单位不空
    conf: d.conf || (d.type === 'conference' ? confInfo.enrich(d) : null),
    confLine: d.confLine || (d.type === 'conference' ? confInfo.cardLine(confInfo.enrich(d)) : '')
  }
}

function mapLocal (n) {
  return {
    // 本地数据直接用裸 id（r7 / 3），保证列表与详情、收藏用的是同一个 key
    id: String(n.id),
    type: n.type,
    title: n.title,
    org: n.org,
    region: n.region,
    level: n.level || '',
    rank: n.rank || null,
    disciplines: n.disciplines || [],
    startAt: n.startAt || '',
    deadline: n.deadline || '',
    deadlineText: n.deadlineText || '',
    // 必须原样保留：结构化库的日期是按往年惯例推算的，标错会误导用户
    deadlineEstimated: !!n.deadlineEstimated,
    openApply: !!n.openApply,
    info: n.info || {},
    conditions: n.conditions || [],
    files: n.files || [],
    summary: n.summary || '',
    curated: n.curated || '',
    peerNote: n.peerNote || '',
    freq: n.freq || '',
    sourceUrl: n.sourceUrl || '',
    sourceName: n.sourceName || '',
    source: n.source || 'curated',
    status: n.source === 'crawl' ? 'raw' : 'curated',
    conf: n.conf || (n.type === 'conference' ? confInfo.enrich(n) : null),
    confLine: n.confLine || (n.type === 'conference' ? confInfo.cardLine(confInfo.enrich(n)) : '')
  }
}

function localList () {
  return local.getAll().map(mapLocal)
}

function readCache () {
  try {
    const at = wx.getStorageSync(KEY_CACHE_AT) || 0
    const list = wx.getStorageSync(KEY_CACHE)
    if (!list || !list.length) return null
    let meta = {}
    try {
      meta = wx.getStorageSync(KEY_CACHE_META) || {}
    } catch (e) {}
    return { at: at, list: list, from: meta.from || '', dataUpdatedAt: meta.dataUpdatedAt || '' }
  } catch (e) {
    return null
  }
}

function writeCache (list, meta) {
  try {
    wx.setStorageSync(KEY_CACHE, list)
    wx.setStorageSync(KEY_CACHE_AT, Date.now())
    wx.setStorageSync(KEY_CACHE_META, meta || {})
  } catch (e) {}
}

// 远程数据在前（最新的），包内数据补齐 id 不重复的部分。
// 用「合并」而不是「替换」：远程万一少了几条，用户也不会突然看不到东西。
function mergeWithLocal (remoteItems) {
  const out = []
  const seen = {}
  for (let i = 0; i < remoteItems.length; i++) {
    const m = mapLocal(remoteItems[i])
    if (seen[m.id]) continue
    seen[m.id] = 1
    out.push(m)
  }
  const loc = localList()
  for (let i = 0; i < loc.length; i++) {
    if (!seen[loc[i].id]) out.push(loc[i])
  }
  return out
}

async function fetchCloudList () {
  const d = db()
  if (!d) throw new Error('cloud not ready')
  const _ = d.command
  const out = []
  for (let skip = 0; skip < CFG.maxItems; skip += CFG.pageSize) {
    const r = await d.collection('notices')
      .where({ status: _.in(['curated', 'raw']) })
      .orderBy('deadline', 'asc')
      .skip(skip)
      .limit(CFG.pageSize)
      .get()
    const rows = r.data || []
    for (let i = 0; i < rows.length; i++) out.push(mapCloud(rows[i]))
    if (rows.length < CFG.pageSize) break
  }
  return out
}

/**
 * 取列表
 * 顺序：远程静态数据(GitHub Pages) → 云数据库 → 缓存 → 包内数据
 * @param {{force?:boolean}} opts
 * @returns {Promise<{list:Array, from:'remote'|'cloud'|'cache'|'local', at:number, dataUpdatedAt?:string}>}
 */
async function getList (opts) {
  const force = !!(opts && opts.force)
  const cache = readCache()
  const age = cache ? Date.now() - cache.at : Infinity
  const ttl = (CFG.remoteTTL || 30 * 60 * 1000)

  // ① 远程静态数据：这就是“不用重新发版也能换内容”的那一层。
  //    单独用一个短有效期，不受 cacheTTL 的 6 小时限制。
  if (CFG.enableRemote && (force || age > ttl)) {
    try {
      const r = await remote.load()
      const list = mergeWithLocal(r.items)
      if (list.length) {
        const meta = { from: 'remote', dataUpdatedAt: r.updatedAt || '' }
        writeCache(list, meta)
        return { list: list, from: 'remote', at: Date.now(), dataUpdatedAt: r.updatedAt || '', remoteUrl: r.url || '' }
      }
    } catch (e) {
      // 静默降级：域名没配好 / 断网 / 文件路径错，都继续往下走
    }
  }

  if (!force && cache && age < CFG.cacheTTL) {
    return { list: cache.list, from: cache.from || 'cache', at: cache.at, dataUpdatedAt: cache.dataUpdatedAt || '' }
  }

  if (initCloud()) {
    try {
      const list = await fetchCloudList()
      if (list.length) {
        writeCache(list, { from: 'cloud' })
        return { list: list, from: 'cloud', at: Date.now() }
      }
      // 云端为空：可能是还没导入数据，退回缓存或本地，别给用户看空页面
      if (cache && cache.list.length) return { list: cache.list, from: cache.from || 'cache', at: cache.at, dataUpdatedAt: cache.dataUpdatedAt || '' }
      return { list: localList(), from: 'local', at: Date.now() }
    } catch (e) {
      if (cache && cache.list.length) return { list: cache.list, from: cache.from || 'cache', at: cache.at, dataUpdatedAt: cache.dataUpdatedAt || '' }
      return { list: localList(), from: 'local', at: Date.now() }
    }
  }

  if (cache && cache.list.length) {
    return { list: cache.list, from: cache.from || 'cache', at: cache.at, dataUpdatedAt: cache.dataUpdatedAt || '' }
  }

  return { list: localList(), from: 'local', at: Date.now() }
}

/**
 * 取单条
 * @param {string} id 形如 c_xxx / l_3
 */
async function getById (id, pool) {
  const key = String(id || '')
  if (pool && pool.length) {
    for (let i = 0; i < pool.length; i++) {
      if (pool[i].id === key) return pool[i]
    }
  }

  if (key.indexOf('c_') === 0 && initCloud()) {
    try {
      const r = await db().collection('notices').doc(key.slice(2)).get()
      if (r.data) return mapCloud(r.data)
    } catch (e) {}
  }

  if (key.indexOf('l_') === 0) {
    const n = local.getById(key.slice(2))
    return n ? mapLocal(n) : null
  }

  // 裸 id（如 r7 / 3）：先按本地全量找，再退回数字匹配
  const bare = local.getById(key)
  if (bare) return mapLocal(bare)

  // 兼容：老版本分享卡片里带的是纯数字 id（没有前缀）
  const num = parseInt(key, 10)
  if (!isNaN(num) && String(num) === key) {
    const n = local.getById(num)
    if (n) return mapLocal(n)
  }

  // 兜底：本地全量里按标题找不到就返回 null
  return null
}

/**
 * 数据中心状态：条数 + 最近一次抓取时间
 */
async function getMeta () {
  if (!initCloud()) return null
  const d = db()
  if (!d) return null
  try {
    const cnt = await d.collection('notices').count()
    let last = null
    try {
      const lg = await d.collection('crawl_logs')
        .orderBy('at', 'desc')
        .limit(5)
        .get()
      const rows = lg.data || []
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].type !== 'notify') { last = rows[i]; break }
      }
    } catch (e) {}
    return {
      total: cnt.total,
      lastRunAt: last ? last.at : 0,
      added: last && last.summary ? last.summary.added : 0
    }
  } catch (e) {
    return null
  }
}

/**
 * 写入提醒订阅（由 notify 云函数落库，客户端不直接写数据库）
 */
async function subscribe (payload) {
  if (!initCloud()) return { ok: false, msg: 'offline' }
  try {
    const r = await wx.cloud.callFunction({
      name: 'notify',
      data: Object.assign({ action: 'subscribe' }, payload)
    })
    return r.result || { ok: false }
  } catch (e) {
    return { ok: false, msg: String(e.errMsg || e.message || e) }
  }
}

// 把本地收藏同步上云（notify.sync 落库到 subs 集合），供每日推送读取。
// items: [{id,title,deadline,type,org}] 精简字段即可。
async function syncFavs (items, removeIds) {
  if (!initCloud()) return { ok: false, msg: 'offline' }
  try {
    const r = await wx.cloud.callFunction({
      name: 'notify',
      data: { action: 'sync', items: items || [], removeIds: removeIds || [] }
    })
    return r.result || { ok: false }
  } catch (e) {
    return { ok: false, msg: String(e.errMsg || e.message || e) }
  }
}

module.exports = {
  CFG: CFG,
  cloudEnabled: function () { return initCloud() },
  cloudReady: function () { return cloudOK },
  getList: getList,
  getById: getById,
  getMeta: getMeta,
  subscribe: subscribe,
  syncFavs: syncFavs
}
