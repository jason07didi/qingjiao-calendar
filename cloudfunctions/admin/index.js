// 管理云函数：import（导入本地种子为 curated）/ audit（raw→curated）/ stats。
// 触发方式：云开发控制台 → 云函数 admin → 测试，传对应 action。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

exports.main = async function (event, context) {
  const action = (event && event.action) || ''
  if (action === 'import') {
    // event.items: 云端字段数组（由 tools/export_seed.js 生成）
    const items = (event.items || []).map(function (x) {
      return Object.assign({ status: 'curated', source: 'curated', createdAt: Date.now() }, x)
    })
    let added = 0
    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      const exist = it.sourceUrl
        ? await db.collection('notices').where({ sourceUrl: it.sourceUrl }).get()
        : null
      if (exist && exist.data && exist.data.length) {
        await db.collection('notices').doc(exist.data[0]._id).update({ data: it })
      } else {
        await db.collection('notices').add({ data: it })
        added++
      }
    }
    return { ok: true, added: added, total: items.length }
  }

  if (action === 'audit') {
    // 把 raw 且含可信截止日的条目转为 curated（仅当 deadline 非空）
    const raw = await db.collection('notices').where({ status: 'raw', deadline: _.neq('') }).limit(100).get()
    const rows = raw.data || []
    let n = 0
    for (let i = 0; i < rows.length; i++) {
      await db.collection('notices').doc(rows[i]._id).update({ data: { status: 'curated' } })
      n++
    }
    return { ok: true, audited: n }
  }

  if (action === 'stats') {
    const total = await db.collection('notices').count()
    const raw = await db.collection('notices').where({ status: 'raw' }).count()
    const curated = await db.collection('notices').where({ status: 'curated' }).count()
    const subs = await db.collection('subs').count()
    return { ok: true, total: total.total, raw: raw.total, curated: curated.total, subs: subs.total }
  }

  return { ok: false, msg: 'unknown action: ' + action }
}
