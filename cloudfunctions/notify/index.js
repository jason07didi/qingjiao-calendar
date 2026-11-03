// 青椒的日历 · notify 云函数
// 两个职责：
//  1) 定时（每天 08:00 北京时间）推送「用户收藏 + 临近截止」的项 —— 只推收藏的，不群发。
//  2) 客户端调用 action:'sync'：把用户的收藏项同步进 subs 集合（上云），供推送读取。
//
// 设计铁律：只提醒收藏的；精确推送依赖微信订阅消息一次/长期授权。
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

// 订阅消息模板 ID —— 在微信公众平台「订阅消息」申请「科研截止提醒」类模板后填入（环境变量 TMPL_ID）。
// 空字符串时推送只记录、不真正发送（便于先跑通流程）。
const TMPL_ID = process.env.TMPL_ID || ''

exports.main = async function (event, context) {
  const wxContext = cloud.getWXContext()
  const action = (event && event.action) || ''

  // ---------- 收藏同步上云：客户端在收藏/取消时调用 ----------
  if (action === 'sync') {
    const items = (event.items || []).filter(function (x) { return x && x.id })
    const removeIds = (event.removeIds || []).map(String)
    if (!items.length && !removeIds.length) return { ok: true, upsert: 0, removed: 0 }
    let upsert = 0
    for (let i = 0; i < items.length; i++) {
      const x = items[i]
      const exist = await db.collection('subs').where({
        openid: wxContext.OPENID,
        noticeId: String(x.id)
      }).get()
      const rec = {
        openid: wxContext.OPENID,
        noticeId: String(x.id),
        title: x.title || '',
        deadline: x.deadline || '',
        type: x.type || '',
        org: x.org || '',
        updatedAt: Date.now()
      }
      if (exist.data && exist.data.length) {
        await db.collection('subs').doc(exist.data[0]._id).update({ data: rec })
      } else {
        await db.collection('subs').add({ data: rec })
        upsert++
      }
    }
    // 取消收藏：按 removeIds 精确删除该用户的云端记录（不依赖前端传全量，避免误删）
    let removed = 0
    for (let k = 0; k < removeIds.length; k++) {
      const ex = await db.collection('subs').where({ openid: wxContext.OPENID, noticeId: removeIds[k] }).get()
      const rs = ex.data || []
      for (let r = 0; r < rs.length; r++) {
        await db.collection('subs').doc(rs[r]._id).remove()
        removed++
      }
    }
    return { ok: true, upsert: upsert, removed: removed }
  }

  // ---------- 定时推送：每天 08:00 给收藏临近截止的用户发订阅消息 ----------
  const subs = await db.collection('subs').limit(1000).get()
  const rows = (subs.data || [])
  if (!rows.length) return { sent: 0, note: 'no subs' }

  const now = new Date()
  const start = now.getTime()
  const end = start + 3 * 24 * 3600 * 1000
  let sent = 0
  const perOpenid = {}
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i]
    if (!s.openid) continue
    const dl = s.deadline ? new Date(s.deadline.replace(/-/g, '/')).getTime() : 0
    if (!dl || dl < start || dl > end) continue
    const days = Math.ceil((dl - start) / (24 * 3600 * 1000))
    ;(perOpenid[s.openid] = perOpenid[s.openid] || []).push({
      title: s.title, days: days, dlText: s.deadline
    })
  }

  if (!TMPL_ID) return { sent: 0, note: 'TMPL_ID empty, skipped send', targets: Object.keys(perOpenid).length }

  for (const openid in perOpenid) {
    const items = perOpenid[openid]
    for (let j = 0; j < items.length; j++) {
      const it = items[j]
      try {
        await cloud.openapi.subscribeMessage.send({
          touser: openid,
          templateId: TMPL_ID,
          page: 'pages/index/index',
          data: {
            thing1: { value: it.title.slice(0, 20) },
            time2: { value: it.dlText },
            thing3: { value: (it.days <= 0 ? '今天' : it.days + '天后') + '截止' }
          }
        })
        sent++
      } catch (e) { /* 用户未授权/已失效，跳过 */ }
    }
  }
  await db.collection('crawl_logs').add({ data: { at: Date.now(), type: 'notify', summary: { sent: sent } } })
  return { sent: sent }
}
