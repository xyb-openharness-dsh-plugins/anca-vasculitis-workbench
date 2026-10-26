# 开发强约束（DEV-REQUIREMENTS）· 2026-10-25 · ANCA 相关血管炎（AV）

> 体例照 ZERO-TO-DEV v1.2+（七步）。本文件为 M0 原创骨架版，M1 补全。禁止跨仓 fork 复制。
> 家族通用层全款继承；新增继承 **34 号（AI 协助一键发送）** 与 **35 号（试验匹配分层+三态）**。

## 一、范围（交付物 × 落点 × 怎么验）

| # | 交付物 | 落点 | 怎么验 |
| --- | --- | --- | --- |
| R1 | 开发版 dsh 七件套 + MinerU 六部件 | `dsh/` | check 全绿（含 34/35 号断言器） |
| R2 | 真客户端链路 | `src/client.js → lib/client.js`（cervical 底本） | 装机副本占位=0 + agent-draft 对穿 ✓ |
| R3 | schema + 冻结合同 | `schema/0001_initial.sql` | sha256 + 判读列断言 |
| R4 | 试验库 | `research/anca-vasculitis/` 四件套 | manifest=jsonl=sqlite；匹配输出走 35 号三态 |
| R5 | 原型 + 交互路径文档 | `prototypes/v0.2/` + INTERACTION-DESIGN | file:// + IP1–IP10 + HVT X1–X4 |
| R6 | 文档体系 | docs/ 9 件 | G1/G2/G3 留痕 |

## 二、照抄样板

移植样板：acromegaly-workbench v0.2.3（client 链路与 34 号实践底本）；成熟对比基准：breast-cancer-workbench（26 号口径）。

## 三、本病种专属约束（T1–T7 草案，M1 定稿）

| # | 约束 | 验证 | 依据 |
| --- | --- | --- | --- |
| T1 | **缓解/活动状态只引用医嘱与报告原文**，schema 无 remission/flare_status/relapse_risk 类判定列；滴度回升≠复发预告 | schema 断言 + 词表 | S01 |
| T2 | ANCA 滴度 PR3/MPO **分列不混**（靶抗原不同语义不同），滴度与肌酐/尿检分轨 | schema 断言（specimen_kind/marker 分列） | 待 M1 |
| T3 | **复发事件独立档案**（日期/受累器官/确认方式原文；不复用肿瘤 recurrence 结构命名） | 独立轨道断言 | 待 M1 |
| T4 | 免疫抑制方案**剂量版本链**（环磷酰胺/利妥昔单抗/霉酚酸酯/激素），变更链 + 化验联动语境；零"建议调整"文案 | 词表测试 | 待 M1 |
| T5 | **激素副作用分节**（骨/糖代谢/感染/眼等），分类不进滴度趋势 | 分节 *_title + 趋势白名单断言 | 待 M1 |
| T6 | 双主体代记 recorder；复发事件多为家属/患者口述事实记录 | schema author_role + UI 标识 | 待 M1 |
| T7 | 长程随访视角：肾科/风湿科多科复诊节奏语境；零"可以停药"暗示（免疫抑制减量是高风险决策域） | 红线扫描 | 待 M1 |

## 四、品牌三变量（占位，M2 前可回退）

组织色 **血管青 `#3E7C8F`** / 行动色 家族橙 / 分区 雾青灰。品牌占位「**小脉宝 VasPal**」。

## 五、可回退默认值（AskUserQuestion 未答，按推荐执行 · 2026-10-25）

| 项 | 推荐默认（可回退） |
| --- | --- |
| 服务主体 | 患者+家属双主体（活动期家属协助高频） |
| 病程覆盖 | 全病程（确诊起：诱导→维持→缓解监测→复发） |
| MinerU | 启用（18 号 v2 六部件） |
| 品牌占位名 | 小脉宝 VasPal（后续可全局替换） |

## 六、证据声明

本轮 **0 患者访谈**——公开叙述改写不冒充一手引语，逐条标注来源与改写性质。

## 七、闸口留痕

- M0（2026-10-25）：认领 issue #44（claimed）+ 建仓 + init 185 文件 + 基线 staticPass ✅。

## 八、发布口径（2026-10-25 用户确认，家族通用）

- GitHub 发布可以：tag + Release（附 tgz + sha256）。
- 工作台市场/awesome-dsh-workbench 目录投稿**不需要**——docs/10-MARKET-PUBLISHING.md 流程标注跳过。
