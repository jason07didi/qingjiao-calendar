// utils/fund_data.js
// 「基金检索」数据层：国社科(1991-2026) + 教育部人文社科(2020-2026) + 国自然(2017-2026)。
//
// 数据量 ~25 万条，打不进小程序包（主包上限 2MB），走 GitHub Pages 静态分片：
//   <remote>/data/fund/index.json          清单（分片列表 + 学科/类别词表）
//   <remote>/data/fund/nssf_2026.json ...  分片（按年份段，单片 ~2MB 内）
//
// 每片首次用到时才下载（按用户选的年份/基金），进程内缓存，本会话内不重复拉。
// storage 不缓存分片（总量超 10MB 上限），只缓存清单。
//
// 兜底：线上 404/断网时降级到内置分包（packages/funddata + packages/nsfcdata，各 <2MB）。

const CFG = require('./config.js')

// 与 config.remoteUrls 同域名，后台只需要配这一个 request 合法域名
const BASE = 'https://jason07didi.github.io/qingjiao-calendar/data/fund/'

const KEY_MANIFEST = 'pc_fund_manifest'

let manifest = null        // 清单
let chunkCache = {}        // file -> items（进程内缓存）
let loading = {}           // file -> Promise（防止并发重复下载）
let localMod = null        // 兜底分包1（packages/funddata：国社科+教育部）
let nsfcMod = null         // 兜底分包2（packages/nsfcdata：国自然，体积大头单独放）
let usingFallback = false  // 本次会话是否已降级到内置数据

function request (url) {
  return new Promise(function (resolve, reject) {
    wx.request({
      url: url,
      method: 'GET',
      timeout: 20000,
      header: { 'content-type': 'application/json' },
      success: function (res) {
        if (res.statusCode !== 200) return reject(new Error('HTTP ' + res.statusCode))
        let d = res.data
        if (typeof d === 'string') {
          try { d = JSON.parse(d) } catch (e) { return reject(new Error('返回的不是 JSON')) }
        }
        resolve(d)
      },
      fail: function (e) {
        reject(new Error((e && e.errMsg) || 'request fail'))
      }
    })
  })
}

// 清单：优先内存 → 本地缓存 → 远程
function loadIndex () {
  if (manifest) return Promise.resolve(manifest)
  try {
    const c = wx.getStorageSync(KEY_MANIFEST)
    if (c && c.chunks && c.chunks.length) {
      manifest = c
      return Promise.resolve(manifest)
    }
  } catch (e) {}
  return request(BASE + 'index.json').then(function (m) {
    if (!m || !Array.isArray(m.chunks) || !m.chunks.length) throw new Error('清单为空')
    manifest = m
    try { wx.setStorageSync(KEY_MANIFEST, m) } catch (e) {}
    return manifest
  })
}

function loadChunk (file) {
  if (chunkCache[file]) return Promise.resolve(chunkCache[file])
  if (loading[file]) return loading[file]
  loading[file] = request(BASE + file).then(function (d) {
    if (!d || !Array.isArray(d.items)) throw new Error('分片数据为空 @ ' + file)
    chunkCache[file] = d
    delete loading[file]
    return d
  }).catch(function (e) {
    delete loading[file]
    throw e
  })
  return loading[file]
}

// 年份筛选项（与 build_fund_data.py 的分片对齐）
const YEAR_OPTIONS = [
  { key: '2026', label: '2026' },
  { key: '2025', label: '2025' },
  { key: '2024', label: '2024' },
  { key: '2023', label: '2023' },
  { key: '2022', label: '2022' },
  { key: '2021', label: '2021' },
  { key: '2020', label: '2020' },
  { key: 'early', label: '更早' },
  { key: 'all', label: '全部年份' }
]

// ── 兜底分包：线上分片 404 / 网络失败时，用内置分包数据顶着 ──
// 分包1（funddata）：国社科 2026 + 教育部 2025-2026 + 全库 stats + 全库总条数
// 分包2（nsfcdata）：国自然 2026 + 国自然 stats（数据多，拆出去单独懒加载）
function injectChunks (mod) {
  const cs = (mod && mod.chunks) || {}
  for (const f in cs) chunkCache[f] = cs[f]
}

function ensureLocal () {
  if (localMod) return Promise.resolve(localMod)
  return require.async('../packages/funddata/data.js').then(function (mod) {
    localMod = mod
    injectChunks(mod)
    usingFallback = true
    return mod
  })
}

function ensureNsfcLocal () {
  if (nsfcMod) return Promise.resolve(nsfcMod)
  return require.async('../packages/nsfcdata/data.js').then(function (mod) {
    nsfcMod = mod
    injectChunks(mod)
    usingFallback = true
    return mod
  })
}

// 兜底全量（两个分包都加载；本地编译产物，无网络开销）
function ensureLocalAll () {
  return Promise.all([ensureLocal(), ensureNsfcLocal()])
}

function isFallback () {
  return usingFallback
}

// 全库总条数：分包1 的 total 字段（含国自然的全库数）
function localTotal () {
  return (localMod && localMod.total) || 0
}

// ── 统计（stats.json / 分包内置）：学科分布、单位 Top、年度趋势、类别 ──
let statsCache = null

function loadStats () {
  if (statsCache) return Promise.resolve(statsCache)
  return request(BASE + 'stats.json').then(function (s) {
    if (!s || !s.nssf) throw new Error('stats 结构不对')
    statsCache = s
    return s
  }).catch(function () {
    // 线上没有 → 两个兜底分包里的统计合并（分包2 懒加载，本地无网络开销）
    return ensureLocalAll().then(function (mods) {
      const merged = {}
      for (let i = 0; i < mods.length; i++) {
        const st = mods[i] && mods[i].stats
        if (st) for (const k in st) merged[k] = st[k]
      }
      if (!merged.nssf) throw new Error('内置统计缺失')
      statsCache = merged
      return statsCache
    })
  })
}

