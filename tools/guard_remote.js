// 质量守卫：防止 GitHub Actions（境外 IP）抓取失败导致数据回退
//
// 背景：runner 在境外，对多数 .gov.cn 站点不通或被限流。
// 若本次自动条目数明显少于上一次已提交的，就不提交，保留上一版数据。
//
// 退出码恒为 0（不阻断工作流），只在 stdout 说明结果。

const fs = require('fs')
const { execSync } = require('child_process')

// git 可能不在 PATH 里（本机实测），按顺序找一个能用的
const GIT_CANDIDATES = [
  '',
  'C:/Users/Administrator/.workbuddy/binaries/PortableGit/versions/1.2.0/cmd/git.exe',
  'C:/Program Files/Git/cmd/git.exe'
]
function gitCmd (args) {
  let last = ''
  for (let i = 0; i < GIT_CANDIDATES.length; i++) {
    const g = GIT_CANDIDATES[i] ? '"' + GIT_CANDIDATES[i] + '"' : 'git'
    try {
      const o = execSync(g + ' ' + args, { encoding: 'utf8', stdio: 'pipe', maxBuffer: 40 * 1024 * 1024 })
      return { ok: true, out: o }
    } catch (e) {
      // 命令不存在时 Windows 中文环境报的是 GBK 文案、status 也可能是 1，
      // 所以不做文案判断，一律换下一个候选（踩过）。
      last = ((e.stdout || '') + (e.stderr || '')).trim() || String(e.message)
    }
  }
  return { ok: false, out: last }
}

const FILE = 'docs/data/notices.json'
const RATIO = 0.7        // 低于上次的 70% 视为退化
const MIN_ABS = 20       // 上次自动条目至少 20 条才启用比较

function readJSON (text) {
  try { return JSON.parse(text) } catch (e) { return null }
}

let now = null
try { now = readJSON(fs.readFileSync(FILE, 'utf8')) } catch (e) {}

if (!now) {
  console.log('守卫：本次没有生成 ' + FILE + '，跳过检查')
  process.exit(0)
}

const nowAuto = Number(now.autoCount || (now.items || []).filter(x => x.auto).length || 0)
const nowAll = Number(now.count || (now.items || []).length || 0)

let prev = null
const prevRes = gitCmd('show HEAD:' + FILE)
if (prevRes.ok) prev = readJSON(prevRes.out)
else console.log('守卫：没有上一版可比（首次运行），放行')

if (!prev) {
  console.log('守卫：上次无数据，本次自动 ' + nowAuto + ' / 共 ' + nowAll + ' 条，放行')
  process.exit(0)
}

const prevAuto = Number(prev.autoCount || (prev.items || []).filter(x => x.auto).length || 0)
console.log('守卫：上次自动 ' + prevAuto + ' 条 → 本次自动 ' + nowAuto + ' 条（总数 ' + nowAll + '）')

if (prevAuto >= MIN_ABS && nowAuto < prevAuto * RATIO) {
  console.log('守卫：抓取量退化（低于上次 ' + Math.round(RATIO * 100) + '%），丢弃本次数据，保留上一版')
  try {
    const r = gitCmd('checkout -- ' + FILE)
    console.log(r.ok ? '守卫：已恢复 ' + FILE + ' 到上一版' : '守卫：恢复失败 ' + r.out)
  } catch (e) {
    console.log('守卫：恢复失败 ' + e.message)
  }
  const out = process.env.GITHUB_OUTPUT
  if (out) {
    try { fs.appendFileSync(out, 'degraded=true\n') } catch (e) {}
  }
} else {
  console.log('守卫：正常，放行')
  const out = process.env.GITHUB_OUTPUT
  if (out) {
    try { fs.appendFileSync(out, 'degraded=false\n') } catch (e) {}
  }
}
