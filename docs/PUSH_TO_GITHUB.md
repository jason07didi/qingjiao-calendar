# 推到 GitHub 并启用每日自动抓取

## 一、创建远程仓库

在 GitHub 上新建仓库，建议：

- 仓库名：`qingjiao-calendar`（或 `jason-v1.1`）
- 可见性：**Private 或 Public 都行**（Public 的 Actions 分钟数不限额）
- **不要**勾选 "Add a README / .gitignore / license"（本地已有，会冲突）

## 二、推送本地代码

本地仓库已经初始化并提交好了（`main` 分支，2 个提交）。执行：

```bash
git remote add origin https://github.com/jason07didi/qingjiao-calendar.git
git push -u origin main
```

⚠️ 如果要推送 `.github/workflows/` 里的工作流文件，**token 必须带 `workflow` 权限**，
否则会报 "refusing to allow a Personal Access Token to create or update workflow"。

生成 token：<https://github.com/settings/tokens/new>
→ 勾选 **`repo`** 和 **`workflow`** → 有效期建议 30 天 → 生成后复制。

## 三、启用每日抓取（自动）

推上去后什么都不用做。`.github/workflows/daily-update.yml` 会：

- **每 4 小时**自动运行（cron `17 */4 * * *` UTC → 北京 00:17 / 04:17 / 08:17 / 12:17 / 16:17 / 20:17）。错开整点是为了避开 GitHub 定时任务的排队高峰（实测整点任务可延迟 3 小时以上）
- 抓 8 个官方源的列表页
- 生成 `utils/data_crawl.js`（最多 60 条）
- 提交回仓库
- 若配置了上传密钥，自动上传体验版

也可以在仓库 **Actions** 页面点「Run workflow」手动跑一次验证。

## 四、配置自动上传小程序（可选）

1. 微信公众平台 → 开发管理 → 开发设置 → **小程序代码上传** → 生成密钥并下载
   （文件名形如 `private.wxb0b73a71fced2201.key`，**只能下载一次**）
2. GitHub 仓库 → Settings → Secrets and variables → Actions → New repository secret
   - Name: `MP_UPLOAD_KEY`
   - Secret: 把 `.key` 文件的**全部内容**粘进去
3. 注意：生成密钥时要关闭「IP 白名单」，因为 GitHub Actions 的出口 IP 不固定

配好后，每天自动：抓数据 → 生成包内数据 → 上传体验版。
你只需要去公众平台 **版本管理 → 提交审核**。

## 五、本地手动跑一遍

```bash
npm install                     # 只为 miniprogram-ci，可选
node tools/local_spider.js      # 抓取
node tools/build_pack.js        # 生成 utils/data_crawl.js
npm run upload                  # 需要先 set MP_UPLOAD_KEY
```

## 常见问题

**Q：为什么不直接让小程序请求 GitHub 的数据？**
正式版 `wx.request` 只能请求白名单内且 ICP 备案的域名，`github.io` /
`raw.githubusercontent.com` 都不在其中。所以改成"数据打进包"。

**Q：这样算实时吗？**
不算秒级。每天产生一个新版本，走审核 + 用户冷启动才更新，实际延迟 1–3 天。
对"截止日"这种信息足够——真正的风险是"通知发布了三周你却不知道"，不是"晚了两小时"。

**Q：抓到的条目为什么没有截止日？**
列表页上那个日期是**通知发布日**。截止日必须打开原文核实，核实不到就留空，
卡片会落在首页「日期待定」段。**绝不编造日期。**
