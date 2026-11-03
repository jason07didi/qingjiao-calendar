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
tools/build_pack.js     去重、过滤、生成小程序包内数据
   ↓
utils/data_crawl.js     小程序 require 的静态数据（不需要域名、不需要云开发、零费用）
   ↓
miniprogram-ci          自动上传体验版（可选，需配置上传密钥）
```

### 为什么不用接口直连

小程序正式版的 `wx.request` 只能请求**白名单内且已 ICP 备案**的域名，
GitHub Pages / raw.githubusercontent.com 都不在其中。
所以这里不玩"实时拉取"，改成**数据打进包**：Actions 每天生成 `utils/data_crawl.js`，
随版本一起上传。代价是更新要过一次审核，好处是**完全免费、无域名、无云开发**。

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
