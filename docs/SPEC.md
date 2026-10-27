# 项目规格（SPEC）· 小脉宝 VasPal · ANCA 相关血管炎工作台 · M1 定稿

状态：M1 定稿，**G1 已签认（2026-10-26）**。签认记录见 [DESIGN-SESSION](DESIGN-SESSION.md) §二。
判据来源：[DEV-PLAN](DEV-PLAN.md)；证据：[USER-RESEARCH](USER-RESEARCH.md)、[research-notes/medical-constraints.md](../research-notes/medical-constraints.md)、[research-notes/family-landscape.md](../research-notes/family-landscape.md)、[DIFF-MATRIX](DIFF-MATRIX.md)。

## 一、设计者与研究/场景依据

- **代表谁**：ANCA 相关血管炎（GPA/MPA/EGPA）患者本人 + 家属照护者双主体；病程从确诊起，覆盖诱导、维持、缓解监测、复发事件与长程多科随访。
- **怎样调研**：三路并行（医学约束 10 主题 / 用户与照护者公开证据 / 家族结构对比实测）；**0 访谈，如实声明**；公开叙述只作〔改写〕锚点，不冒充一手引语。
- **如何取舍**：患者任务优先于医生任务；能记录的不判定；能引用原文的不做解释；能用候选的不直接入库；能收敛的不平铺。
- **证据 → 需求 → 场景 → 功能 → 验收**链：
  - 证据 E1–E10 + N1–N8（USER-RESEARCH）→ 场景 S01–S07（SCENARIOS）→ 10 条一级线（DIFF-MATRIX）→ T1–T7 验收断言（本文 §九）。

## 二、问题、用户与最小闭环

- **问题**：ANCA 患者的滴度、肾功/尿检、用药变更、复发事件、激素副作用分散在多科多院材料里；滴度与报告术语难懂；家属代记缺少统一入口；复诊前说不清"最近发生了什么"。
- **最小闭环**：登记复查/用药/复发事件/副作用 → 滴度与肾功双轨核对 → 随访日历 → 复诊摘要 + 问题清单 → 复诊后回填医嘱原文。
- **成功标准**：
  1. 数据保存在用户明确选择的本机资料目录；
  2. schema 无任何判读列（T1）；
  3. PR3/MPO 分列、滴度与肾功分轨（T2）；
  4. private 三出口（界面/导出/Agent）同源过滤；
  5. `npm run check` + 34/35 号断言器全绿（M5 起）。

## 三、方案与 ADR

| 方案 | 描述 | 优点 | 代价 | 结论 |
| --- | --- | --- | --- | --- |
| A 单页卡片流 | 一个首页铺所有卡片，二级页很少 | 上手快 | 长程材料一多就淹没；不符合家族 10 线结构；复诊/导入无落点 | 否决 |
| B 10 线导航 + 看板入口（推荐） | 看板给"今天做什么"，10 条一级线承接档案；写操作全部从看板卡进入 | 与家族心智一致；路径可断言；孤儿页可控 | 一级较多，需要 G1 确认 | **采用** |
| C 时间线为主轴 | 一切围绕一条总时间线 | 回顾强 | 写操作入口不清晰；副作用/资料库/复诊无处安放；与 28 号路径合同冲突 | 否决 |

**布局**：`business-first`（BRIEF 已定）。看板在上，业务区优先；原生 Agent 面板按 20 号合同，不仿制聊天 UI。

## 四、功能范围

### 一期 10 条一级线（P0）

| # | 一级 | 回答什么 | 关键二级 | 验收锚点 |
| --- | --- | --- | --- | --- |
| 1 | 看板 | 今天最该做什么、下次复诊带什么 | — | S01–S07 入口 |
| 2 | 滴度与肾功时间线 | PR3/MPO、肌酐、尿检怎么变 | 曲线 / 肾功尿检 / 检测口径 | T1/T2 |
| 3 | 治疗与用药 | 走过哪几段方案、为什么换 | 当前方案 / 诱导维持 / 剂量链 / 耐受 | T4/T7 |
| 4 | 复发事件 | 哪天、哪个器官、依据是什么 | 事件 / 器官 / 依据 / 回顾 | T1/T3 |
| 5 | 激素副作用分节 | 骨/糖/感染/眼各自到什么程度 | 四节 | T5 |
| 6 | 病理与影像 | 报告原文写了什么 | 肾活检 / 影像 / 原文术语 | T1/T7 |
| 7 | 随访日历 | 下次去哪科、带什么 | 节奏 / 近期 / 计划 | T7 |
| 8 | 复诊与资料 | 说什么、资料在哪、能否导出 | 摘要 / 问题 / 报告任务 | T1/T6 |
| 9 | 病情整理 | 原件有没有出处、整理能否核对 | 资料库 / 草稿核对 / 档案 / 指标 / 汇总 | T1/T6 |
| 10 | 病情一图秀 | 数值与事件放回同一段时间 | 曲线 / 事件 / 口径 | T1/T2 |

