// tools/probe_labs.js
// 实测「开放基金 / 厅局」相关机构域名能不能打开。
// 规矩：只接实测 200 的域名，绝不编路径。输出 tools/_probe_labs.txt。
const fs = require('fs')
const OUT = __dirname + '/_probe_labs.txt'
const lines = []

const TARGETS = [
  ['华南理工大学（亚热带建筑科学国家重点实验室）', 'https://www.scut.edu.cn'],
  ['西安建筑科技大学（西部绿色建筑国家重点实验室）', 'https://www.xauat.edu.cn'],
  ['重庆大学（山地城镇建设与新技术教育部重点实验室）', 'https://www.cqu.edu.cn'],
  ['中科院生态环境研究中心（城市与区域生态国家重点实验室）', 'http://www.rcees.ac.cn'],
  ['北京城市气象研究院（城市气象重点开放实验室）', 'https://www.ium.cn'],
  ['中国建筑科学研究院（建筑安全与环境国家重点实验室）', 'https://www.cabr.com.cn'],
  ['陕西省文化和旅游厅', 'https://whhlyt.shaanxi.gov.cn'],
  ['陕西省气象局', 'http://sn.cma.gov.cn'],
  ['西安市科技局', 'http://xakj.xa.gov.cn'],
  ['西安市社会科学院', 'http://www.xass.gov.cn'],
  ['咸阳市科技局', 'http://kjj.xianyang.gov.cn'],
  ['宝鸡市科技局', 'http://kjj.baoji.gov.cn']
]

function withTimeout (p, ms) {
  return Promise.race([
    p,
    new Promise(function (_, rej) { setTimeout(function () { rej(new Error('timeout')) }, ms) })
  ])
}

async function probe (name, home) {
  let res = ''
  try {
    const r = await withTimeout(fetch(home, {
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0' }
    }), 15000)
    const code = r.status
    const buf = Buffer.from(await r.arrayBuffer())
    res = 'HTTP ' + code + ' | ' + Math.round(buf.length / 1024) + ' KB'
    if (code >= 400) res += ' ⚠'
  } catch (e) {
    res = 'FAIL ' + (e && e.message ? e.message : e)
  }
  lines.push([res, name, home].join('  |  '))
}

;(async function () {
  for (let i = 0; i < TARGETS.length; i++) {
    await probe(TARGETS[i][0], TARGETS[i][1])
  }
  fs.writeFileSync(OUT, lines.join('\n') + '\n')
  console.log('done ' + lines.length)
})()
