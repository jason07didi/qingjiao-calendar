#!/usr/bin/env node
/**
 * scripts/push_to_cloud.js
 *
 * 把抓取到的条目写进微信云开发数据库（notices 集合），让小程序运行时直接读到新数据，
 * 不需要重新上传小程序版本。
 *
 * 用法：
 *   node scripts/push_to_cloud.js          只同步自动抓取的条目（source=crawl / auto=true）
 *   node scripts/push_to_cloud.js --all    连同人工整理的条目一起写（首次导入用）
 *
 * 需要的环境变量（GitHub Actions 里放 Secrets）：
 *   TCB_ENV        云开发环境 ID，形如 prod-8g2abcde12345678
 *   TCB_SECRET_ID  腾讯云 API 密钥 SecretId
 *   TCB_SECRET_KEY 腾讯云 API 密钥 SecretKey
 *
 * 三个变量缺任意一个 → 安静跳过（exit 0），不阻断工作流。
 */

const notices = require('../utils/notices.js')

const COLL = 'notices'
const WRITE_ALL = process.argv.indexOf('--all') > -1

const ENV = process.env.TCB_ENV
const SID = process.env.TCB_SECRET_ID
const SKEY = process.env.TCB_SECRET_KEY

function skip (msg) {
  console.log('[push_to_cloud] ' + msg)
  console.log('[push_to_cloud] 本次跳过云数据库同步（小程序仍可正常打包）')
  process.exit(0)
}

if (!ENV || !SID || !SKEY) {
  skip('缺少 TCB_ENV / TCB_SECRET_ID / TCB_SECRET_KEY')
}

let cloudbase
try {
  cloudbase = require('@cloudbase/node-sdk')
} catch (e) {
  skip('未安装 @cloudbase/node-sdk（npm install 后重试）')
}

const app = cloudbase.init({
  env: ENV,
  secretId: SID,
  secretKey: SKEY
})
const db = app.database()

// 资料库里的字段 → 云数据库字段
// 注意：status 必须是 'curated' 或 'raw'，utils/api.js:131 的 where 条件依赖它
function toDoc (n) {
  const isCrawl = !!(n.auto || n.source === 'crawl')
  return {
    type: n.type || 'project',
    title: n.title || '',
    org: n.org || '',
    region: n.region || '',
    level: n.level || '',
    rank: n.rank || null,
    disciplines: n.disciplines || [],
    startAt: n.startAt || '',
    deadline: n.deadline || '',
    deadlineText: n.deadlineText || '',
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
    publishedAt: n.publishedAt || '',
    source: n.source || (isCrawl ? 'crawl' : 'curated'),
    status: isCrawl ? 'raw' : 'curated',
    syncedAt: Date.now()
  }
}

// _id 稳定化：沿用本地 id，保证重复同步是覆盖而不是插入新行。
// 小程序端 utils/api.js 会把 _id 映射成 'c_' + _id。
function docId (n) {
  return 'jq_' + String(n.id)
}

async function main () {
  const all = notices.getAll()
  const targets = WRITE_ALL ? all : all.filter(function (n) { return n.auto || n.source === 'crawl' })

  console.log('[push_to_cloud] 环境: ' + ENV)
  console.log('[push_to_cloud] 全库 ' + all.length + ' 条，本次同步 ' + targets.length + ' 条' + (WRITE_ALL ? '（含人工整理）' : '（仅自动抓取）'))

  let ok = 0
  let fail = 0
  const errs = []

  for (let i = 0; i < targets.length; i++) {
    const n = targets[i]
    const id = docId(n)
    try {
      await db.collection(COLL).doc(id).set(toDoc(n))
      ok++
      if (ok % 20 === 0) console.log('[push_to_cloud] 已写入 ' + ok + '/' + targets.length)
    } catch (e) {
      fail++
      if (errs.length < 5) errs.push(id + ' → ' + (e && e.message ? e.message : String(e)))
    }
  }

  console.log('[push_to_cloud] 完成：成功 ' + ok + '，失败 ' + fail)
  if (errs.length) {
    console.log('[push_to_cloud] 失败样例：')
    errs.forEach(function (e) { console.log('  · ' + e) })
  }

  // 全部失败 → 让工作流报错，别静默当作成功
  if (ok === 0 && fail > 0) {
    console.error('[push_to_cloud] 一条都没写成功，检查 TCB 环境/密钥/集合通知权限')
    process.exit(1)
  }
}

main().catch(function (e) {
  console.error('[push_to_cloud] 异常：' + (e && e.stack ? e.stack : e))
  process.exit(1)
})
