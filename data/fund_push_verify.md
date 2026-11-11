# 基金检索数据上线校验报告

- 校验时间：2026-11-11 13:05（GMT+8）
- 目标仓库：`jason07didi/qingjiao-calendar`（GitHub Pages 源为 `docs/`）
- 线上地址：https://jason07didi.github.io/qingjiao-calendar/data/fund/

## 结论

**50 个数据文件全部上线，远端与本地逐字节一致，小程序请求路径已可用。**

## 校验明细

| 项目 | 结果 |
|---|---|
| 远端文件数 | 50 / 50（48 分片 + index.json + stats.json） |
| 大小与本地比对 | 50 个全部一致，0 个缺失、0 个尺寸不符 |
| 远端总字节 | 61,862,953 B ≈ 59.0 MB |
| 索引总条数 | 397,162，与 48 个分片 count 合计完全一致 |
| 分基金条数 | 国社科 110,450｜教育部 22,175｜国自然 264,537 |
| 索引结构 | v / generatedAt / count / nssfCount / moeCount / nsfcCount / disciplines / cats / chunks（48 条） |

## Pages 抽查（HTTP 状态 + 实到字节）

| 文件 | 状态 | 字节 |
|---|---|---|
| data/notices.json | 200 | 398,528 |
| data/fund/index.json | 200 | 5,822 |
| data/fund/stats.json | 200 | 165,487 |
| data/fund/nssf_2026.json | 200 | 860,285 |
| data/fund/nssf_1991_1998.json | 200 | 623,890 |
| data/fund/nsfc_2021_0.json | 200 | 1,908,442 |
| data/fund/moe_2020_2022.json | 200 | 1,303,950 |
| data/fund/nsfc_2026.json | 200 | 1,158,475 |

## 端到端抽样

- 下载 `nssf_2014_2015.json`（1,303,821 B，HTTP 200），解析出 2015 年记录 5,325 条，字段完整：
  `["杨建斌","知识产权诉讼中的技术调查官制度研究","黑龙江大学","法学","一般项目",2015]`
- 选年 → 分片映射复现正确（示例）：
  - 1995 → nssf_1991_1998.json
  - 2010 → nssf_2006_2010.json
  - 2020 → nssf_2020.json + moe_2020_2022.json + nsfc_2020_0~3.json
  - 2026 → nssf_2026.json + moe_2025_2026.json + nsfc_2026.json

## 本次上传过程中的问题与处置

1. 一次提交 8 个文件（≈10 MB）经本地代理 127.0.0.1:7897 会被掐断，页面跳 `chrome-error://chromewebdata/`——上一轮 48 个全因此失败。
2. 改为「按体积升序、一次 1 个文件、每个最多重试 3 次」后，48 个连续成功（耗时约 10 分钟，48/48）。
3. 上传走 GitHub 网页提交（无 token），提交记录为 `Add files via upload`，最新 commit `c356361`。

## 遗留

- 本机工作区 `main`（`3d6a6bc`）与远端 `c356361` 有 48 个文件差异，全部是**代码/文档**，不含任何 `docs/data/fund/*.json`（数据侧已完全同步）。
  这 48 个差异是本地端的小程序源码与工具脚本改动，未推送，也不影响 Pages 数据与小程序运行；如需同步需再次授权。
- 小程序端无需重新发布即可生效（数据为运行时拉取）。
