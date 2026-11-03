// 轻量 HTTP 抓取：支持重定向、gzip/deflate 解压、GBK/UTF-8 自动识别。
// 不引入第三方依赖，云函数原生可用。
const https = require('https')
const zlib = require('zlib')
const { TextDecoder } = require('util')

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
    const req = https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; QingJiaoCalBot/1.0; +research notice crawler)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Encoding': 'gzip, deflate'
      },
      timeout: opts.timeout || 9000
    }, function (res) {
      const status = res.statusCode
      if (status >= 300 && status < 400 && res.headers.location) {
        if ((opts.redirects || 0) > 4) return reject(new Error('too many redirects'))
        const next = new URL(res.headers.location, url).href
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
