import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore, validateRow, migrationFiles } from '../dsh/store.js'
import { WRITE_KINDS, DENY_COLUMNS } from '../dsh/write-schema.js'

const dir = mkdtempSync(join(tmpdir(), 'anca-store-test-'))

test('SQLite 主库：迁移、写入、更正链（T4）', async () => {
  const store = createStore({ path: join(dir, 'wb.sqlite') })
  assert.equal(store.mode, 'sqlite')
  store.migrate()
  store.insert('profile', { id: 'P_T', name: '测试档案' })
  const lab = store.insert('lab', { profile_id: 'P_T', marker: 'MPO_ANCA', value: 12.5, unit: 'RU/mL', measured_at: '2026-10-26', recorder: 'PATIENT', source_kind: 'ai_candidate' })
  const corrected = store.correct('lab', lab.id, { value: 15.5 })
  assert.equal(corrected.revision, 2)
  const rows = store.list('lab', { profileId: 'P_T' })
  assert.equal(rows.length, 1)
  assert.equal(rows[0].value, 15.5)
  const all = store.list('lab', { profileId: 'P_T', includeRetired: true })
  assert.equal(all.length, 2, '更正链：旧行保留（in_use=0）')
  store.close()
})

test('写入契约：未知列 / deny 列 / 枚举外 / 缺必填 / JSON 数组', () => {
  const base = { profile_id: 'P_T', marker: 'MPO_ANCA', value: 1, unit: 'RU/mL', measured_at: '2026-10-26', recorder: 'PATIENT' }
  assert.throws(() => validateRow('lab', { ...base, unknown_col: 1 }), (e) => e.code === 'SCHEMA_COLUMN_UNKNOWN')
  assert.throws(() => validateRow('lab', { ...base, control_status: 'good' }), (e) => e.code === 'SCHEMA_DENY_COLUMN')
  assert.throws(() => validateRow('lab', { ...base, marker: 'B guesses' }), (e) => e.code === 'SCHEMA_CHECK_FAILED')
  assert.throws(() => validateRow('lab', { profile_id: 'P_T' }), (e) => e.code === 'SCHEMA_REQUIRED_MISSING')
  const row = validateRow('relapse', { profile_id: 'P_T', event_date: '2026-01-02', symptoms_text: 'x', organs: ['肾脏'], recorder: 'FAMILY' })
  assert.equal(row.organs, '["肾脏"]')
  assert.throws(() => validateRow('relapse', { profile_id: 'P_T', event_date: '2026-01-02', symptoms_text: 'x', organs: '肾脏', recorder: 'FAMILY' }), (e) => e.code === 'SCHEMA_JSON_INVALID')
  assert.throws(() => validateRow('nope', {}), (e) => e.code === 'SCHEMA_KIND_UNKNOWN')
})

test('文件回退存储：同一接口、同一更正链语义', async () => {
  const store = createStore({ path: join(dir, 'file-store.json'), force: 'file' })
  assert.equal(store.mode, 'file')
  store.migrate()
  store.insert('profile', { id: 'P_F', name: '回退档案' })
  const lab = store.insert('lab', { profile_id: 'P_F', marker: 'PR3_ANCA', value: 30, unit: 'RU/mL', measured_at: '2026-10-26', recorder: 'FAMILY' })
  const corrected = store.correct('lab', lab.id, { value: 22 })
  assert.equal(corrected.revision, 2)
  assert.equal(store.list('lab', { profileId: 'P_F' }).length, 1)
  assert.equal(store.capabilities().storage.mode, 'file')
  store.close()
})

test('saved_trial：收藏/取消（35 号，零副作用）', async () => {
  const store = createStore({ path: join(dir, 'trials.sqlite') })
  store.migrate()
  store.insert('profile', { id: 'P_S', name: '收藏档案' })
  store.saveTrial('P_S', 'NCT-DEMO-1')
  store.saveTrial('P_S', 'NCT-DEMO-1')
  assert.equal(store.listSavedTrials('P_S').length, 1, '重复收藏幂等')
  store.unsaveTrial('P_S', 'NCT-DEMO-1')
  assert.equal(store.listSavedTrials('P_S').length, 0)
  store.close()
})

test('迁移文件命名与 schema 完整性', () => {
  const files = migrationFiles()
  assert.deepEqual(files, ['0001_initial.sql'])
  for (const kind of Object.keys(WRITE_KINDS)) assert.ok(WRITE_KINDS[kind].table, kind)
  for (const c of DENY_COLUMNS) assert.ok(!Object.keys(WRITE_KINDS.lab.columns).includes(c))
})

test('清理临时目录', () => { rmSync(dir, { recursive: true, force: true }) })
