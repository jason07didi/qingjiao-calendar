// utils/filter.js
// 首页与日历共用的「按我的筛选条件过滤」逻辑。
// 规则与 pages/index/index.js 的 applyFilter 保持一致，单一来源，避免两边漂移：
//   - 省份(scope)：国家级永远保留、开放申请类(openApply)保留、勾选省份保留，其余按省份隐藏
//   - 学科(discipline)：未勾学科不受限；勾了学科则必须命中，但开放类与职业全周期类
//     (postdoc/visit/review/student) 豁免，按「宁可多看到」原则保留

const EXEMPT = /^(?:postdoc|visit|review|student|growth)$/

// 省份可见性（scope）。返回 true = 保留。
function keepByRegion (n, prefs) {
  const mineProv = prefs.provinces || []
  if (!mineProv.length) return true
  if (n.openApply) return true
  if (n.region === '国家') return true
  return mineProv.indexOf(n.region) > -1
}

// 学科可见性。返回 true = 保留。
// 注意：首页 build() 出来的卡片用 disAll 字段，日历页原始条目用 disciplines 字段，
// 这里两个都兼容，保证共享函数对两个页面都正确。
// disciplines 为空 = 跨学科/通用条目（如泛研网聚合源），按「宁可多看到」放行。
function keepByDiscipline (n, prefs) {
  const mineDis = prefs.disciplines || []
  if (!mineDis.length) return true
  if (n.openApply) return true
  if (EXEMPT.test(n.type)) return true
  const dis = n.disciplines || n.disAll || []
  if (!dis.length) return true
  for (let i = 0; i < mineDis.length; i++) {
    if (dis.indexOf(mineDis[i]) > -1) return true
  }
  return false
}

// 同时满足省份 + 学科（日历页用它一次性过滤整份数据）。
function keepByPrefs (n, prefs) {
  return keepByRegion(n, prefs) && keepByDiscipline(n, prefs)
}

module.exports = {
  keepByRegion: keepByRegion,
  keepByDiscipline: keepByDiscipline,
  keepByPrefs: keepByPrefs
}
