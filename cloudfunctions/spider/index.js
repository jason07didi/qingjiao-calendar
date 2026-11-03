const cloud = require('wx-server-sdk')
const { SOURCES, TRUST_KEYWORDS } = require('./sources')
const { fetchText } = require('./fetch')
const { makeParseList } = require('./parse')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 解析器与 tools/local_spider.js 共用同一份实现，避免两处逻辑漂移
const parseList = makeParseList(TRUST_KEYWORDS)

async function crawlOne (src) {
  const html = await fetchText(src.listUrl, { timeout: 9000 })
  const items = parseList(html, src)
  let added = 0, updated = 0
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const exist = await db.collection('notices').where({ sourceUrl: it.sourceUrl }).get()
    if (exist.data && exist.data.length) {
      await db.collection('notices').doc(exist.data[0]._id).update({ data: it })
      updated++
    } else {
      await db.collection('notices').add({ data: it })
      added++
    }
  }
  return { count: items.length, added: added, updated: updated }
}

exports.main = async function (event, context) {
  const summary = { sources: 0, added: 0, updated: 0, failed: 0, errors: [] }
  for (let i = 0; i < SOURCES.length; i++) {
    const src = SOURCES[i]
    try {
      const r = await crawlOne(src)
      summary.sources++
      summary.added += r.added
      summary.updated += r.updated
    } catch (e) {
      summary.failed++
      summary.errors.push(src.name + ': ' + (e.message || e))
    }
  }
  try {
    await db.collection('crawl_logs').add({ data: { at: Date.now(), type: 'crawl', summary: summary } })
  } catch (e) {}
  return summary
}
