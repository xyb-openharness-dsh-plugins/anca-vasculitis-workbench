-- 0001_initial.sql · 小脉宝 VasPal（ANCA 相关血管炎）工作台初始迁移（G3 冻结候选 · 2026-10-26）
-- 来源：docs/SPEC.md §五（G1 签认）+ family-landscape §6.4 页面树 + DEV-REQUIREMENTS T1–T7。
-- 冻结规则：G3 签认后 sha256 记入 schema/freeze-contract.md；结构变更只能新增 000N_*.sql。
-- ANCA 红线（本文件的硬约束，check-write-schema.mjs 断言）：
--   T1 无判定列：全 schema 不得出现 remission/flare_status/relapse_risk/control_status/
--      diagnosis_judgement/subtype_judgement/pathology_grade/risk_level/normal_flag/verdict/
--      severity/match_score/eligible/suitability——状态只引用医嘱与报告原文；
--   T2 lab_reading.marker 分列 PR3_ANCA 与 MPO_ANCA（永不合并）；滴度与肾功/尿检/炎症
--      用 marker 枚举区分轨道，不做加总列；
--   T3 relapse_event 独立档案（不复用肿瘤 recurrence 命名），确认依据只存原文，可空（显式 NULL）；
--   T4 treatment_version 版本链：更正 = in_use 置 0 + 新增 revision+1 行，不原地 UPDATE；
--   T5 side_effect.section 分节（bone/glucose/infection/eye/other），分类数据不进趋势（读模型约束）；
--   T6 recorder（PATIENT/FAMILY）+ visibility（normal/private）贯穿全部可写事实表；
--   T7 followup_plan 只存医嘱原文（source_text），无 interval 推算列；
--   35 号：saved_trial 只有 trial_key + saved_at，无 match_score/eligible；
--   18 号 v2：parse_job（文件/拍照 → 解析任务，FAILED 如实记录不计覆盖）+ candidate
--     （候选层：payload 列名与对应 kind 的写映射一致；确认才经同一写接口入事实层，IP9）。

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ═══ 档案级（2）═══
CREATE TABLE workspace (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data_root TEXT,
  schema_version TEXT NOT NULL,
  dataset_state TEXT
);

CREATE TABLE profile (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date TEXT,
  gender TEXT,
  subtype_text TEXT,             -- 亚型原文（T1：只存原文，不判定）
  serology_text TEXT,            -- 血清型原文（PR3/MPO 表述随报告）
  dx_date TEXT,
  caregiver_label TEXT,
  created_at TEXT NOT NULL
);