// 检索下拉词表：学科/类别取统计里全部基金的并集（线上或兜底都行）
function loadOptions () {
  return loadStats().then(function (s) {
    const discs = []
    const cats = []
    const seenD = {}
    const seenC = {}
    const push = function (arr, v, seen, out) {
      if (!v || seen[v]) return
      seen[v] = 1
      out.push(v)
    }
    let total = 0
    for (const f in s) {
      (s[f].discs || []).forEach(function (p) { push(null, p[0], seenD, discs) })
      ;(s[f].cats || []).forEach(function (p) { push(null, p[0], seenC, cats) })
      total += s[f].total || 0
    }
    return { total: total, discs: discs, cats: cats }
  })
}

function yearMatch (y1, y2, yearKey) {
  if (yearKey === 'all') return true
  if (yearKey === 'early') return y2 <= 2019
  const y = parseInt(yearKey, 10)
  return y1 <= y && y <= y2
}

// 根据筛选条件算出需要哪些分片
function neededChunks (m, fundKey, yearKey) {
  const out = []
  for (let i = 0; i < m.chunks.length; i++) {
    const c = m.chunks[i]
    if (fundKey !== 'all' && c.fund !== fundKey) continue
    if (!yearMatch(c.y1, c.y2, yearKey)) continue
    out.push(c)
  }
  return out
}

/**
 * 检索
 * @param {{q?:string, fund?:'all'|'nssf'|'moe'|'nsfc', year?:string, disc?:string, cat?:string}} o
 * @returns {Promise<{items:Array, total:number, loadedCount:number, done:boolean, fallback?:boolean}>}
 *  items 为本页切片，total 为筛选后总数；done 表示所需分片全部加载完。
 *  fallback=true 表示线上分片不可用，已降级到内置分包数据（仅含最新年份）。
 */
function search (o) {
  const q = String(o.q || '').trim().toLowerCase()
  const fund = o.fund || 'all'
  const year = o.year || '2026'
  const disc = o.disc || ''
  const cat = o.cat || ''

  // 「全部年份」必须带关键词，避免一次拉 20MB+ 流量（远程/兜底都一样）
  if (year === 'all' && !q) {
    const err = new Error('全部年份检索请先输入关键词')
    err.code = 'NEED_Q'
    return Promise.reject(err)
  }

  return tryRemote(o).catch(function (e) {
    if (e.code === 'NEED_Q') throw e
    // 远程不可用（404 / 断网 / 清单坏）→ 内置兜底分包
    return ensureLocalAll().then(function () {
      return localSearch(o)
    })
  })
}

function tryRemote (o) {
  const q = String(o.q || '').trim().toLowerCase()
  const fund = o.fund || 'all'
  const year = o.year || '2026'
  const disc = o.disc || ''
  const cat = o.cat || ''

  return loadIndex().then(function (m) {
    const need = neededChunks(m, fund, year)
    if (!need.length) return { items: [], total: 0, loadedCount: 0, done: true }

    return Promise.all(need.map(function (c) { return loadChunk(c.file) })).then(function (parts) {
      const out = []
      for (let p = 0; p < parts.length; p++) {
        collect(parts[p], q, disc, cat, out)
      }
      return { items: out, total: out.length, loadedCount: out.length, done: true, fallback: false }
    })
  })
}

// 兜底检索：只扫进程内已缓存的分片（ensureLocal 已注入内置数据）
function localSearch (o) {
  const q = String(o.q || '').trim().toLowerCase()
  const fund = o.fund || 'all'
  const year = o.year || '2026'
  const disc = o.disc || ''
  const cat = o.cat || ''

  const out = []
  const seen = {}
  for (const f in chunkCache) {
    const d = chunkCache[f]
    if (!d || !Array.isArray(d.items)) continue
    if (fund !== 'all' && d.fund !== fund) continue
    if (!yearMatch(d.y1, d.y2, year)) continue
    if (seen[f]) continue
    seen[f] = 1
    collect(d, q, disc, cat, out)
  }
  return Promise.resolve({
    items: out,
    total: out.length,
    loadedCount: out.length,
    done: true,
    fallback: true
  })
}

// 从一个分片里按条件收集记录
function collect (d, q, disc, cat, out) {
  const items = d.items || []
  for (let i = 0; i < items.length; i++) {
    const r = items[i]  // [title, person, org, disc, cat, year]
    if (disc && r[3] !== disc) continue
    if (cat && r[4] !== cat) continue
    if (q) {
      const hay = r[0] + ' ' + r[1] + ' ' + r[2]
      if (hay.toLowerCase().indexOf(q) < 0) continue
    }
    out.push({
      id: d.fund + '_' + d.y1 + '_' + i,
      title: r[0],
      person: r[1],
      org: r[2],
      disc: r[3],
      cat: r[4],
      year: r[5]
    })
  }
}

// 分页切片（search 返回全量筛选结果，页面自己切）
function pageSlice (list, page, size) {
  const s = Math.max(0, (page - 1)) * size
  return list.slice(s, s + size)
}

function loadedBytes () {
  // 估算当前会话已下载的记录数（给页面展示用）
  let n = 0
  for (const k in chunkCache) n += (chunkCache[k].items || []).length
  return n
}

module.exports = {
  BASE: BASE,
  YEAR_OPTIONS: YEAR_OPTIONS,
  loadIndex: loadIndex,
  loadStats: loadStats,
  loadOptions: loadOptions,
  localTotal: localTotal,
  search: search,
  pageSlice: pageSlice,
  loadedCount: loadedBytes,
  isFallback: isFallback
}
