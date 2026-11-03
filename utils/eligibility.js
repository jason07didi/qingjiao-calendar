// utils/eligibility.js
// 从申报条件文本里解析「年龄上限」和「职称门槛」。
// 解析不出来返回 null（= 不限），绝不过度过滤。

const TIER = {
  '': 0,
  '助教': 1,
  '讲师': 2,
  '副教授': 3,
  '教授': 4
}

const TIER_TEXT = {
  1: '初级及以上',
  2: '中级及以上',
  3: '副高及以上',
  4: '正高级'
}

function parse (notice) {
  const conds = (notice && notice.conditions) || []
  let maxAge = null
  let minTier = null

  const ageLines = []
  conds.forEach(function (c) {
    if (/周岁|岁以[下内]/.test(c)) ageLines.push(c)
  })

  if (ageLines.length) {
    // 青年项目的年龄限制只在「没有其他年龄条款」时使用，
    // 避免「负责人不超过 57 岁，青年不超过 35 岁」把全体教师都过滤掉
    const general = ageLines.filter(function (l) { return l.indexOf('青年') === -1 })
    const use = general.length ? general : ageLines
    let m = null
    use.forEach(function (l) {
      const re = /(\d{2})\s*周?岁/g
      while ((m = re.exec(l)) !== null) {
        const v = parseInt(m[1], 10)
        if (v >= 20 && v <= 70) {
          // 多个数取最大（男性 35 / 女性 40 的写法对 38 岁女性不能误杀）
          maxAge = maxAge === null ? v : Math.max(maxAge, v)
        }
      }
    })
  }

  const text = conds.join(' ')
  if (/正高级|正高(职称)?/.test(text)) {
    minTier = 4
  } else if (/副高|高级(专业技术)?(职称|职务)/.test(text)) {
    minTier = 3
  } else if (/中级(以上|及以上)|中级职称/.test(text)) {
    minTier = 2
  } else if (/初级职称|助教/.test(text)) {
    minTier = 1
  }

  return {
    maxAge: maxAge,
    minTier: minTier,
    ageText: maxAge ? maxAge + ' 周岁以下' : '',
    tierText: minTier ? (TIER_TEXT[minTier] || '') : ''
  }
}

module.exports = {
  TIER: TIER,
  parse: parse
}
