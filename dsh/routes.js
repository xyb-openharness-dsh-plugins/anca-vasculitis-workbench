/**
 * 路由表：独立启动（dev-server）与 DSH 宿主两条链路共用这一份。
 *
 * apiBase 定稿契约（本次随数据层写入面一起定稿）：API_PREFIX = '/api/anca-vasculitis'。
 *
 * 写入面（本次新增，全部走同一契约）：
 *   POST   /records/:kind        12 种 kind 全族（dsh/write-schema.js WRITE_KINDS，
 *                                列名与 schema/0001_initial.sql 逐列一致）；
 *   GET    /records/:kind        列表读（读模型细化在 M5 readmodels，这里只出原始行）；
 *   POST   /saved-trials         35 号收藏（trial_key，无匹配度）；
 *   DELETE /saved-trials         取消收藏（零副作用）；
 *   GET    /saved-trials         收藏清单；
 *   GET    /bootstrap            capabilities：存储模式（sqlite/file 回退）、schema 版本、
 *                                写入契约面（=AI 经同一写接口入库的契约）、端点清单。
 *
 * 交界守卫：校验失败一律 4xx JSON（400/404/405），不裸 throw 变 500；
 * StoreError.code 映射：SCHEMA_KIND_UNKNOWN/COLUMN_UNKNOWN/REQUIRED_MISSING/
 * CHECK_FAILED/DENY_COLUMN/JSON_INVALID → 400；NOT_VERSIONED/ROW_NOT_FOUND → 400。
 * 鉴权不在这里：宿主链路由 dsh/index.js 先过 connection.requestRejection。
 * 这里不许 import Schemastery。
 */
import { WRITE_KINDS, WRITE_KIND_KEYS, DENY_COLUMNS, SCHEMA_VERSION } from './write-schema.js'

export const API_PREFIX = '/api/anca-vasculitis'

function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body), 'utf8')
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': buf.length, 'cache-control': 'no-store' })
  res.end(buf)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 1_000_000) { reject(Object.assign(new Error('body too large'), { code: 'BODY_TOO_LARGE' })); req.destroy(); return }
      chunks.push(c)
    })
    req.on('end', () => {
      if (!chunks.length) return resolve({})
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))) } catch { reject(Object.assign(new Error('invalid JSON body'), { code: 'BODY_JSON_INVALID' })) }
    })
    req.on('error', reject)
  })
}

/** body 读取失败 → 4xx JSON；返回 null 时调用方直接 return */
async function safeBody(req, res) {
  try { return await readBody(req) } catch (error) {
    sendJson(res, error?.code === 'BODY_TOO_LARGE' ? 413 : 400, { error: error?.code || 'BODY_JSON_INVALID', message: error?.message || 'invalid body' })
    return null
  }
}

/** StoreError.code → HTTP 状态（全部 4xx：交界守卫不产 500） */
function statusForError(error) {
  const code = error?.code
  if (code === 'BODY_TOO_LARGE') return 413
  if (code === 'BODY_JSON_INVALID') return 400
  if (code === 'ROW_NOT_FOUND') return 404
  if (typeof code === 'string' && code.startsWith('SCHEMA_')) return 400
  if (code === 'NOT_VERSIONED') return 400
  if (code === 'PATH_REQUIRED' || code === 'SCHEMA_DIR_MISSING' || code === 'SCHEMA_NAME_INVALID' || code === 'MIGRATION_FAILED' || code === 'OPEN_FAILED' || code === 'SCHEMA_VERSION_MISMATCH') return 503
  return 500
}

/**
 * @param {object} opts
 * @param {{insert:Function, correct:Function, list:Function, saveTrial:Function,
 *          unsaveTrial:Function, listSavedTrials:Function, capabilities:Function, close:Function}} opts.source
 */
