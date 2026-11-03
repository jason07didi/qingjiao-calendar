# 青椒的日历

面向高校青年教师（讲师 / 副高 / 博士）的**科研申报截止日清单**小程序。
把散落在各部委、省厅、学会、期刊的申报通知，收敛成一张按紧急度排序的截止日表。

- 小程序 AppID：`wxb0b73a71fced2201`
- 基础库：`3.17.3`
- 类目：教育 - 教育信息服务

## 这个仓库是什么

除了小程序源码，它还包含一套**每天自动跑的数据管道**：

```
GitHub Actions（每天 07:30 北京时间）
   ↓
tools/local_spider.js   抓 8 个官方源的列表页
   ↓                    （自然资源部 / 住建部 / 科技部 / 生态环境部 / 中国科协 / 陕西省科技厅 / 陕西省自然资源厅）
tools/build_pack.js     去重、过滤 → 包内数据 utils/data_crawl.js
tools/build_remote.js   导出 → docs/data/notices.json（GitHub Pages 发布）
   ↓
小程序 wx.request 直连 Pages 上的 JSON → 每天自动更新，不用发版、不用审核
   ↓
miniprogram-ci          自动上传体验版（可选，需配置上传密钥）
```

### 数据怎么到用户手机上

**主路径 —— GitHub Pages 静态 JSON。** 把 `jason07didi.github.io` 加进
「开发管理 → 开发设置 → 服务器域名 → request 合法域名」，小程序就能直连
`https://jason07didi.github.io/qingjiao-calendar/data/notices.json`。
Actions 每天重新生成这个文件，Pages 自动发布，用户下次打开就是新数据。
详见 `docs/REMOTE_DATA.md`。

数据仓库：<https://github.com/jason07didi/qingjiao-calendar>（Pages 源 = `main` 分支 `/docs` 目录）

**兜底路径 —— 包内数据。** `utils/data_crawl.js` 随版本打包。远程拉不到
（域名被拦 / 断网 / 文件路径错）时**静默降级**到它，不会白屏、不弹错。

**可选 —— 云开发。** 填了 `cloudEnv` 就走云数据库，见 `docs/CLOUD_SETUP.md`。

### 截止日铁律

列表页上那个日期是**通知发布日**，不是**申报截止日**。
所以爬虫抓到的条目 `deadline` 一律留空，卡片落在首页「日期待定」段，
等人工核实原文后再补精确日期。**任何情况下都不编造截止日。**

## 目录

| 路径 | 说明 |
|---|---|
| `pages/` | 首页 / 日历 / 收藏 / 我的 / 详情 |
| `utils/` | `notices.js` 数据合并、`filter.js` 筛选共享逻辑、`rank.js` 档位、`official.js` 官方链接 |
| `utils/notices_extra.js` | 人工核实并补全的结构化条目（主干数据） |
| `utils/data_crawl.js` | **自动生成**，勿手改 |
| `tools/local_spider.js` | 本机/CI 爬虫入口 |
| `tools/build_pack.js` | 候选 → 包内数据 |
| `cloudfunctions/` | 云开发三件套（spider / notify / admin），未启用，留作后续 |
| `docs/` | 部署说明 |

## 本地跑一次数据管道

```bash
node tools/local_spider.js     # 抓取 → data/crawl_candidates.json + data/crawl_report.md
node tools/build_pack.js       # 生成 → utils/data_crawl.js
```

抓完打开 `data/crawl_report.md` 看候选清单，需要入库的条目再人工核实截止日后写进 `notices_extra.js`。

## 自动上传体验版（可选）

1. 微信公众平台 → 开发管理 → 开发设置 → **小程序代码上传** → 生成并下载密钥（`private.<appid>.key`）
2. 仓库 Settings → Secrets and variables → Actions → 新建 `MP_UPLOAD_KEY`，内容为密钥文件的**全文**
3. 推送代码后，Actions 每天会抓数据并自动上传一个新版本；到后台点「提交审核」

没有配置密钥时，Actions 只更新数据文件、不执行上传，不会报错。

## 备注

- 包体上限 2MB：`data/`、`tools/`、`docs/`、`cloudfunctions/` 已在 `project.config.json` 的 `packOptions.ignore` 中排除
- 不要提交 `*.key`、`node_modules`
