# schema 冻结合同 · 小脉宝 VasPal（ANCA 相关血管炎）· G3 候选 · 2026-10-26

- 文件：`0001_initial.sql`（13 表：档案级 2 + 事实可写 9 + 摘要/问题/记录 3 + 收藏 1 —— 以文件内实际 CREATE TABLE 为准）
- sha256：`11381c58306cd23b451309e45da3c9eeebf79a806f569a7c10ffaf1c03e19bcb`
- **状态：G3 冻结候选——用户签认前不视为冻结**。签认后本文件哈希不得变动；结构变更只能新增 `000N_*.sql`。

## 冻结断言（将随 G3 一并实测，node:sqlite 内存加载）

1. **判读列断言**：全表全列名扫描 deny 词表（remission / flare_status / relapse_risk / control_status / diagnosis / subtype / pathology_grade / risk_level / normal_flag / verdict / severity / match_score / eligible / suitability）→ 必须为 0 命中（T1；`scripts/check-write-schema.mjs` 静态执行）。
2. 语法：`DatabaseSync.exec` 全量执行通过。
3. T1–T7 落点：lab_reading.marker 分列 PR3_ANCA/MPO_ANCA（T2）；relapse_event 独立档案 + confirmation_text 可空（T3）；treatment_version.revision/in_use 版本链（T4）；side_effect.section 分节（T5）；recorder/visibility 贯穿可写表（T6）；followup_plan.source_text 只存医嘱原文（T7）；saved_trial 无判定列（35 号）。

## G3 留痕

- G3 请求签认：2026-10-26（随本次提交提出，待用户）。
- 用户签认：待填（签认后此行写"✅ 冻结正式生效"+日期，并同步 `docs/DEV-PLAN.md` G3 行）。