export function createApiHandler({ source, version, build, failure }) {
  return async function api(req, res) {
    const url = new URL(req.url, 'http://local')
    const path = url.pathname.replace(/\/+$/, '') || '/'
    const method = req.method || 'GET'

    if (path === `${API_PREFIX}/health`) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      return sendJson(res, 200, {
        ok: !failure, failure: failure || undefined, version, apiVersion: 'v1',
        storage: source?.capabilities?.().storage ?? null,
        capabilities: ['health', 'bootstrap', 'records:write', 'saved-trials']
      })
    }

    if (failure) return sendJson(res, 503, { error: 'STORE_OPEN_FAILED', message: failure })

    if (path === `${API_PREFIX}/bootstrap`) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      const cap = source.capabilities()
      return sendJson(res, 200, {
        version, build, apiVersion: 'v1', schemaVersion: SCHEMA_VERSION,
        storage: cap.storage,
        write: {
          base: `${API_PREFIX}/records/`,
          kinds: WRITE_KINDS,
          denyColumns: DENY_COLUMNS,
          note: 'AI 候选入库与手工编辑走同一写接口、同一列映射、同一更正链（IP9）；deny 列永不接受（T1）。'
        },
        endpoints: [
          'GET  /health', 'GET  /bootstrap',
          ...WRITE_KIND_KEYS.map((k) => `POST /records/${k}`),
          ...WRITE_KIND_KEYS.map((k) => `GET  /records/${k}`),
          'POST /saved-trials', 'DELETE /saved-trials', 'GET /saved-trials'
        ]
      })
    }

    if (path === `${API_PREFIX}/saved-trials`) {
      const profileId = url.searchParams.get('profileId')
      const trialKey = url.searchParams.get('trialKey')
      if (method === 'POST') {
        const body = await safeBody(req, res); if (body === null) return
        const pid = body.profileId || profileId
        const key = body.trialKey || trialKey
        if (!pid || !key) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'profileId 与 trialKey 必填' })
        return sendJson(res, 201, { rows: source.saveTrial(pid, key) })
      }
      if (method === 'DELETE') {
        if (!profileId || !trialKey) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'profileId 与 trialKey 必填（query）' })
        return sendJson(res, 200, { rows: source.unsaveTrial(profileId, trialKey) })
      }
      if (method === 'GET') {
        if (!profileId) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'profileId 必填（query）' })
        return sendJson(res, 200, { rows: source.listSavedTrials(profileId) })
      }
      return sendJson(res, 405, { error: 'Method not allowed' })
    }

    const recordMatch = path.match(new RegExp(`^${API_PREFIX}/records/([a-z-]+)$`))
    if (recordMatch) {
      const kind = recordMatch[1]
      if (!WRITE_KINDS[kind]) return sendJson(res, 404, { error: 'SCHEMA_KIND_UNKNOWN', message: `未知写入种类：${kind}` })
      if (method === 'POST') {
        const body = await safeBody(req, res); if (body === null) return
        try {
          const row = source.insert(kind, body)
          return sendJson(res, 201, { row })
        } catch (error) {
          const status = statusForError(error)
          if (status === 500) throw error
          return sendJson(res, status, { error: error.code || 'WRITE_FAILED', message: error.message })
        }
      }
      if (method === 'GET') {
        const profileId = url.searchParams.get('profileId') || undefined
        const includeRetired = url.searchParams.get('includeRetired') === '1'
        try {
          return sendJson(res, 200, { rows: source.list(kind, { profileId, includeRetired }) })
        } catch (error) {
          return sendJson(res, statusForError(error), { error: error.code || 'READ_FAILED', message: error.message })
        }
      }
      return sendJson(res, 405, { error: 'Method not allowed' })
    }

    const correctMatch = path.match(new RegExp(`^${API_PREFIX}/records/([a-z-]+)/([^/]+)/correct$`))
    if (correctMatch) {
      const [, kind, id] = correctMatch
      if (!WRITE_KINDS[kind]) return sendJson(res, 404, { error: 'SCHEMA_KIND_UNKNOWN', message: `未知写入种类：${kind}` })
      if (method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      const body = await safeBody(req, res); if (body === null) return
      try {
        return sendJson(res, 201, { row: source.correct(kind, id, body) })
      } catch (error) {
        const status = statusForError(error)
        if (status === 500) throw error
        return sendJson(res, status, { error: error.code || 'CORRECT_FAILED', message: error.message })
      }
    }

    if (path === API_PREFIX || path.startsWith(`${API_PREFIX}/`)) {
      return sendJson(res, 404, { error: 'Not found', hint: `GET ${API_PREFIX}/bootstrap 查看可用端点` })
    }
    return sendJson(res, 404, { error: 'Not found' })
  }
}
