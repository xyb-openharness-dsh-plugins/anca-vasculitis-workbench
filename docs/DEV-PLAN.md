# DEV-PLAN · 小脉宝 VasPal（ANCA 相关血管炎工作台）

> 本文件是里程碑与判据的**唯一来源**。汇报话术按 [prompts/PROGRESS-REPORT.md](../prompts/PROGRESS-REPORT.md)，本文件只回答"到哪一步、凭什么算过"。
> 状态口径：✅ 已完成（有证据）/ 🔧 进行中 / ⏳ 未开始 / — 不适用。
> 最后更新：2026-10-26（**G1 + G2 + G3 均已签认**；G4 数据维护更新闸口待 M5 执行；下一阶段 M4 临床库 / M5 开发版）。

## 一、里程碑与判据

| 里程碑 | 进入条件 | 通过判据（可验证） | 证据落点 | 状态 |
| --- | --- | --- | --- | --- |
| **M0 骨架** | Issue #44 认领 | 私有仓建立；`dsh-wb-cli init`；`cordis.patch.yml` 补 `config.root`；文档 9 件；`npm run check` 通过 | commit `4e45d54`；`npm run check` staticPass=true | ✅ 2026-10-25 |
| **M1 调研 + SPEC** | M0 通过 | 三路调研有产出：医学约束 10 主题、用户与照护者证据、家族对比实测；DIFF-MATRIX 一级重名率 ≤70%（实测数）；SPEC/SCENARIOS/PATIENT-FLOW/INTERACTION-DESIGN 全量；G1 决策点显式列出 | `research-notes/medical-constraints.md`、`research-notes/family-landscape.md`、`docs/USER-RESEARCH.md`、`docs/DIFF-MATRIX.md`、`docs/SPEC.md`、`docs/SCENARIOS.md`、`docs/PATIENT-FLOW.md`、`docs/INTERACTION-DESIGN.md` | ✅ 2026-10-26（G1 签认） |
| **M2 原型** | **G1 签认** | demo 构建器 + `prototypes/v0.2/` 四件套；窄宽规则（30 号）从第一版执行；HVT X1–X4 走查；独立评审 P0 修复留痕 | `prototypes/v0.2/` v0.2.2（10 线/32 页/7 路径 + 状态卡 + 36 号 v2）+ 探针 router/primer P1–P9 全过 + `docs/DESIGN-REVIEW.md`（P0=0，P1×12 已修） | ✅ 2026-10-26（G2 签认） |
| **M3 数据模型** | **G2 签认** | `schema/0001_initial.sql` 冻结 + sha256；判读列断言 + 写映射逐列一致（check-write-schema W2–W6）；`freeze-contract.md` | `schema/0001_initial.sql`（**16 表已冻结**）、`dsh/write-schema.js`、`dsh/store.js`（SQLite 主力+文件回退）、`docs/SCHEMA.md` | ✅ 2026-10-26（G3 签认，冻结生效） |
| **M4 临床库** | M3 通过 | `research/anca-vasculitis/` 四件套（manifest=jsonl=sqlite）+ 一致性断言；unified-trial-mcp 在线通道；FAILED/DENIED/NEEDS_SETUP/NO_RESULTS 如实记录、不计覆盖 | `research/anca-vasculitis/`（1 条，标待复核）+ `scripts/fetch-anca-trials-2026.mjs` + `test/trials-pack.test.mjs`（7 断言）+ `dsh/trials.js`（35 号三态读模型）+ `GET /trials`·`/trials/snapshot` | ✅ 2026-10-27（首轮；中文通道全 FAILED，待重试） |
| **M5 开发版** | M2/M3/M4 就绪 | 七步移植（含 MinerU 六部件）；`npm run check` 全绿；`npm run audit` 无 fail；**G4 通过** | `dsh/`（index/routes/server/store/write-schema/readmodels/demo/trials/mineru/settings/ancaparse/parse）+ `lib/`（client/layout/version/zip）+ `public/` + `test/` 57 用例 + `scripts/serve-dev.mjs` | ✅ 2026-10-27（audit 33/33；G4 七项通过；**MinerU 六部件完成**） |
| **M6 装机** | V1 + **G4 通过** | 改包必升版 → `npm pack` → tgz 四要素对照 → profile 安装 → 宿主信号 + 真机走查（V3 复跑 G4 两条核心链）；真机截图刷新 README | `docs/ACCEPTANCE.md`、`docs/RELEASE.md` | ⏳ |
| **M7 发布** | V2/V3 通过 | GitHub tag/Release（附 tgz + sha256）；经验回流 LESSONS；市场投稿不适用（用户 2026-10-25 确认） | `docs/RELEASE.md`、`CHANGELOG.md` | ⏳ |
| **M8 回填** | M6 三层验收 | 组织 `BACKLOG.md` 只改状态列/招募列；状态列带版本号与日期；🟢 只认 V1+V2+V3 全过 | 组织 `BACKLOG.md` PR | ⏳ |

