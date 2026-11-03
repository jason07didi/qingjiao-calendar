# 小程序读 GitHub Pages 数据（动态更新方案）

> 目标：每天抓到的新通知，不用重新上传小程序版本、不用等审核，用户打开就能看到。

---

## 一句话原理

```
GitHub Actions 每天 07:30 抓官方通知
        ↓ 生成 docs/data/notices.json 并提交
GitHub Pages 把它发布成一个静态地址
        ↓
小程序 wx.request 直连这个地址（域名已进 request 合法域名）
        ↓
用户手机上就是最新数据
```

---

## 三个必须成立的条件

| # | 条件 | 在哪配 |
|---|---|---|
| 1 | 域名进 request 合法域名 | 公众平台 → 开发管理 → 开发设置 → 服务器域名 |
| 2 | Pages 把 `/docs` 目录发布出去 | 仓库 Settings → Pages → Source = Deploy from a branch，分支 `main`，目录 `/docs` |
| 3 | 数据文件真实存在且格式对 | `docs/data/notices.json`，由 `tools/build_remote.js` 生成 |

三者缺一，小程序会静默降级到包内数据 —— **不会白屏、不会报错弹窗**。

---

## 域名怎么填

**只填域名，不带路径、不带协议头之外的东西：**

```
jason07didi.github.io
```

后台填完还要确认它出现在列表里。如果保存时报「域名未备案 / 无法添加」，说明这条通道在你这儿走不通，直接改走云开发（见 `CLOUD_SETUP.md`），代码里 `enableRemote: false` 一行关掉即可。

---

## 数据地址

```
https://jason07didi.github.io/qingjiao-calendar/data/notices.json
```

`utils/config.js` 里按顺序尝试，第一条不通就试第二条：

```js
remoteUrls: [
  'https://jason07didi.github.io/qingjiao-calendar/data/notices.json',
  'https://jason07didi.github.io/icat-radar/data/notices.json'
]
```

> 第一条是青椒的日历专用仓库（main 分支 /docs 目录），每天 07:30 自动更新。
> 第二条仅作备份：icat-radar 也在跑 Pages，万一专用仓库异常可临时顶上。

---

## 文件格式

```json
{
  "v": 1,
  "updatedAt": "2026-11-03",
  "generatedAt": "2026-11-03T22:30:11+08:00",
  "count": 305,
  "datedCount": 18,
  "autoCount": 60,
  "items": [ { "id": "r7", "type": "project", "title": "...", "deadline": "", ... } ]
}
```

- `updatedAt`：数据整理日，首页「更新于」直接显示它 —— 所以**日期每天在变，用户看得见**
- `items[].id`：与包内数据同一套编号（`r7` / `auto_xxx`），**切数据源不会丢收藏**
- `deadline` 为空表示「日期待定」，落在首页待定段，绝不编造（截止日铁律）

---

## 前端行为

| 情况 | 表现 |
|---|---|
| 拉取成功 | 首页右上显示「数据已同步 · 更新于 11-03」 |
| 拉取失败（域名被拦/断网/404） | 静默用包内 305 条，显示「本地数据」 |
| 30 分钟内再打开 | 直接用本地缓存，不发请求（省流量） |
| 下拉刷新 | 强制重拉，不受 30 分钟限制 |
| 远程少了某条 | 用包内数据补齐，用户不会突然看不到（宁可多看到） |

缓存 30 分钟（`remoteTTL`），一次请求实际传输约 78 KB（Pages 自动 gzip，388 KB → 78 KB）。

---

## 每天自动更新怎么跑

`.github/workflows/daily-update.yml`：

```
node tools/local_spider.js   抓 8 个官方源
node tools/build_pack.js     生成包内数据 utils/data_crawl.js
node tools/build_remote.js   生成远程数据 docs/data/notices.json   ← 新增
git commit + push            提交两个文件
```

Pages 监测到 `main` 分支变化会自动重新发布，几分钟后线上 JSON 就变成新的。

**要手动跑一次**：仓库 → Actions → 每日抓取科研通知 → Run workflow。

---

## 三步验证

**第 1 步：文件在不在**
浏览器直接打开数据地址，能看到一大段 JSON、且 `"updatedAt"` 是今天 → 通过。

**第 2 步：小程序能不能连**
开发者工具打开 `F:\微信开发平台\net-verify`，点测试 → 该域名这一行是绿的 → 通过。
（关掉「不校验合法域名」再测一次，还绿才是真的通。）

**第 3 步：小程序读到了没**
打开青椒的日历，首页标题下应显示「数据已同步 · 更新于 X月X日」。
显示「本地数据 · 未连接云端」→ 降级了，看下面的排错表。

---

## 排错表

| 现象 | 原因 | 解决 |
|---|---|---|
| 一直显示「本地数据」 | 域名没进白名单 | 后台加 `jason07didi.github.io`，注意不带 `https://` |
| 报 `url not in domain list` | 域名进白名单但没生效 | 杀微信进程重进；开发者工具「清除全部缓存」再编译，最多等 30 分钟 |
| 打开地址是 404 | Pages 源没设成 `/docs`，或文件没提交 | Settings → Pages 检查；确认仓库里有 `docs/data/notices.json` |
| 打开是 HTML 不是 JSON | 路径错了，命中了 404 页面 | 代码会自动识别并降级，改对路径即可 |
| 显示「更新于」但日期不前进 | Actions 每天在跑但没提交成功 | 看 Actions 日志；可能是 `contents: write` 权限被关 |
| 数据变少了几条 | 抓取源当天没更新 | 前端会用包内数据补齐，属正常 |

---

## 代价

- GitHub Actions 公开仓库：免费
- GitHub Pages：免费
- 域名备案：不需要（前提是后台真的放行了 `github.io`，见上面「域名怎么填」）
- 唯一成本：每天一次请求，约 78 KB/用户/30 分钟

> 如果哪天微信收紧对 `github.io` 的放行，代码里把 `enableRemote` 改成 `false`，
> 立刻回到包内数据模式，不影响已上线的版本。这是我把它做成「静默降级」的原因。
