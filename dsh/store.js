/**
 * 数据层入口（小脉宝 VasPal · M3 前置）：开库、迁移、写入契约、更正链、关库。
 * 零运行时依赖：主库用内置 node:sqlite；node:sqlite 不可用（低版本 Node/受限环境）
 * 自动回退到 JSON 文件存储（同一接口、同一更正链语义），capabilities().storage.mode
 * 会如实报告当前模式，绝不静默降级。
 *
 * 三条边界（家族一致）：
 * 1. 路径由调用方给：不猜资料目录在哪，也不替用户建目录；
 * 2. 迁移只增不改：SQLite 按文件名顺序执行 schema/00*.sql，执行过就跳过（幂等）；
 *    文件存储按 SCHEMA_VERSION 标记；结构变更只能新增 000N（schema/freeze-contract.md）；
 * 3. 错误要能诊断：开库/迁移/写入各自抛带 code 的异常，调用方翻译成人话。
 *
 * 更正链（T4/T2）：lab_reading / treatment_version / relapse_event / side_effect /
 * tolerance_note 带 revision / in_use 两列。更正一条 = 旧行 in_use 置 0 + 插入
 * revision+1 的新行，不原地 UPDATE 数值——任何一次"改数字"都能从库里回放。
 */
import { mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { SCHEMA_VERSION, WRITE_KINDS, DENY_COLUMNS, JSON_COLUMNS, WRITE_KIND_KEYS } from './write-schema.js'

export const SCHEMA_DIR = fileURLToPath(new URL('../schema/', import.meta.url))
const MIGRATION_RE = /^(\d{4})_[a-z0-9_]+\.sql$/

export class StoreError extends Error {
  constructor(code, message, options = {}) {
    super(message)
    this.name = new.target.name
    this.code = code
    if (options.cause) this.cause = options.cause
  }
}

export class MigrationError extends StoreError {}
export class WriteError extends StoreError {}

/* ---------------- 写入校验（SQLite 与文件回退共用） ---------------- */

/** 校验 + 整形一行数据；非法列/枚举/JSON 抛 WriteError（code 供路由翻译成 4xx）。 */
/** store 管理的审计列：不进映射校验（correct() 合并旧行时会带上），但 deny 检查仍然生效 */
export const AUDIT_COLUMNS = ['id', 'revision', 'in_use', 'created_at']

export function validateRow(kind, data) {
  const spec = WRITE_KINDS[kind]
  if (!spec) throw new WriteError('SCHEMA_KIND_UNKNOWN', `未知的写入种类：${kind}`)
  const row = {}
  const errors = []
  for (const [k, v] of Object.entries(data || {})) {
    if (DENY_COLUMNS.includes(k)) throw new WriteError('SCHEMA_DENY_COLUMN', `列「${k}」属于判定类红线列，拒绝写入（T1）`)
    if (!AUDIT_COLUMNS.includes(k) && !spec.columns.includes(k)) throw new WriteError('SCHEMA_COLUMN_UNKNOWN', `列「${k}」不在 kind=${kind} 的冻结 schema 映射里`)
    row[k] = v
  }
  for (const col of spec.required) {
    if (row[col] === undefined || row[col] === null || row[col] === '') errors.push(`缺少必填列 ${col}`)
  }
  for (const [col, allowed] of Object.entries(spec.checks || {})) {
    if (row[col] !== undefined && row[col] !== null && !allowed.includes(row[col])) {
      throw new WriteError('SCHEMA_CHECK_FAILED', `列「${col}」取值不在允许范围：${row[col]}`)
    }
  }
  for (const col of spec.columns) {
    if (JSON_COLUMNS.has(col) && row[col] !== undefined) {
      const v = row[col]
      const arr = typeof v === 'string' ? (() => { try { return JSON.parse(v) } catch { throw new WriteError('SCHEMA_JSON_INVALID', `列「${col}」不是合法 JSON`) } })() : v
      if (!Array.isArray(arr)) throw new WriteError('SCHEMA_JSON_INVALID', `列「${col}」必须是数组`)
      row[col] = JSON.stringify(arr)
    }
  }
  if (errors.length) throw new WriteError('SCHEMA_REQUIRED_MISSING', errors.join('；'))
  return row
}

const nowIso = () => new Date().toISOString()
const newId = (prefix) => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

/* ---------------- 迁移文件（SQLite 用） ---------------- */

export function migrationFiles(dir = SCHEMA_DIR) {
  let entries
  try {
    entries = readdirSync(dir)
  } catch (error) {
    throw new MigrationError('SCHEMA_DIR_MISSING', `读不到迁移目录：${dir}`, { cause: error })
  }
  const files = entries.filter((f) => f.endsWith('.sql'))
  const unknown = files.filter((f) => !MIGRATION_RE.test(f))
  if (unknown.length) throw new MigrationError('SCHEMA_NAME_INVALID', `schema/ 里有不符合 NNNN_name.sql 的文件：${unknown.join(', ')}`)
  return files.sort()
}

/* ---------------- SQLite 主库 ---------------- */

function openSqlite() {
  /* process.getBuiltinModule：同步取内置模块；不可用（低版本/受限）→ null，走文件回退 */
  try {
    const mod = process.getBuiltinModule('node:sqlite')
    return mod ? { DatabaseSync: mod.DatabaseSync } : null
  } catch {
    return null
  }
}

function createSqliteStore({ path, DatabaseSync, id }) {
  let db
  try {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true })
    db = new DatabaseSync(path)
  } catch (error) {
    throw new StoreError('OPEN_FAILED', `打不开 SQLite 库：${path}`, { cause: error })
  }

  function migrate() {
    db.exec(`CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL)`)
    for (const file of migrationFiles()) {
      const applied = db.prepare('SELECT 1 FROM _migrations WHERE name = ?').get(file)
      if (applied) continue
      try {
        db.exec(readFileSync(join(SCHEMA_DIR, file), 'utf8'))
        db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(file, nowIso())
      } catch (error) {
        throw new MigrationError('MIGRATION_FAILED', `迁移 ${file} 执行失败`, { cause: error })
      }
    }
  }

  const spec = (kind) => WRITE_KINDS[kind]

  function insert(kind, data) {
    const s = spec(kind)
    if (!s) throw new WriteError('SCHEMA_KIND_UNKNOWN', `未知的写入种类：${kind}`)
    const row = validateRow(kind, data)
    row.id = row.id || newId(kind.replace(/-/g, '_'))
    row.created_at = nowIso()
    if (s.versioned) { row.revision = 1; row.in_use = 1 }
    const cols = Object.keys(row)
    db.prepare(`INSERT INTO ${s.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => row[c]))
    return { ...row }
  }

  function correct(kind, id, patch) {
    const s = spec(kind)
    if (!s?.versioned) throw new WriteError('NOT_VERSIONED', `kind=${kind} 不走版本链；直接新增一条即可`)
    const old = db.prepare(`SELECT * FROM ${s.table} WHERE id = ? AND in_use = 1`).get(id)
    if (!old) throw new WriteError('ROW_NOT_FOUND', `找不到在用记录：${kind}/${id}`)
    const merged = validateRow(kind, { ...old, ...patch })
    db.prepare(`UPDATE ${s.table} SET in_use = 0 WHERE id = ?`).run(id)
    const row = { ...merged, id: newId(kind.replace(/-/g, '_')), revision: old.revision + 1, in_use: 1, created_at: nowIso() }
    const cols = Object.keys(row)
    db.prepare(`INSERT INTO ${s.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map((c) => row[c]))
    return row
  }

  function list(kind, { profileId, includeRetired = false } = {}) {
    const s = spec(kind)
    if (!s) throw new WriteError('SCHEMA_KIND_UNKNOWN', `未知的写入种类：${kind}`)
    const where = []
    const args = []
    if (s.versioned && !includeRetired) where.push('in_use = 1')
    if (profileId && s.columns.includes('profile_id') || profileId && s.table === 'profile') { where.push('profile_id = ?'); args.push(profileId) }
    if (s.table === 'profile' && profileId) { where.length = 0; args.length = 0; where.push('id = ?'); args.push(profileId) }
    const sql = `SELECT * FROM ${s.table}${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY rowid`
    return db.prepare(sql).all(...args)
  }

  /* ---- 候选层（18 号 v2）：候选不是事实；确认才走 insert 进事实层（IP9） ---- */
  function createParseJob({ profileId, documentId, sourceKind, filename, mime, sizeBytes, status = 'queued', errorCode = null, errorText = null }) {
    const job = { id: newId('pj'), profile_id: profileId || null, document_id: documentId || null, source_kind: sourceKind, filename: filename || null, mime: mime || null, size_bytes: sizeBytes ?? null, status, error_code: errorCode, error_text: errorText, created_at: nowIso(), finished_at: status === 'queued' ? null : nowIso() }
    db.prepare(`INSERT INTO parse_job (id, profile_id, document_id, source_kind, filename, mime, size_bytes, status, error_code, error_text, created_at, finished_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(job.id, job.profile_id, job.document_id, job.source_kind, job.filename, job.mime, job.size_bytes, job.status, job.error_code, job.error_text, job.created_at, job.finished_at)
    return job
  }
  function finishParseJob(id, status, errorCode = null, errorText = null) {
    db.prepare('UPDATE parse_job SET status = ?, error_code = ?, error_text = ?, finished_at = ? WHERE id = ?').run(status, errorCode, errorText, nowIso(), id)
    return db.prepare('SELECT * FROM parse_job WHERE id = ?').get(id)
  }
  function getParseJob(id) { return db.prepare('SELECT * FROM parse_job WHERE id = ?').get(id) || null }

  function createCandidate({ profileId, parseJobId, kind, payload, quoteText }) {
    if (!WRITE_KIND_KEYS.includes(kind)) throw new WriteError('SCHEMA_KIND_UNKNOWN', `候选目标 kind 不在写入契约里：${kind}`)
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    const clean = validateRow(kind, data)   // 候选创建即按写映射校验；不合法直接拒
    const row = { id: newId('cd'), profile_id: profileId, parse_job_id: parseJobId || null, kind, payload: JSON.stringify(clean), quote_text: quoteText || null, status: 'pending', created_at: nowIso(), decided_at: null }
    db.prepare('INSERT INTO candidate (id, profile_id, parse_job_id, kind, payload, quote_text, status, created_at, decided_at) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(row.id, row.profile_id, row.parse_job_id, row.kind, row.payload, row.quote_text, row.status, row.created_at, row.decided_at)
    return row
  }
  function listCandidates({ profileId, status } = {}) {
    const where = []; const args = []
    if (profileId) { where.push('profile_id = ?'); args.push(profileId) }
    if (status) { where.push('status = ?'); args.push(status) }
    return db.prepare(`SELECT * FROM candidate${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY rowid`).all(...args)
  }
  function getCandidate(id) { return db.prepare('SELECT * FROM candidate WHERE id = ?').get(id) || null }
  /* 确认入库：写事实层成功才置 accepted——失败原样抛错，零副作用 */
  function acceptCandidate(id) {
    const row = getCandidate(id)
    if (!row) throw new WriteError('ROW_NOT_FOUND', `找不到候选：${id}`)
    if (row.status !== 'pending') throw new WriteError('CANDIDATE_DECIDED', `候选已处理：${row.status}`)
    const fact = insert(row.kind, JSON.parse(row.payload))
    db.prepare('UPDATE candidate SET status = ?, decided_at = ? WHERE id = ?').run('accepted', nowIso(), id)
    return { candidate: getCandidate(id), fact }
  }
  function rejectCandidate(id) {
    const row = getCandidate(id)
    if (!row) throw new WriteError('ROW_NOT_FOUND', `找不到候选：${id}`)
    if (row.status !== 'pending') throw new WriteError('CANDIDATE_DECIDED', `候选已处理：${row.status}`)
    db.prepare('UPDATE candidate SET status = ?, decided_at = ? WHERE id = ?').run('rejected', nowIso(), id)
    return getCandidate(id)
  }

  function saveTrial(profileId, trialKey) {
    db.prepare('INSERT OR IGNORE INTO saved_trial (id, profile_id, trial_key, saved_at) VALUES (?, ?, ?, ?)')
      .run(newId('st'), profileId, trialKey, nowIso())
    return listSavedTrials(profileId)
  }
  function unsaveTrial(profileId, trialKey) {
    db.prepare('DELETE FROM saved_trial WHERE profile_id = ? AND trial_key = ?').run(profileId, trialKey)
    return listSavedTrials(profileId)
  }
  function listSavedTrials(profileId) {
    return db.prepare('SELECT * FROM saved_trial WHERE profile_id = ? ORDER BY saved_at').all(profileId)
  }

  return {
    mode: 'sqlite', id,
    migrate, insert, correct, list,
    saveTrial, unsaveTrial, listSavedTrials,
    createParseJob, finishParseJob, getParseJob, createCandidate, listCandidates, getCandidate, acceptCandidate, rejectCandidate,
    capabilities: () => ({ storage: { mode: 'sqlite', path: path === ':memory:' ? null : path, fallback: 'file' }, schemaVersion: SCHEMA_VERSION }),
    close: () => { try { db.close() } catch { /* 幂等 */ } }
  }
}

/* ---------------- 文件回退存储（同一接口、同一更正链语义） ---------------- */

function createFileStore({ path, id }) {
  const tables = {}
  let loaded = false

  function load() {
    if (loaded) return
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf8'))
        if (raw.schema_version !== SCHEMA_VERSION) {
          throw new StoreError('SCHEMA_VERSION_MISMATCH', `文件库 schema 版本 ${raw.schema_version} ≠ 当前 ${SCHEMA_VERSION}；请走迁移流程`)
        }
        Object.assign(tables, raw.tables || {})
      } catch (error) {
        if (error instanceof StoreError) throw error
        throw new StoreError('OPEN_FAILED', `打不开文件库：${path}`, { cause: error })
      }
    }
    for (const spec of Object.values(WRITE_KINDS)) tables[spec.table] = tables[spec.table] || []
    tables.saved_trial = tables.saved_trial || []
    tables.parse_job = tables.parse_job || []
    tables.candidate = tables.candidate || []
    loaded = true
  }

  function flush() {
    mkdirSync(dirname(path), { recursive: true })
    const body = JSON.stringify({ schema_version: SCHEMA_VERSION, saved_at: nowIso(), tables }, null, 2)
    const tmp = `${path}.tmp`
    writeFileSync(tmp, body, 'utf8')
    renameSync(tmp, path)
  }

  const rowsOf = (table) => (tables[table] = tables[table] || [])
  const spec = (kind) => WRITE_KINDS[kind]

  function insert(kind, data) {
    load()
    const s = spec(kind)
    if (!s) throw new WriteError('SCHEMA_KIND_UNKNOWN', `未知的写入种类：${kind}`)
    const row = validateRow(kind, data)
    row.id = row.id || newId(kind.replace(/-/g, '_'))
    row.created_at = nowIso()
    if (s.versioned) { row.revision = 1; row.in_use = 1 }
    if (s.upsert) {
      const idx = rowsOf(s.table).findIndex((r) => r.id === row.id)
      if (idx >= 0) rowsOf(s.table)[idx] = { ...rowsOf(s.table)[idx], ...row }
      else rowsOf(s.table).push(row)
    } else {
      rowsOf(s.table).push(row)
    }
    flush()
    return { ...row }
  }

  function correct(kind, id, patch) {
    load()
    const s = spec(kind)
    if (!s?.versioned) throw new WriteError('NOT_VERSIONED', `kind=${kind} 不走版本链；直接新增一条即可`)
    const rows = rowsOf(s.table)
    const old = rows.find((r) => r.id === id && r.in_use === 1)
    if (!old) throw new WriteError('ROW_NOT_FOUND', `找不到在用记录：${kind}/${id}`)
    old.in_use = 0
    const row = { ...validateRow(kind, { ...old, ...patch }), id: newId(kind.replace(/-/g, '_')), revision: old.revision + 1, in_use: 1, created_at: nowIso() }
    rows.push(row)
    flush()
    return row
  }

  function list(kind, { profileId, includeRetired = false } = {}) {
    load()
    const s = spec(kind)
    if (!s) throw new WriteError('SCHEMA_KIND_UNKNOWN', `未知的写入种类：${kind}`)
    let rows = rowsOf(s.table).slice()
    if (s.versioned && !includeRetired) rows = rows.filter((r) => r.in_use === 1)
    if (profileId && s.columns.includes('profile_id')) rows = rows.filter((r) => r.profile_id === profileId)
    if (s.table === 'profile' && profileId) rows = rows.filter((r) => r.id === profileId)
    return rows
  }

  function createParseJob({ profileId, documentId, sourceKind, filename, mime, sizeBytes, status = 'queued', errorCode = null, errorText = null }) {
    load()
    const job = { id: newId('pj'), profile_id: profileId || null, document_id: documentId || null, source_kind: sourceKind, filename: filename || null, mime: mime || null, size_bytes: sizeBytes ?? null, status, error_code: errorCode, error_text: errorText, created_at: nowIso(), finished_at: status === 'queued' ? null : nowIso() }
    rowsOf('parse_job').push(job); flush()
    return job
  }
  function finishParseJob(id, status, errorCode = null, errorText = null) {
    load()
    const rows = rowsOf('parse_job'); const j = rows.find((r) => r.id === id)
    if (j) { j.status = status; j.error_code = errorCode; j.error_text = errorText; j.finished_at = nowIso(); flush() }
    return j || null
  }
  function getParseJob(id) { load(); return rowsOf('parse_job').find((r) => r.id === id) || null }

  function createCandidate({ profileId, parseJobId, kind, payload, quoteText }) {
    load()
    if (!WRITE_KIND_KEYS.includes(kind)) throw new WriteError('SCHEMA_KIND_UNKNOWN', `候选目标 kind 不在写入契约里：${kind}`)
    const data = typeof payload === 'string' ? JSON.parse(payload) : payload
    const clean = validateRow(kind, data)
    const row = { id: newId('cd'), profile_id: profileId, parse_job_id: parseJobId || null, kind, payload: JSON.stringify(clean), quote_text: quoteText || null, status: 'pending', created_at: nowIso(), decided_at: null }
    rowsOf('candidate').push(row); flush()
    return row
  }
  function listCandidates({ profileId, status } = {}) {
    load()
    return rowsOf('candidate').filter((r) => (!profileId || r.profile_id === profileId) && (!status || r.status === status))
  }
  function getCandidate(id) { load(); return rowsOf('candidate').find((r) => r.id === id) || null }
  function acceptCandidate(id) {
    load()
    const row = rowsOf('candidate').find((r) => r.id === id)
    if (!row) throw new WriteError('ROW_NOT_FOUND', `找不到候选：${id}`)
    if (row.status !== 'pending') throw new WriteError('CANDIDATE_DECIDED', `候选已处理：${row.status}`)
    const fact = insert(row.kind, JSON.parse(row.payload))
    row.status = 'accepted'; row.decided_at = nowIso(); flush()
    return { candidate: { ...row }, fact }
  }
  function rejectCandidate(id) {
    load()
    const row = rowsOf('candidate').find((r) => r.id === id)
    if (!row) throw new WriteError('ROW_NOT_FOUND', `找不到候选：${id}`)
    if (row.status !== 'pending') throw new WriteError('CANDIDATE_DECIDED', `候选已处理：${row.status}`)
    row.status = 'rejected'; row.decided_at = nowIso(); flush()
    return { ...row }
  }

  function saveTrial(profileId, trialKey) {
    load()
    const rows = rowsOf('saved_trial')
    if (!rows.some((r) => r.profile_id === profileId && r.trial_key === trialKey)) {
      rows.push({ id: newId('st'), profile_id: profileId, trial_key: trialKey, saved_at: nowIso() })
      flush()
    }
    return listSavedTrials(profileId)
  }
  function unsaveTrial(profileId, trialKey) {
    load()
    tables.saved_trial = rowsOf('saved_trial').filter((r) => !(r.profile_id === profileId && r.trial_key === trialKey))
    flush()
    return listSavedTrials(profileId)
  }
  function listSavedTrials(profileId) {
    load()
    return rowsOf('saved_trial').filter((r) => r.profile_id === profileId)
  }

  return {
    mode: 'file', id,
    migrate: () => load(),
    insert, correct, list,
    saveTrial, unsaveTrial, listSavedTrials,
    createParseJob, finishParseJob, getParseJob, createCandidate, listCandidates, getCandidate, acceptCandidate, rejectCandidate,
    capabilities: () => ({ storage: { mode: 'file', path, fallback: null, reason: 'node:sqlite 不可用，已回退到 JSON 文件存储（同一写契约）' }, schemaVersion: SCHEMA_VERSION }),
    close: () => { if (loaded) flush() }
  }
}

/* ---------------- 工厂 ---------------- */

/**
 * 建存储。node:sqlite 可用 → SQLite 主库；否则回退 JSON 文件存储。
 * @param {object} opts
 * @param {string} opts.path   库文件路径（含文件名）；':memory:' 仅测试用
 * @param {string} [opts.id]   实例标识（capabilities 里透出）
 */
export function createStore({ path, id = 'anca-vasculitis', force = null } = {}) {
  if (!path) throw new StoreError('PATH_REQUIRED', '必须显式提供库文件路径（资料目录由用户选定）')
  const sqlite = force === 'file' ? null : openSqlite()
  if (sqlite) {
    try {
      const store = createSqliteStore({ path, DatabaseSync: sqlite.DatabaseSync, id })
      store.migrate()
      return store
    } catch (error) {
      if (error instanceof MigrationError) throw error
      // 开库失败（如文件被锁）→ 回退文件存储，capability 里带原因
      const fb = createFileStore({ path: `${path}.fallback.json`, id })
      const cap = fb.capabilities()
      cap.storage.reason = `SQLite 打开失败，已回退文件存储：${error.message}`
      return fb
    }
  }
  return createFileStore({ path: `${path}.fallback.json`, id })
}
