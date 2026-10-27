/**
 * 写入契约面（write contract）：kind → 表 → 列的**唯一来源**。
 *
 * 谁在消费它：
 *   - dsh/routes.js：POST /records/:kind 与 GET /records/:kind 按这里映射落表；
 *   - GET /bootstrap：把这张表原样发给前端与 AI（=AI 经同一写接口入库的契约面）；
 *   - scripts/check-write-schema.mjs：静态断言这里的每个列名都存在于冻结 schema/0001，
 *     且 deny 列永不出现（「写映射列名必须存在于冻结 schema」检查器）。
 *
 * 规则：
 *   1. 列名与 schema/0001_initial.sql 逐列一致，不新增、不改名；审计列
 *      （revision/in_use/created_at）由 store 自动填，不进 mappings；
 *   2. deny 列（判定类）永不出现——T1 红线的机器化；
 *   3. versioned 表带 revision/in_use 更正链：更正 = 旧行 in_use=0 + 新行 revision+1。
 */

export const SCHEMA_VERSION = '0001'

export const DENY_COLUMNS = [
  'remission', 'flare_status', 'relapse_risk', 'control_status',
  'diagnosis', 'subtype_judgement', 'pathology_grade', 'risk_level',
  'normal_flag', 'verdict', 'severity', 'match_score', 'eligible', 'suitability'
]

/** 枚举校验（与 schema 的 CHECK 子句一致，双保险） */
export const CHECKS = {
  marker: ['PR3_ANCA', 'MPO_ANCA', 'CREATININE', 'EGFR', 'URINE_PROTEIN', 'URINE_RBC', 'ESR', 'CRP'],
  route: ['口服', '静脉', '皮下', '肌注', '其他'],
  section: ['bone', 'glucose', 'infection', 'eye', 'other'],
  note_kind: ['biopsy', 'imaging'],
  doc_type: ['检查报告', '病理报告', '影像报告', '门诊记录', '出院记录', '住院记录', '处方', '个人材料', '其他'],
  recorder: ['PATIENT', 'FAMILY'],
  visibility: ['normal', 'private'],
  source_kind: ['manual', 'ai_candidate', 'import'],
  status: ['open', 'done']
}

/**
 * kind（API 复数路径段）→ 表与可写列。
 * 必填列缺失 → 400 SCHEMA_REQUIRED_MISSING；枚举外 → 400 SCHEMA_CHECK_FAILED。
 * profile 为 upsert 语义（档案建档/修改，不走版本链）。
 */