-- ═══ 化验（T2：marker 分列；revision/in_use 构成更正链）═══
CREATE TABLE lab_reading (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  marker TEXT NOT NULL CHECK (marker IN
    ('PR3_ANCA','MPO_ANCA','CREATININE','EGFR','URINE_PROTEIN','URINE_RBC','ESR','CRP')),
  value REAL NOT NULL,
  unit TEXT NOT NULL,            -- 单位照抄报告原文，不做换算
  measured_at TEXT NOT NULL,
  lab_name TEXT,
  method TEXT,
  report_quote TEXT,             -- 报告原句
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','ai_candidate','import')),
  source_doc_id TEXT REFERENCES document(id),
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  in_use INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_lab_profile_marker ON lab_reading(profile_id, marker, measured_at);

-- ═══ 治疗版本链（T4）═══
CREATE TABLE treatment_version (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  drug TEXT NOT NULL,
  dose_text TEXT NOT NULL,       -- 剂量照抄医嘱原文
  route TEXT CHECK (route IN ('口服','静脉','皮下','肌注','其他')),
  start_date TEXT NOT NULL,
  end_date TEXT,                 -- NULL = 进行中
  change_reason_text TEXT,       -- 变更原因原文
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','ai_candidate','import')),
  source_doc_id TEXT REFERENCES document(id),
  source_label TEXT,
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  in_use INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_treat_profile ON treatment_version(profile_id, start_date);

-- ═══ 复发事件独立档案（T3；不判定的独立表）═══
CREATE TABLE relapse_event (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  event_date TEXT NOT NULL,
  organs TEXT NOT NULL DEFAULT '[]',   -- JSON 数组：受累器官（登记原文）
  symptoms_text TEXT NOT NULL,
  confirmation_text TEXT,              -- 确认依据原文；还没有依据时显式 NULL
  department TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','ai_candidate','import')),
  source_doc_id TEXT REFERENCES document(id),
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  in_use INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_relapse_profile ON relapse_event(profile_id, event_date);

-- ═══ 激素副作用分节（T5：section 分节；分类不进趋势）═══
CREATE TABLE side_effect (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  section TEXT NOT NULL CHECK (section IN ('bone','glucose','infection','eye','other')),
  event_date TEXT NOT NULL,
  symptom_text TEXT NOT NULL,
  test_text TEXT,
  report_quote TEXT,
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','ai_candidate','import')),
  source_doc_id TEXT REFERENCES document(id),
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  in_use INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1)),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_side_profile_section ON side_effect(profile_id, section, event_date);

-- ═══ 用药耐受（与副作用同源，按原文记录）═══
CREATE TABLE tolerance_note (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  note_date TEXT NOT NULL,
  drug_hint TEXT,
  quote_text TEXT NOT NULL,      -- 反应/所见原文
  source_kind TEXT NOT NULL DEFAULT 'manual' CHECK (source_kind IN ('manual','ai_candidate','import')),
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  revision INTEGER NOT NULL DEFAULT 1,
  in_use INTEGER NOT NULL DEFAULT 1 CHECK (in_use IN (0,1)),
  created_at TEXT NOT NULL
);

-- ═══ 资料（原件只读；T6/T1）═══
CREATE TABLE document (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  name TEXT NOT NULL,
  doc_type TEXT NOT NULL CHECK (doc_type IN ('检查报告','病理报告','影像报告','门诊记录','出院记录','住院记录','处方','个人材料','其他')),
  doc_date TEXT,
  file_path TEXT,                -- 真机资料目录内的相对路径；原型/文件回退态可为 NULL
  sha256 TEXT,
  report_quote TEXT,
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_doc_profile ON document(profile_id, doc_date);

-- ═══ 病理/影像笔记（引用原文，不分级）═══
CREATE TABLE pathology_note (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  document_id TEXT REFERENCES document(id),
  note_date TEXT NOT NULL,
  note_kind TEXT NOT NULL CHECK (note_kind IN ('biopsy','imaging')),
  terms TEXT NOT NULL DEFAULT '[]',   -- JSON 数组：报告术语（只解释词义）
  report_quote TEXT NOT NULL,
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL
);

-- ═══ 随访（T7：只存医嘱原文）═══
CREATE TABLE followup_plan (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  department TEXT NOT NULL,
  planned_date TEXT,
  items_text TEXT,               -- 要查项目原文（顿号分隔照抄）
  bring_text TEXT,
  source_text TEXT NOT NULL,     -- 医嘱原文；无推算列
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL
);
CREATE INDEX idx_followup_profile ON followup_plan(profile_id, planned_date);

-- ═══ 复诊摘要与问题 ═══
CREATE TABLE visit_summary (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  summary_date TEXT NOT NULL,
  range_days INTEGER NOT NULL,
  items TEXT NOT NULL DEFAULT '[]',  -- JSON 数组：勾选的事实条目（只汇总）
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL
);

CREATE TABLE question (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','done')),
  answered_text TEXT,            -- 医生答复原话照记
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE note (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  note_date TEXT NOT NULL,
  text TEXT NOT NULL,
  recorder TEXT NOT NULL CHECK (recorder IN ('PATIENT','FAMILY')),
  visibility TEXT NOT NULL DEFAULT 'normal' CHECK (visibility IN ('normal','private')),
  created_at TEXT NOT NULL
);

-- ═══ 试验收藏（35 号：无 match_score/eligible；收藏/取消零副作用）═══
-- ═══ 解析与候选（18 号 v2 六部件的数据落点；确认才入事实层）═══
CREATE TABLE parse_job (
  id TEXT PRIMARY KEY,
  profile_id TEXT REFERENCES profile(id),
  document_id TEXT REFERENCES document(id),
  source_kind TEXT NOT NULL CHECK (source_kind IN ('file','photo','text')),
  filename TEXT,
  mime TEXT,
  size_bytes INTEGER,
  status TEXT NOT NULL CHECK (status IN ('queued','parsed','failed','unsupported')),
  error_code TEXT,               -- 失败时如实记录（如 PARSER_UNAVAILABLE），不计覆盖
  error_text TEXT,
  created_at TEXT NOT NULL,
  finished_at TEXT
);

CREATE TABLE candidate (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  parse_job_id TEXT REFERENCES parse_job(id),
  kind TEXT NOT NULL,            -- 目标事实 kind（与 dsh/write-schema.js 的 WRITE_KINDS 一致）
  payload TEXT NOT NULL,         -- JSON：字段候选（列名与该 kind 写映射一致）
  quote_text TEXT,               -- 抽取依据原文
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  created_at TEXT NOT NULL,
  decided_at TEXT
);
CREATE INDEX idx_cand_profile_status ON candidate(profile_id, status);

CREATE TABLE saved_trial (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES profile(id),
  trial_key TEXT NOT NULL,
  saved_at TEXT NOT NULL,
  UNIQUE (profile_id, trial_key)
);