### P1 / 非一期

- 心理与照护者资源入口（挂在复诊与资料/私密记录；不做独立一级）。
- 临床研究线索（35 号三态，挂复诊与资料二级）。
- 经济/援助资源导航（只做入口，不承诺资格）。
- 生育/妊娠：只做私密记录与"与医生讨论"提示，不做建议。

### 不做（红线）

- 不生成诊断、分型、病理分级、复发/缓解判定。
- 不建议加量/减量/停药/换药。
- 不做急症分诊或严重度评分。
- 不把滴度回升画成复发因果。
- 不把医生任务（写病历、生成病例汇报）当患者功能。

## 五、数据与 API

### 事实四层

| 层 | 实体 | 规则 |
| --- | --- | --- |
| 文档 | `document`（原件、sha256、来源、private） | 原件只读；解析失败不产候选 |
| 候选 | `candidate`（字段、原文、置信/待核对） | 永远是候选；逐项确认才进事实层；接受 ≠ 审核 |
| 记录 | `profile` / `lab_reading` / `treatment_version` / `relapse_event` / `side_effect` / `pathology_note` / `followup_plan` / `visit_summary` / `question` / `saved_trial` | 显式 `NULL`；不改历史；更正 = 新增版本 |
| 读模型 | 各线读法 | 只读事实层；趋势只取数值型；private 过滤 |

### 关键字段约束

- `lab_reading`：`marker`（PR3_ANCA / MPO_ANCA / CREATININE / EGFR / URINE_PROTEIN / URINE_RBC / ESR / CRP）、`value`、`unit`（按报告原文，不换算）、`measured_at`、`lab_name`、`report_quote`、`profile_id`、`author_role`。
- `relapse_event`：`event_date`、`organs`（多值）、`symptoms_text`、`confirmation_text`、`department`、`recorder`；**无** `flare_status` / `relapse_risk`。
- `treatment_version`：`drug`、`dose_text`、`route`、`start_date`、`end_date`、`change_reason_text`、`source_document_id`；版本链只增不改。
- `side_effect`：`section`（bone / glucose / infection / eye / other）、`symptom_text`、`test_text`、`report_quote`。
- **禁止列**：`remission`、`flare_status`、`relapse_risk`、`control_status`、`diagnosis_judgement`、`subtype_judgement`、`pathology_grade`、`match_score`、`eligible`、`suitability`。
- 时区：本机本地时区；日期只存日期，不存时区偏移。
- 单位：照抄报告；不做单位换算或参考区间判定。

### API（apiBase 已定稿：`/api/anca-vasculitis`）

- 写入面（2026-10-26 随数据层落地）：`POST /records/:kind` 12 kind 全族（列名与 schema/0001 逐列一致，
  映射唯一来源 `dsh/write-schema.js`）；`POST /records/:kind/:id/correct` 更正链；
  `POST|GET|DELETE /saved-trials`（35 号收藏/取消零副作用）；
  `GET /bootstrap` capabilities（=AI 经同一写接口入库的契约面：kinds+列映射+deny 列+端点清单）；
  `GET /health`（旧路径 `/api/anca-vasculitis-workbench/health` 兼容保留一个发布周期）。
- 存储：**SQLite 主力**（node:sqlite，`<资料目录>/anca-vasculitis.sqlite`）+ **JSON 文件回退**
  （node:sqlite 不可用或开库失败时自动切换，同一接口同一更正链；模式经 bootstrap 如实上报）。
- 交界守卫：校验失败一律 4xx JSON（400/404/405/413），不裸 throw 变 500。
- 检查器：`scripts/check-write-schema.mjs`（写映射列名必须存在于冻结 schema + deny 列断言），
  已接入 `npm run check`。
- 导出：private 默认排除；导出快照带版本号与生成时间。
- 迁移：`schema/0001_initial.sql` 已建（G3 冻结候选，sha256 记于 freeze-contract.md）；冻结后只增不改。

## 六、设置与配置

- **资料目录**：选择/切换/迁移；状态四态（检查中/未选择/就绪/故障）；故障不改用上个目录绿灯。
- **隐私**：`visibility=private` 默认不进界面列表折叠区、导出、Agent 上下文；三出口同源。
- **MinerU**：启用（18 号 v2 六部件）；解析失败保留原件、不产候选。
- **试验匹配**：本地快照 + unified-trial-mcp 在线通道；FAILED/DENIED 如实显示、不计覆盖。
- **Agent 会话**：资料目录与会话双状态独立；无会话时业务可用；AI 一键发送按 34 号降级。

