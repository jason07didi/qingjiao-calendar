// 轻量 HTTP 抓取：支持 http/https、重定向、gzip/deflate 解压、GBK/UTF-8 自动识别。
// 不引入第三方依赖，云函数原生可用。
//
// 2026-11-11 补：
//  1) 原来只用 https.get —— 省级政府站大量还是 http://，直接报
//     "Protocol http: not supported"，这些源等于永远抓不到。现在按协议分发。
//  2) 部分政府站证书链不全（如 www.nsfc.gov.cn），严格校验会直接握手失败。
//     源配置里标 insecure:true 时对该源放开校验；不标就仍然严格校验。
//  3) UA 换成普通浏览器串 —— 相当一部分政府站会拦 "bot" 字样。
const http = require('http')
const https = require('https')
const zlib = require('zlib')
const { TextDecoder } = require('util')

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

function decodeBuf (buf, encHeader, htmlHead) {
  const ce = (encHeader || '').toLowerCase()
  let text
  try {
    if (ce === 'gzip') text = zlib.gunzipSync(buf).toString('utf8')
    else if (ce === 'deflate') text = zlib.inflateSync(buf).toString('utf8')
    else text = buf.toString('utf8')
  } catch (e) {
    text = buf.toString('utf8')
  }
  // 若 header 没带编码，再从 <meta charset> 探测 GBK
  const m = (htmlHead || '').match(/<meta[^>]+charset=['"]?([a-z0-9\-]+)/i)
  const cs = (m && m[1] ? m[1] : '').toLowerCase()
  if (cs === 'gbk' || cs === 'gb2312' || cs === 'gb18030') {
    try { return new TextDecoder('gbk').decode(buf) } catch (e) { return text }
  }
  return text
}

function fetchText (url, opts) {
  opts = opts || {}
  return new Promise(function (resolve, reject) {
    let lib = https
    try {
      lib = String(url).indexOf('https:') === 0 ? https : http
    } catch (e) { return reject(e) }

    const req = lib.get(url, {
      headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: opts.timeout || 9000,
      // 只对源配置里明确标了 insecure 的站点放开证书校验
      rejectUnauthorized: !opts.insecure
    }, function (res) {
      const status = res.statusCode
      if (status >= 300 && status < 400 && res.headers.location) {
        if ((opts.redirects || 0) > 4) return reject(new Error('too many redirects'))
        let next
        try { next = new URL(res.headers.location, url).href } catch (e) { return reject(e) }
        res.resume()
        return fetchText(next, Object.assign({}, opts, { redirects: (opts.redirects || 0) + 1 })).then(resolve, reject)
      }
      if (status !== 200) { res.resume(); return reject(new Error('HTTP ' + status)) }
      const chunks = []
      res.on('data', function (c) { chunks.push(c) })
      res.on('end', function () {
        const buf = Buffer.concat(chunks)
        const head = buf.slice(0, 2000).toString('utf8')
        resolve(decodeBuf(buf, res.headers['content-encoding'], head))
      })
    })
    req.on('error', reject)
    req.on('timeout', function () { req.destroy(new Error('timeout')) })
  })
}

module.exports = { fetchText }