## 二、三个签认闸口

| 闸口 | 签什么 | 签认物 | 状态 |
| --- | --- | --- | --- |
| **G1** | 业务流程与功能范围：10 条一级线、32 个二级页、S01–S07 场景路径、CRUD 双通道、T1–T7 红线、默认值清单 | `docs/SPEC.md` + `docs/SCENARIOS.md` + `docs/INTERACTION-DESIGN.md` 版本 + `docs/DESIGN-SESSION.md` 原话/日期 | ✅ 2026-10-26 用户签认（原话留痕见 DESIGN-SESSION §二） |
| **G2** | HTML 原型版本与范围；P1 发布可见性；X1–X4 交互路径一致性 | `prototypes/v0.2/` v0.2.2 + 7 文件 SHA-256 锁定 + `docs/PROTOTYPE-REVIEW.md` | ✅ 2026-10-26 用户「确认通过」 |
| **G3** | 数据模型与数据流；迁移只增不改 | `schema/0001_initial.sql`（16 表，sha256 `98bb769e…`）+ `docs/SCHEMA.md` | ✅ 2026-10-26 用户「确认通过」，**冻结生效** |
| **G4（2026-10-26 用户新增）** | **手工 + AI 双通道的数据维护更新检查与通过**：9 类可写实体的手工新增/更新/更正、AI 候选→核对→确认（拒收零副作用）、双通道同源（IP9）、private 三出口 | ACC-32/33/34 实测证据 + 脚本断言（M5 出口执行；V3 真机复跑抽查） | ⏳ 定义已确认（DESIGN-12），执行待 M5 |

> **命名消歧**：家族 [23-METRIC-GRADING](23-METRIC-GRADING-AND-ALERTS.md) / [25-GUIDELINE-BRIDGE](25-GUIDELINE-BRIDGE.md) 里的「G1–G4」指 **CTCAE 毒性分级（grade）**；本表的 G4 是**流程闸口**名，两者无关。涉及毒性分级的文案一律写「grade N」，避免歧义。

## 三、三层验证（V1/V2/V3）

| 层 | 含义 | 判据 | 当前 |
| --- | --- | --- | --- |
| **V1 包级** | 源码与包自洽 | `npm run check` 全绿 + `npm test` 全过 + `npm run audit` 无 fail | 部分：check ✅、test 4/4 ✅、audit 22/30（6 项为 M5/发布期脚手架，见下） |
| **V2 装机** | 正确 Desktop profile 真加载 | tgz 安装、版本/hash 一致、正确 profile、业务区可见 | ⏳ 未执行 |
| **V3 业务** | 实机核心流程 | 登记→时间线→复发事件→复诊摘要 全链路走通 | ⏳ 未执行 |

> V1 通过不等于可用；V2/V3 未做不得写"已验证/已上架/社区可用"。

## 四、当前已知缺口（截至 2026-10-26）

1. `npm run audit` 余 2 项 fail（`lib/layout.js` 面板单一来源、检查链展示串），均为 **M5 客户端移植**脚手架；`lib/version.js` 已生成（0.2.0）、单测与文案红线检查器已入 check 链。
2. `prototypes/`、`schema/`、`research/anca-vasculitis/` 仍为空（分别属 M2/M3/M4）。
3. 医学线仍有 3 项未取得官方原文：NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码（详见 `research-notes/medical-constraints.md` §未核实）。
4. 用户线 0 访谈；滴度焦虑、激素副作用、生育三类**无直接第一人称证据**（如实记录，G1 决策点标注）。