## 七、UI 与原型一致性

- 原型：`prototypes/v0.2/`（M2 产出，G2 签认版本 + hash）。
- 语义 token：`assets/tokens.css` / `assets/tokens.json`；窄宽规则 30 号从第一版执行。
- 大字、翻面、图表、键盘、`prefers-reduced-motion`：M2 逐项验。
- 偏离：进 `docs/PARITY.csv`，写依据与替代；一致性 >98% 才达 Phase3 parity。

## 八、资源与 Agent

- 资料目录/原生会话双状态按 [09-WORKBENCH-STATUS](09-WORKBENCH-STATUS.md)；独立网页预览只展示业务，不伪装 Desktop。
- **34 号**：`<app>:agent-draft` 四段链路 + 双守卫 + 降级链；private 不进上下文。
- **35 号**：三态（命中/无法自动匹配/不产出"不适用"）；禁止数值化匹配度。
- assets：品牌 `#3E7C8F`（血管青）+ 家族橙；许可证与包体在 M5 核。
- 后台调度、云同步、外部 API：未验证前不宣称可用。

## 九、验收（T1–T7 → ACCEPTANCE）

| 约束 | 验收方式 | ACCEPTANCE 行 |
| --- | --- | --- |
| T1 无判读列、只引原文 | schema 断言 + 红线词表零命中 | ACC-02 + `check-wording`（M5） |
| T2 PR3/MPO 分列、滴度与肾功分轨 | `marker`/`specimen_kind` 断言 + 趋势白名单 | ACC-02 / ACC-08 |
| T3 复发事件独立档案 | 独立表 + 无 `recurrence` 命名 | ACC-02 |
| T4 剂量版本链、零建议调整 | 版本链断言 + 词表测试 | ACC-02 / ACC-13 |
| T5 副作用分节不进趋势 | 分节字段 + 趋势白名单 | ACC-08 |
| T6 双主体代记、private 三出口 | `author_role` + 三出口过滤测试 | ACC-02 / ACC-12 |
| T7 长程随访、零停药、急症不判分诊 | 红线扫描 + 固定提示卡断言 | ACC-02 + `check-wording`（M5） |

**G4（2026-10-26 用户新增）**：手工 + AI 双通道的数据维护更新检查与通过——9 类可写实体 × 2 通道逐项实测、双通道同源（IP9）、拒收零副作用、private 三出口；检查矩阵见 [INTERACTION-DESIGN](INTERACTION-DESIGN.md) §十，验收行 **ACC-32/33/34**；M5 出口首过，V3 真机复跑抽查。

三层验证：V1 `npm run check` + `npm test` + `npm run audit` 无 fail；V2 真机加载；V3 核心业务闭环。详见 [DEV-PLAN](DEV-PLAN.md) 与 [ACCEPTANCE](ACCEPTANCE.md)。

## 十、风险与未验证

1. **0 访谈**：S01 滴度焦虑、S04 激素副作用、S10 生育/心理为证据缺口；优先级已在 G1 确认（S01/S05 P0，S04 P1，生育/心理不单列场景），后续访谈或组织合作验证后修订。
2. **指南/监管**：NMPA 批准文件、2021 AAGN 指南卷期页码、2018 EGPA 共识页码未取得（medical-constraints §五）。
3. **Desktop 能力**：宿主加载、原生会话、Agent 面板均未在本机验证（V2/V3）。
4. **审计算力**：`npm run audit` 6 项 fail 属 M5/发布期脚手架；M5 前不宣称 V1 全绿。
5. **试验库**：`research/anca-vasculitis/` 为空（M4）；在 M4 前试验入口显示"未配置"，不显示空结果。

## 十一、默认值（G1 已确认，2026-10-26；变更走 DESIGN-SESSION 留痕）

| 项 | 默认值 | 依据 |
| --- | --- | --- |
| 服务主体 | 患者 + 家属双主体 | DEV-REQUIREMENTS §五（2026-10-25） |
| 病程覆盖 | 全病程（确诊起） | 同上 |
| MinerU | 启用 | 同上 |
| 品牌占位名 | 小脉宝 VasPal | 同上 |
| 初始布局 | business-first | BRIEF |
| 市场投稿 | 不适用（只做 GitHub Release） | DEV-REQUIREMENTS §八（2026-10-25 用户确认） |
| 一级线数 | 10 条（32 二级） | 本文 §四 + family-landscape §6.4 |
