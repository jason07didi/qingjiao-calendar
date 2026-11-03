// utils/date.js

function pad (n) {
  return n < 10 ? '0' + n : '' + n
}

// 统一解析 YYYY-MM-DD，兼容 iOS
function parse (str) {
  if (!str) return null
  const p = String(str).split('-')
  if (p.length !== 3) return null
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10))
}

function today () {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function todayStr () {
  const d = today()
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

// 剩余天数：今天截止返回 0，已过期为负数
function daysLeft (deadline) {
  const t = parse(deadline)
  if (!t) return null
  return Math.round((t.getTime() - today().getTime()) / 86400000)
}

// 12-15 这种短格式
function shortDate (str) {
  if (!str) return ''
  const p = String(str).split('-')
  if (p.length !== 3) return str
  return parseInt(p[1], 10) + '月' + parseInt(p[2], 10) + '日'
}

function monthLabel (year, month) {
  return year + ' 年 ' + (month + 1) + ' 月'
}

// 时间戳 → 「11 月 1 日 00:00」。更新时间的展示一律精确到分钟，
// 只写日期会让用户以为「今天没更新」。
function stampLabel (ts) {
  if (!ts) return ''
  const d = new Date(Number(ts))
  if (isNaN(d.getTime())) return ''
  return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' +
    pad(d.getHours()) + ':' + pad(d.getMinutes())
}

// 生成月视图格子，周一为每周第一天
function monthGrid (year, month, dayMeta) {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  // getDay: 0=周日 -> 转成 0=周一
  let offset = first.getDay() - 1
  if (offset < 0) offset = 6

  const cells = []
  const prevMonthDays = new Date(year, month, 0).getDate()

  for (let i = offset - 1; i >= 0; i--) {
    cells.push({
      day: prevMonthDays - i,
      inMonth: false,
      dateStr: '',
      count: 0
    })
  }

  const tk = todayStr()
  for (let d = 1; d <= daysInMonth; d++) {
    const ds = year + '-' + pad(month + 1) + '-' + pad(d)
    const meta = (dayMeta && dayMeta[ds]) || { count: 0, level: '' }
    cells.push({
      day: d,
      inMonth: true,
      dateStr: ds,
      count: meta.count || 0,
      level: meta.level || '',
      isToday: ds === tk
    })
  }

  let next = 1
  while (cells.length % 7 !== 0 || cells.length < 35) {
    cells.push({
      day: next++,
      inMonth: false,
      dateStr: '',
      count: 0
    })
    if (cells.length >= 42) break
  }

  return cells
}

// 倒计时紧急度：urgent 3天内 / soon 7天内 / normal 30天内 / later
function level (days) {
  if (days === null) return 'later'
  if (days <= 3) return 'urgent'
  if (days <= 7) return 'soon'
  if (days <= 30) return 'normal'
  return 'later'
}

// 从「往年规律」文本提炼一句短节律提示，用于卡片展示待定条目的预估月份。
// 例：「每年 3 月发布、4 月截止」→「每年 3、4 月」；「每两年一届，双数年上半年」→「每两年 上半年」。
// 只提炼、不编造具体日期；提取不出时返回空串，由调用方回退到「无固定截止」。
function estHint (freq) {
  if (!freq) return ''
  const s = String(freq)
  let cycle = '每年 '
  const cm = s.match(/每\s*([一二两三四五12345])\s*年/)
  if (cm) cycle = '每' + cm[1] + '年 '
  else if (!/每年|一年一度|年度/.test(s)) cycle = ''

  const months = (s.match(/(\d{1,2})\s*月/g) || []).map(function (x) {
    return parseInt(x.replace(/\D/g, ''), 10)
  }).filter(function (m) { return m >= 1 && m <= 12 })
  const uniq = []
  months.forEach(function (m) { if (uniq.indexOf(m) === -1) uniq.push(m) })
  uniq.sort(function (a, b) { return a - b })

  if (uniq.length) {
    const parts = []
    let i = 0
    while (i < uniq.length) {
      let j = i
      while (j + 1 < uniq.length && uniq[j + 1] === uniq[j] + 1) j++
      parts.push(i === j ? (uniq[i] + '月') : (uniq[i] + '–' + uniq[j] + '月'))
      i = j + 1
    }
    return cycle + parts.join('、')
  }

  const qm = s.match(/([上下]半[年]|[一二三四]季度|季度交替)/)
  if (qm) return cycle + qm[1].replace('季度交替', '季度交替时')
  return ''
}

module.exports = {
  pad: pad,
  parse: parse,
  today: today,
  todayStr: todayStr,
  daysLeft: daysLeft,
  shortDate: shortDate,
  stampLabel: stampLabel,
  monthLabel: monthLabel,
  monthGrid: monthGrid,
  level: level,
  estHint: estHint
}