## 五、变更记录

| 日期 | 变更 | 影响 |
| --- | --- | --- |
| 2026-10-25 | M0 完成；认领 Issue #44 | 建仓 + 文档骨架 |
| 2026-10-26 | M1 三路调研产出；补本文件；更正指南病种编号 | 待 G1；`#33` → 第 7 病种 / 印刷页 33 |
| 2026-10-26 | **G1 签认**（DESIGN-01–11）；**新增 G4**：手工 + AI 数据维护更新检查与通过（M5 出口执行，V3 复跑抽查；ACC-32–34） | M2 可开工；M5 出口与 M6 入口增加 G4 判据 |
| 2026-10-26 | **M2 原型完成**：prototypes/v0.2（10 线/32 页/7 路径、双档案、双通道、34/35 号、30 号窄宽）；独立评审 P0=0、P1×12 已修复；check 全绿 + 探针 + 无头走查 | 待 G2 签认（签认物与 hash 见 docs/PROTOTYPE-REVIEW.md） |
| 2026-10-27 | **MinerU 六部件完成**（18 号）：`dsh/mineru.js`（四步协议+模型回退判定）、`dsh/settings.js`（Token 三态/掩码/原子写，密钥落 `~/.vaspal/secrets/`）、`dsh/ancaparse.js`（8 marker 抽取 + CSV/HTML 表格 + 词边界防噪）、`dsh/parse.js`（parse_job 三态 + candidate 落库）、`GET/POST /settings/mineru`、`POST /parse/document`；前端"导入一份报告"（选文件/粘贴）+ 解析记录三态；18 项单测 | PDF 无 token 如实 FAILED(NO_TOKEN) 原件保留；文本类本地抽不花额度；确认候选才入事实层 |
| 2026-10-27 | **M5 开发版**：七步移植完成（数据层/读模型/路由/客户端/静态服务/双通道持久化/宿主接线）；G4 双通道七项实测通过并抓到真缺陷（question.updated_at 漏填）；audit 首次满分 33/33；39 测试；开发版浏览器实测 32 页零异常、手写与 AI 两通道均落库、primer 19 链接 0 缺链 | MinerU 六部件为独立组件，待单独接入；V2/V3 装机待真机 |
| 2026-10-27 | **M4 临床库首轮**：14 词×六源采集 → 1 条入库（标 needsHumanReview）、丢弃 43 条非 AAV；manifest=jsonl=sqlite 三方一致 + 指纹 + 覆盖纪律 7 断言；35 号三态读模型接入 GET /trials、/trials/snapshot。**如实记录**：AAV 直接相关 0 条；中文通道（CDE/ChiCTR/ICTRP）全 FAILED/DENIED 待重试；ctv 长词组分词噪声已实证 | 中文登记缺口待下次重试；不据此说"中国无试验" |
| 2026-10-26 | **G2 + G3 签认**（用户原话「确认通过」）：原型 v0.2.2（7 文件 hash 锁定）+ schema/0001（16 表）冻结生效 | M2/M3 完成；后续结构变更只能新增 000N；原型改动需重新展示 |
| 2026-10-26 | **摄取管线 + 图表反馈修复**：schema/0001 增 parse_job/candidate 两表（仍未冻结，随 G3 签认）；POST /parse（CSV/文本轻解析产候选，PDF/图片如实 FAILED 待 M5 MinerU）+ /candidates accept/reject；一图秀重做为小面板真实纵轴（修图表控件变形与归一化误导） | 上传/拍照/MinerU 链路的端点契约就位；G3 签认范围含新两表 |
| 2026-10-26 | **数据层写入面**（用户指令）：schema/0001（14 表，G3 冻结候选）+ dsh/write-schema（12 kind 契约面）+ dsh/store（SQLite 主力+文件回退）+ 写端点全族 + saved-trials + bootstrap capabilities + check-write-schema/check-wording 入链；VERSION 0.2.0 | 待 G3 签认冻结；G4 的 ACC-32–34 有了可实测的写接口 |
