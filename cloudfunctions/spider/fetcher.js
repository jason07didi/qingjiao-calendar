// fetcher.js
// 只依赖 Node 内置模块，避免云端装依赖失败。
// 负责：重定向、gzip/br 解压、GBK 编码识别、超时、重试。

const http = require('http')
const https = require('https')
const zlib = require('zlib')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
const TIMEOUT = 12000
const MAX_REDIRECT = 4

function decompress (buf, enc) {
  if (!enc) return buf
  const e = String(enc).toLowerCase()
  try {
    if (e.indexOf('br') > -1) return zlib.brotliDecompressSync(buf)
    if (e.indexOf('gzip') > -1) return zlib.gunzipSync(buf)
    if (e.indexOf('deflate') > -1) return zlib.inflateSync(buf)
  } catch (err) {
    try { return zlib.inflateRawSync(buf) } catch (e2) { return buf }
  }
  return buf
}

// 政府站大量使用 GB2312/GBK，直接 utf8 解码会全乱码
function decode (buf, contentType) {
  let enc = ''
  const m = /charset\s*=\s*["']?([\w-]+)/i.exec(contentType || '')
  if (m) enc = m[1].toLowerCase()
  if (!enc) {
    const head = buf.slice(0, 4000).toString('latin1')
    const m2 = /charset\s*=\s*["']?([\w-]+)/i.exec(head)
    if (m2) enc = m2[1].toLowerCase()
  }
  if (enc === 'gb2312' || enc === 'gbk' || enc === 'gb18030') {
    try { return { text: new TextDecoder('gbk').decode(buf), encoding: 'gbk' } } catch (e) {}
  }
  if (enc && enc !== 'utf-8' && enc !== 'utf8') {
    try { return { text: new TextDecoder(enc).decode(buf), encoding: enc } } catch (e) {}
  }
  return { text: buf.toString('utf8'), encoding: 'utf8' }
}

function once (urlStr, redirectLeft) {
  return new Promise(function (resolve, reject) {
    let u
    try { u = new URL(urlStr) } catch (e) { return reject(new Error('bad url: ' + urlStr)) }
    const mod = u.protocol === 'https:' ? https : http
    const req = mod.request({
      protocol: u.protocol,
      hostname: u.hostname,
      port: u.port || (u.protocol === 'https:' ? 443 : 80),
      path: u.pathname + u.search,
      method: 'GET',
      rejectUnauthorized: false,
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'close'
      }
    }, function (res) {
      const code = res.statusCode || 0
      if (code >= 300 && code < 400 && res.headers.location && redirectLeft > 0) {
        res.resume()
        const next = new URL(res.headers.location, urlStr).toString()
        return resolve(once(next, redirectLeft - 1))
      }
      const parts = []
      res.on('data', function (c) { parts.push(c) })
      res.on('end', function () {
        const raw = decompress(Buffer.concat(parts), res.headers['content-encoding'])
        resolve({
          status: code,
          headers: res.headers,
          buf: raw,
          url: urlStr
        })
      })
    })
    req.setTimeout(TIMEOUT, function () {
      req.destroy(new Error('timeout ' + TIMEOUT + 'ms'))
    })
    req.on('error', reject)
    req.end()
  })
}

// 返回 { ok, status, html, encoding, bytes, url, error }
async function fetchText (urlStr) {
  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await once(urlStr, MAX_REDIRECT)
      if (r.status < 200 || r.status >= 400) {
        lastErr = new Error('HTTP ' + r.status)
        // 403/404 不重试
        if (r.status === 403 || r.status === 404) break
        continue
      }
      const d = decode(r.buf, r.headers['content-type'])
      return {
        ok: true,
        status: r.status,
        html: d.text,
        encoding: d.encoding,
        bytes: r.buf.length,
        url: r.url
      }
    } catch (e) {
      lastErr = e
    }
  }
  return {
    ok: false,
    status: 0,
    html: '',
    encoding: '',
    bytes: 0,
    url: urlStr,
    error: lastErr ? String(lastErr.message || lastErr) : 'unknown'
  }
}

module.exports = { fetchText: fetchText }
