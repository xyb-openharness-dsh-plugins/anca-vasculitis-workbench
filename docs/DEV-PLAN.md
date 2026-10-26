# DEV-PLAN · 小脉宝 VasPal（ANCA 相关血管炎工作台）

> 本文件是里程碑与判据的**唯一来源**。汇报话术按 [prompts/PROGRESS-REPORT.md](../prompts/PROGRESS-REPORT.md)，本文件只回答"到哪一步、凭什么算过"。
> 状态口径：✅ 已完成（有证据）/ 🔧 进行中 / ⏳ 未开始 / — 不适用。
> 最后更新：2026-10-26（**G1 已签认**；新增 G4 数据维护更新闸口；下一阶段 M2）。

## 一、里程碑与判据

| 里程碑 | 进入条件 | 通过判据（可验证） | 证据落点 | 状态 |
| --- | --- | --- | --- | --- |
| **M0 骨架** | Issue #44 认领 | 私有仓建立；`dsh-wb-cli init`；`cordis.patch.yml` 补 `config.root`；文档 9 件；`npm run check` 通过 | commit `4e45d54`；`npm run check` staticPass=true | ✅ 2026-10-25 |
| **M1 调研 + SPEC** | M0 通过 | 三路调研有产出：医学约束 10 主题、用户与照护者证据、家族对比实测；DIFF-MATRIX 一级重名率 ≤70%（实测数）；SPEC/SCENARIOS/PATIENT-FLOW/INTERACTION-DESIGN 全量；G1 决策点显式列出 | `research-notes/medical-constraints.md`、`research-notes/family-landscape.md`、`docs/USER-RESEARCH.md`、`docs/DIFF-MATRIX.md`、`docs/SPEC.md`、`docs/SCENARIOS.md`、`docs/PATIENT-FLOW.md`、`docs/INTERACTION-DESIGN.md` | ✅ 2026-10-26（G1 签认） |
| **M2 原型** | **G1 签认** | demo 构建器 + `prototypes/v0.2/` 四件套；窄宽规则（30 号）从第一版执行；HVT X1–X4 走查；独立评审 P0 修复留痕 | `docs/DESIGN-REVIEW.md`、`docs/HVT-REVIEW.md`、`prototypes/v0.2/` | ⏳ 下一阶段 |
| **M3 数据模型** | **G2 签认** | `schema/0001_initial.sql` 冻结 + sha256；判读列断言（无 `remission/flare_status/relapse_risk/control_status`）；`freeze-contract.md` | `schema/0001_initial.sql`、`docs/SCHEMA.md` | ⏳ |
| **M4 临床库** | M3 通过 | `research/anca-vasculitis/` 四件套（manifest=jsonl=sqlite）；unified-trial-mcp 在线通道；FAILED 如实记录、不计覆盖 | `research/anca-vasculitis/` | ⏳ |
| **M5 开发版** | M2/M3/M4 就绪 | 七步移植（数据层/读模型/路由/客户端/MinerU 六部件/测试与红线/宿主接线）；`npm run check` 全绿；`npm run audit` 无 fail；**G4 数据维护更新检查全部通过** | `dsh/`、`lib/`、`public/`、`test/`、ACC-32–34 | ⏳ |
| **M6 装机** | V1 + **G4 通过** | 改包必升版 → `npm pack` → tgz 四要素对照 → profile 安装 → 宿主信号 + 真机走查（V3 复跑 G4 两条核心链）；真机截图刷新 README | `docs/ACCEPTANCE.md`、`docs/RELEASE.md` | ⏳ |
| **M7 发布** | V2/V3 通过 | GitHub tag/Release（附 tgz + sha256）；经验回流 LESSONS；市场投稿不适用（用户 2026-10-25 确认） | `docs/RELEASE.md`、`CHANGELOG.md` | ⏳ |
| **M8 回填** | M6 三层验收 | 组织 `BACKLOG.md` 只改状态列/招募列；状态列带版本号与日期；🟢 只认 V1+V2+V3 全过 | 组织 `BACKLOG.md` PR | ⏳ |

## 二、三个签认闸口

| 闸口 | 签什么 | 签认物 | 状态 |
| --- | --- | --- | --- |
| **G1** | 业务流程与功能范围：10 条一级线、32 个二级页、S01–S07 场景路径、CRUD 双通道、T1–T7 红线、默认值清单 | `docs/SPEC.md` + `docs/SCENARIOS.md` + `docs/INTERACTION-DESIGN.md` 版本 + `docs/DESIGN-SESSION.md` 原话/日期 | ✅ 2026-10-26 用户签认（原话留痕见 DESIGN-SESSION §二） |
| **G2** | HTML 原型版本与范围；P1 发布可见性；X1–X4 交互路径一致性 | `prototypes/v0.2/` 版本 + hash + 预览证据 + `docs/PROTOTYPE-REVIEW.md` | ⏳ |
| **G3** | 数据模型与数据流；迁移只增不改 | `schema/0001_initial.sql` + sha256 + `docs/SCHEMA.md` | ⏳ |
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

1. `npm run audit` 6 项 fail，均为 **M5/发布期**脚手架，不阻塞 M1：
   - `lib/version.js`、`lib/layout.js`（`customFrame`）未生成；
   - 检查链缺单测与文案红线两项（M5 接入）；
   - ~~`docs/DEV-PLAN.md` 缺失~~（本次已补）。
2. `prototypes/`、`schema/`、`research/anca-vasculitis/` 仍为空（分别属 M2/M3/M4）。
3. 医学线仍有 3 项未取得官方原文：NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码（详见 `research-notes/medical-constraints.md` §未核实）。
4. 用户线 0 访谈；滴度焦虑、激素副作用、生育三类**无直接第一人称证据**（如实记录，G1 决策点标注）。

## 五、变更记录

| 日期 | 变更 | 影响 |
| --- | --- | --- |
| 2026-10-25 | M0 完成；认领 Issue #44 | 建仓 + 文档骨架 |
| 2026-10-26 | M1 三路调研产出；补本文件；更正指南病种编号 | 待 G1；`#33` → 第 7 病种 / 印刷页 33 |
| 2026-10-26 | **G1 签认**（DESIGN-01–11）；**新增 G4**：手工 + AI 数据维护更新检查与通过（M5 出口执行，V3 复跑抽查；ACC-32–34） | M2 可开工；M5 出口与 M6 入口增加 G4 判据 |
