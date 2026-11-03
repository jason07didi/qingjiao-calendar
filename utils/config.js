// utils/config.js
// 上线前必须改这里：填上你的云开发环境 ID。

module.exports = {
  // 云开发环境 ID，在「微信开发者工具 → 云开发 → 设置 → 环境ID」里复制
  // 例：'prod-8g2abcde12345678'
  cloudEnv: '',

  // 关掉这个开关就完全回到本地演示数据（离线可用，方便调样式）
  enableCloud: true,

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
