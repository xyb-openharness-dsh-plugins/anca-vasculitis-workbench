import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createApiHandler, API_PREFIX } from '../dsh/routes.js'
import { createStore } from '../dsh/store.js'
import { version } from '../lib/version.js'

const dir = mkdtempSync(join(tmpdir(), 'anca-api-test-'))

function mockRes() {
  const res = { statusCode: 0, headers: {}, body: '' }
  res.writeHead = (status, headers) => { res.statusCode = status; Object.assign(res.headers, headers || {}) }
  res.end = (buf) => { res.body = buf ? buf.toString('utf8') : '' }
  return res
}
function mockReq(method, url, body) {
  const req = { method, url, headers: {} }
  req.on = (ev, cb) => {
    if (ev === 'end' && body !== undefined) cb()
    if (ev === 'data' && body !== undefined) cb(Buffer.from(JSON.stringify(body)))
  }
  return req
}

test('bootstrap：capabilities = AI 入库契约面（存储模式/schema 版本/kinds/deny）', async () => {
  const store = createStore({ path: join(dir, 'api.sqlite') })
  store.migrate()
  const api = createApiHandler({ source: store, version, build: 'test' })
  const res = mockRes()
  await api(mockReq('GET', `${API_PREFIX}/bootstrap`), res)
  const body = JSON.parse(res.body)
  assert.equal(res.statusCode, 200)
  assert.equal(body.storage.mode, 'sqlite')
  assert.equal(body.schemaVersion, '0001')
  assert.ok(body.write.kinds.lab.columns.includes('marker'))
  assert.ok(body.write.denyColumns.includes('control_status'))
  assert.ok(body.endpoints.some((e) => e.includes('/records/lab')))
  assert.ok(body.write.note.includes('同一写接口'))
  store.close()
})

test('POST /records/:kind 全族：合法写入 201；红线列 400；未知列 400；未知 kind 404', async () => {
  const store = createStore({ path: join(dir, 'api-write.sqlite') })
  store.migrate()
  const api = createApiHandler({ source: store, version, build: 'test' })
  let res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/profile`, { id: 'P_A', name: '档案' }), res)
  assert.equal(res.statusCode, 201)

  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/lab`, { profile_id: 'P_A', marker: 'MPO_ANCA', value: 12.5, unit: 'RU/mL', measured_at: '2026-10-26', recorder: 'FAMILY', source_kind: 'ai_candidate' }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(JSON.parse(res.body).row.source_kind, 'ai_candidate', 'AI 候选与手工走同一写接口（IP9）')

  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/lab`, { profile_id: 'P_A', marker: 'MPO_ANCA', value: 1, unit: 'u', measured_at: '2026-10-26', recorder: 'PATIENT', control_status: 'good' }), res)
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'SCHEMA_DENY_COLUMN')

  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/lab`, { profile_id: 'P_A', bogus: 1 }), res)
  assert.equal(JSON.parse(res.body).error, 'SCHEMA_COLUMN_UNKNOWN')

  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/nope`, {}), res)
  assert.equal(res.statusCode, 404)

  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/relapse`, { profile_id: 'P_A', event_date: '2026-01-02', symptoms_text: 'x', confirmation_text: null, organs: ['肾脏'], recorder: 'FAMILY' }), res)
  assert.equal(res.statusCode, 201, '确认依据显式 NULL 可写（T3）')
  store.close()
})

test('更正链端点：POST /records/:kind/:id/correct', async () => {
  const store = createStore({ path: join(dir, 'api-correct.sqlite') })
  store.migrate()
  store.insert('profile', { id: 'P_C', name: '更正档案' })
  const api = createApiHandler({ source: store, version, build: 'test' })
  let res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/treatment`, { profile_id: 'P_C', drug: '吗替麦考酚酯胶囊', dose_text: '0.5g bid（原文）', start_date: '2026-10-26', recorder: 'PATIENT' }), res)
  const id = JSON.parse(res.body).row.id
  res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/records/treatment/${id}/correct`, { dose_text: '0.5g bid（更正后原文）' }), res)
  assert.equal(res.statusCode, 201)
  assert.equal(JSON.parse(res.body).row.revision, 2)
  res = mockRes()
  await api(mockReq('GET', `${API_PREFIX}/records/treatment?profileId=P_C`), res)
  assert.equal(JSON.parse(res.body).rows.length, 1, '在用行只有一条')
  store.close()
})

test('saved-trials：POST/GET/DELETE 三态齐、取消零副作用', async () => {
  const store = createStore({ path: join(dir, 'api-trials.sqlite') })
  store.migrate()
  store.insert('profile', { id: 'P_D', name: '收藏档案' })
  const api = createApiHandler({ source: store, version, build: 'test' })
  let res = mockRes()
  await api(mockReq('POST', `${API_PREFIX}/saved-trials`, { profileId: 'P_D', trialKey: 'NCT-DEMO' }), res)
  assert.equal(res.statusCode, 201)
  res = mockRes()
  await api(mockReq('GET', `${API_PREFIX}/saved-trials?profileId=P_D`), res)
  assert.equal(JSON.parse(res.body).rows.length, 1)
  res = mockRes()
  await api(mockReq('DELETE', `${API_PREFIX}/saved-trials?profileId=P_D&trialKey=NCT-DEMO`), res)
  assert.equal(res.statusCode, 200)
  assert.equal(JSON.parse(res.body).rows.length, 0)
  store.close()
})

test('交界守卫：未知路径 JSON 404、错误方法 405、坏 JSON 400', async () => {
  const store = createStore({ path: join(dir, 'api-guard.sqlite') })
  store.migrate()
  const api = createApiHandler({ source: store, version, build: 'test' })
  let res = mockRes()
  await api(mockReq('GET', `${API_PREFIX}/whatever`), res)
  assert.equal(res.statusCode, 404)
  res = mockRes()
  await api(mockReq('DELETE', `${API_PREFIX}/records/lab`), res)
  assert.equal(res.statusCode, 405)
  res = mockRes()
  const badReq = { method: 'POST', url: `${API_PREFIX}/records/lab`, headers: {}, on: (ev, cb) => { if (ev === 'end') cb(); if (ev === 'data') cb(Buffer.from('not-json')) } }
  await api(badReq, res)
  assert.equal(res.statusCode, 400)
  assert.equal(JSON.parse(res.body).error, 'BODY_JSON_INVALID')
  store.close()
})

test('清理临时目录', () => { rmSync(dir, { recursive: true, force: true }) })
