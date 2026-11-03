// utils/config.js
// 上线前必须改这里：填上你的云开发环境 ID。

module.exports = {
  // 云开发环境 ID，在「微信开发者工具 → 云开发 → 设置 → 环境ID」里复制
  // 例：'prod-8g2abcde12345678'
  cloudEnv: '',

  // 关掉这个开关就完全回到本地演示数据（离线可用，方便调样式）
  enableCloud: true,

  // ───────── GitHub Pages 远程数据源 ─────────
  // 小程序用 wx.request 直连这个域名拿数据，不需要云开发、不需要服务器。
  // 前提：把域名（只填域名，不带路径）加到
  //   公众平台 → 开发管理 → 开发设置 → 服务器域名 → request 合法域名
  // 下面所有地址必须是同一个域名，后台配一条就够。
  enableRemote: true,

  // 依次尝试，第一个成功的就用。同一域名下多个路径 → 后台只配一条域名。
  // 第 1 条：icat-radar 仓库已经在跑 Pages，把 docs/data/notices.json 拖到它的
  //         data/ 目录下即可立刻生效（不用新建仓库、不用配 Pages）。
  // 第 2 条：青椒自己的专用仓库，等仓库建好、Pages 开好之后把它挪到第一位。
  remoteUrls: [
    'https://jason07didi.github.io/icat-radar/data/notices.json',
    'https://jason07didi.github.io/qingjiao-calendar/data/notices.json'
  ],

  // 远程数据自己的有效期：比云端缓存短，这样每天打开都能看到新内容。
  // 下拉刷新会强制重拉，不受这个限制。
  remoteTTL: 30 * 60 * 1000,

  // 单次请求超时（毫秒）。网络差就快速失败，退回缓存或包内数据，不让用户干等。
  remoteTimeout: 10000,

  // 订阅消息模板 ID，与 cloudfunctions/notify/index.js 里的 TEMPLATE_ID 保持一致
  // 为空时点「提醒我」只做本地收藏，不弹授权
  subscribeTmplId: '',

  // 列表缓存有效期（毫秒）。云端每 6 小时抓一次（00:00 / 06:00 / 12:00 / 18:00），
  // 前端缓存与它对齐即可，拉得更勤既费流量也让列表在用户眼前反复重排。
  // 用户下拉刷新可强制更新，不受这个限制。
  cacheTTL: 6 * 60 * 60 * 1000,

  // 单次最多拉多少条
  maxItems: 100,

  // 云数据库单次查询上限（客户端 SDK 限制 20 条）
  pageSize: 20
}