export const WRITE_KINDS = {
  'lab': {
    table: 'lab_reading', versioned: true,
    columns: ['profile_id', 'marker', 'value', 'unit', 'measured_at', 'lab_name', 'method', 'report_quote', 'source_kind', 'source_doc_id', 'recorder', 'visibility'],
    required: ['profile_id', 'marker', 'value', 'unit', 'measured_at', 'recorder'],
    checks: { marker: CHECKS.marker, recorder: CHECKS.recorder, visibility: CHECKS.visibility, source_kind: CHECKS.source_kind }
  },
  'treatment': {
    table: 'treatment_version', versioned: true,
    columns: ['profile_id', 'drug', 'dose_text', 'route', 'start_date', 'end_date', 'change_reason_text', 'source_kind', 'source_doc_id', 'source_label', 'recorder', 'visibility'],
    required: ['profile_id', 'drug', 'dose_text', 'start_date', 'recorder'],
    checks: { route: CHECKS.route, recorder: CHECKS.recorder, visibility: CHECKS.visibility, source_kind: CHECKS.source_kind }
  },
  'relapse': {
    table: 'relapse_event', versioned: true,
    columns: ['profile_id', 'event_date', 'organs', 'symptoms_text', 'confirmation_text', 'department', 'source_kind', 'source_doc_id', 'recorder', 'visibility'],
    required: ['profile_id', 'event_date', 'symptoms_text', 'recorder'],
    checks: { recorder: CHECKS.recorder, visibility: CHECKS.visibility, source_kind: CHECKS.source_kind }
  },
  'side-effect': {
    table: 'side_effect', versioned: true,
    columns: ['profile_id', 'section', 'event_date', 'symptom_text', 'test_text', 'report_quote', 'source_kind', 'source_doc_id', 'recorder', 'visibility'],
    required: ['profile_id', 'section', 'event_date', 'symptom_text', 'recorder'],
    checks: { section: CHECKS.section, recorder: CHECKS.recorder, visibility: CHECKS.visibility, source_kind: CHECKS.source_kind }
  },
  'tolerance': {
    table: 'tolerance_note', versioned: true,
    columns: ['profile_id', 'note_date', 'drug_hint', 'quote_text', 'source_kind', 'recorder', 'visibility'],
    required: ['profile_id', 'note_date', 'quote_text', 'recorder'],
    checks: { recorder: CHECKS.recorder, visibility: CHECKS.visibility, source_kind: CHECKS.source_kind }
  },
  'document': {
    table: 'document', versioned: false,
    columns: ['profile_id', 'name', 'doc_type', 'doc_date', 'file_path', 'sha256', 'report_quote', 'recorder', 'visibility'],
    required: ['profile_id', 'name', 'doc_type', 'recorder'],
    checks: { doc_type: CHECKS.doc_type, recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'pathology-note': {
    table: 'pathology_note', versioned: false,
    columns: ['profile_id', 'document_id', 'note_date', 'note_kind', 'terms', 'report_quote', 'recorder', 'visibility'],
    required: ['profile_id', 'note_date', 'note_kind', 'report_quote', 'recorder'],
    checks: { note_kind: CHECKS.note_kind, recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'followup': {
    table: 'followup_plan', versioned: false,
    columns: ['profile_id', 'department', 'planned_date', 'items_text', 'bring_text', 'source_text', 'recorder', 'visibility'],
    required: ['profile_id', 'department', 'source_text', 'recorder'],
    checks: { recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'question': {
    table: 'question', versioned: false,
    columns: ['profile_id', 'text', 'status', 'answered_text', 'recorder', 'visibility'],
    required: ['profile_id', 'text', 'recorder'],
    checks: { status: CHECKS.status, recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'note': {
    table: 'note', versioned: false,
    columns: ['profile_id', 'note_date', 'text', 'recorder', 'visibility'],
    required: ['profile_id', 'note_date', 'text', 'recorder'],
    checks: { recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'visit-summary': {
    table: 'visit_summary', versioned: false,
    columns: ['profile_id', 'summary_date', 'range_days', 'items', 'recorder', 'visibility'],
    required: ['profile_id', 'summary_date', 'range_days', 'recorder'],
    checks: { recorder: CHECKS.recorder, visibility: CHECKS.visibility }
  },
  'profile': {
    table: 'profile', versioned: false, upsert: true,
    columns: ['id', 'name', 'birth_date', 'gender', 'subtype_text', 'serology_text', 'dx_date', 'caregiver_label'],
    required: ['id', 'name'],
    checks: {}
  }
}

export const WRITE_KIND_KEYS = Object.keys(WRITE_KINDS)

/** 指标名 → marker（解析/候选映射白名单：映射不到就拒收，不猜轨道） */
export const MARKER_NAMES = {
  'PR3-ANCA': 'PR3_ANCA', 'PR3': 'PR3_ANCA', 'MPO-ANCA': 'MPO_ANCA', 'MPO': 'MPO_ANCA',
  '血肌酐': 'CREATININE', '肌酐': 'CREATININE', 'CREATININE': 'CREATININE',
  'eGFR': 'EGFR', 'EGFR': 'EGFR',
  '尿蛋白': 'URINE_PROTEIN', '24小时尿蛋白': 'URINE_PROTEIN',
  '尿红细胞': 'URINE_RBC',
  '血沉': 'ESR', 'ESR': 'ESR',
  'CRP': 'CRP', 'C反应蛋白': 'CRP', 'C 反应蛋白': 'CRP'
}

/** orgsns/JSON 字段：store 在写入前做 JSON.parse 校验 */
export const JSON_COLUMNS = new Set(['organs', 'terms', 'items'])
