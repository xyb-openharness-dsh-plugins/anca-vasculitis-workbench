# 互动设计记录

状态：设计者已对齐；M1 三路调研与 G1 包已准备，**待用户签认**。
当前阶段/范围：designer-alignment ✅ → research ✅ → scenarios ✅ → specification ✅ → **G1（待签）** → independent-review → prototype → implementation；已有项目从当前未决项继续，不重复重置。
设计提示词：docs/DESIGN-PROMPT.md；设计者章程：docs/DESIGNER-BRIEF.md；实际独立审查：docs/DESIGN-REVIEW.md。
权威内容：docs/BRIEF.md、docs/SPEC.md；证据：docs/USER-RESEARCH.md、research-notes/、docs/DIFF-MATRIX.md。

## 一、M1 已落定的决策（Agent 建议，待 G1 一并确认）

| 决策 ID | 待解决的问题 | 用户已确认内容/来源 | Agent 建议及原因 | 待确认项 | 确认人/日期 | 影响功能 ID |
| --- | --- | --- | --- | --- | --- | --- |
| DESIGN-01 | 服务主体 | DEV-REQUIREMENTS §五（2026-10-25 默认值） | 患者 + 家属双主体；活动期家属代记高频 | G1 确认 | 待签 | 全局 / T6 |
| DESIGN-02 | 病程覆盖 | 同上 | 全病程：诱导 → 维持 → 缓解监测 → 复发 | G1 确认 | 待签 | 全局 |
| DESIGN-03 | 一级线数量与命名 | family-landscape §6.4 实测 | 10 条一级 / 32 二级；与基准 breast 重名率 30% | G1 确认 10 条 | 待签 | 全部 |
| DESIGN-04 | 滴度与肾功是否合并 | DIFF-MATRIX §六-1 | 合并一条、内部三轨（PR3 / MPO / 肾功尿检） | G1 确认 | 待签 | 滴度与肾功时间线 |
| DESIGN-05 | 复发事件是否独立一级 | DIFF-MATRIX §六-2 | 独立一级；不与滴度曲线合并、不复用肿瘤命名 | G1 确认 | 待签 | 复发事件 |
| DESIGN-06 | 激素副作用是否独立一级 | DIFF-MATRIX §六-3 | 独立一级；分节记录、不进滴度趋势 | G1 确认 | 待签 | 激素副作用分节 |
| DESIGN-07 | 病理与影像是否独立一级 | DIFF-MATRIX §六-4 | 独立一级；只引原文、不做病理分级 | G1 确认 | 待签 | 病理与影像 |
| DESIGN-08 | 是否保留病情整理 + 病情一图秀 | DIFF-MATRIX §六-5 | 都保留（导入核对 + 给医生看的一页） | G1 确认 | 待签 | 病情整理 / 病情一图秀 |
| DESIGN-09 | 临床研究入口 | DIFF-MATRIX §六-6 | 挂复诊与资料二级，走 35 号三态 | G1 确认 | 待签 | 复诊与资料 / 35 号 |
| DESIGN-10 | 证据缺口的处理 | USER-RESEARCH §四 | S01 滴度焦虑、S04 激素副作用、生育/心理保留为假设，不冒充证据 | G1 知悉 | 待签 | S01/S04/S10 |
| DESIGN-11 | 市场投稿 | DEV-REQUIREMENTS §九（2026-10-25 用户确认） | 不适用；只做 GitHub Release | 已确认，G1 留痕 | 2026-10-25 | 发布 |

## 二、G1 签认包（请用户确认）

1. **范围**：10 条一级线 / 32 个二级页；S01–S07 场景路径；CRUD 双通道；T1–T7 红线。
2. **文件**：[SPEC](SPEC.md) · [SCENARIOS](SCENARIOS.md) · [PATIENT-FLOW](PATIENT-FLOW.md) · [INTERACTION-DESIGN](INTERACTION-DESIGN.md) · [DIFF-MATRIX](DIFF-MATRIX.md) · [USER-RESEARCH](USER-RESEARCH.md)。
3. **实测数字**：一级重名率 30%（vs breast v0.3）/ 50%（vs acromegaly v0.2）/ 30%（vs attr）/ 10%（vs liver）；判据 ≤70% ✅。
4. **证据声明**：0 访谈；3 类主题无直接第一人称证据（见 USER-RESEARCH §四）。
5. **我替你定的默认值**：双主体、全病程、MinerU 启用、品牌「小脉宝 VasPal」、business-first、市场投稿不适用（SPEC §十一）。
6. **确认方式**：请逐条回复"同意/改 X"；确认后写入本表"确认人/日期"列，M2 才开工。

## 三、本轮已写入的章节

- SPEC §二–§十一（问题/闭环、ADR、功能范围、数据与 API、设置、验收、风险、默认值）。
- SCENARIOS S01–S07 + 证据缺口 + 红线对照。
- INTERACTION-DESIGN：7 条路径、9 类实体 CRUD、IP1–IP10、32 页覆盖、34/35 号、X1–X4。
- DIFF-MATRIX：7 条种子、10 线、重名率、T1–T7 落点、6 条决策点。
- USER-RESEARCH：10 条叙述 + 10 个组织条目 + 需求归纳 + 缺口。
- medical-constraints：S01–S10 + 规范底本核实 + 未核实项。
- family-landscape：六仓实测 + 提案 + 重名率 + 决策点。
- DEV-PLAN：M0–M8 判据、G1–G3、V1–V3、当前缺口。

## 四、G1 后下一步

- 签认后进入 M2：按 INTERACTION-DESIGN §二/§五 构建 `prototypes/v0.2/` 四件套；先跑独立评审，再走 HVT X1–X4。
- 未签认前不写 HTML（IP1）。

## 五、变更

- 2026-10-26：`#33` → 第 7 病种 / 印刷页 33；医学底本从"未取得原件"升级为"已取得/已核实题录"；新增 10 线提案与 G1 包。

