# 数据主体—关系—表 · 小脉宝 VasPal · schema/0001（G3 冻结候选）

> 权威文件：`schema/0001_initial.sql`（sha256 见 `schema/freeze-contract.md`，**G3 签认前不视为冻结**）。
> 写入契约：`dsh/write-schema.js`（12 种 kind → 表 → 列，逐列一致）；检查器 `scripts/check-write-schema.mjs`。

## 表清单（16 表）

| 表 | 行 | 回答什么 | 关键列 / 约束 | 红线落点 |
| --- | --- | --- | --- | --- |
| workspace | 档案级 | 库元信息 | schema_version、dataset_state | — |
| profile | 档案级 | 主体与照护者 | subtype_text/serology_text 只存原文 | T1 |
| lab_reading | 事实·可写 | 滴度/肾功/尿检/炎症 | marker 枚举 8 值（PR3/MPO 分列）、revision+in_use | T1/T2 |
| treatment_version | 事实·可写 | 用药版本链 | 起止+原因原文、revision+in_use | T4 |
| relapse_event | 事实·可写 | 复发事件档案 | organs JSON、confirmation_text 可空 | T1/T3 |
| side_effect | 事实·可写 | 激素副作用分节 | section 枚举 5 节 | T5 |
| tolerance_note | 事实·可写 | 用药耐受 | quote_text 必填 | T4/T5 |
| document | 资料 | 原件清单 | file_path/sha256（真机落盘） | T1 |
| pathology_note | 资料 | 病理/影像原文+术语 | note_kind、terms JSON、不做分级 | T1 |
| followup_plan | 事实·可写 | 随访节奏 | source_text 医嘱原文、无推算列 | T7 |
| visit_summary | 摘要 | 复诊摘要 | items JSON（勾选的事实） | T1 |
| question | 摘要 | 问题清单 | status open/done、answered_text | — |
| note | 摘要 | 随手记（可私密） | visibility | T6 |
| parse_job | 摄取 | 文件/拍照/文本 → 解析任务 | status queued/parsed/failed/unsupported；FAILED 如实（error_code），不计覆盖 | 18 号 v2 |
| candidate | 候选层 | 解析/AI 产出的事实候选 | kind（目标事实 kind）+ payload JSON（列名=该 kind 写映射）+ status pending/accepted/rejected；确认才入事实层 | 18 号/IP9 |
| saved_trial | 收藏 | 35 号收藏 | trial_key+saved_at，UNIQUE，无匹配度列 | 35 号 |

## 更正链（版本链）

`lab_reading` / `treatment_version` / `relapse_event` / `side_effect` / `tolerance_note` 带
`revision` + `in_use`：更正 = 旧行 `in_use=0` + 新行 `revision+1`，不原地 UPDATE——
任何一次改数都能从库里回放（`POST /records/:kind/:id/correct`）。

## 写入面（API ↔ schema ↔ AI 同一契约）

- `POST /api/anca-vasculitis/records/:kind`（12 kind 全族）· 列名超集拒绝（SCHEMA_COLUMN_UNKNOWN）
- deny 列（判定类）永不接受：`SCHEMA_DENY_COLUMN`（T1 机器化，词表在 `dsh/write-schema.js`）
- `POST /records/:kind/:id/correct` · `GET /records/:kind?profileId=`
- `POST|GET|DELETE /api/anca-vasculitis/saved-trials`（35 号：收藏/取消零副作用）
- `POST /api/anca-vasculitis/parse`（文件/拍照/文本摄取：存原件 document + 登记 parse_job → 产出 candidate；
  内置轻解析支持 text/md/csv；PDF/图片本阶段如实 FAILED(PARSER_UNAVAILABLE)，M5 接 MinerU 六部件后同一端点产出候选）
- `GET /candidates`、`POST /candidates/:id/accept`（写事实层成功才置 accepted，失败零副作用）、`POST /candidates/:id/reject`
- `GET /api/anca-vasculitis/bootstrap`：capabilities（存储模式 sqlite/file 回退、schema 版本、kinds+列映射、端点清单）——AI 经同一写接口入库的契约面
- `GET /health`（`/api/anca-vasculitis-workbench/health` 旧路径兼容保留一个发布周期）

## 存储策略

**SQLite 主力**（node:sqlite，`<资料目录>/anca-vasculitis.sqlite`，WAL）；
node:sqlite 不可用或开库失败 → **JSON 文件回退**（`<库>.fallback.json`，同一接口、同一更正链语义）。
当前模式经 `GET /bootstrap` 的 `storage.mode` 如实上报，不静默降级。

## 禁止列（deny，T1 红线词表）

`remission / flare_status / relapse_risk / control_status / diagnosis / subtype_judgement /
pathology_grade / risk_level / normal_flag / verdict / severity / match_score / eligible / suitability`
——schema 全列名 0 命中（check-write-schema W2），写映射 0 出现（W4），路由层 400 拒收。

扩展策略：结构变更只新增 `000N_*.sql`；0001 冻结后不改不删。
