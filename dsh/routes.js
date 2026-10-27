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
import { createHash } from 'node:crypto'
import { WRITE_KINDS, WRITE_KIND_KEYS, DENY_COLUMNS, SCHEMA_VERSION, MARKER_NAMES } from './write-schema.js'
import { snapshotMeta, trialMatches } from './trials.js'
import { bootstrap } from './readmodels.js'
import { mineruSettingsStatus, saveMineruToken, clearMineruToken } from './settings.js'
import { createMineruClient, maskToken } from './mineru.js'
import { parseAndRecord } from './parse.js'

export const API_PREFIX = '/api/anca-vasculitis'
export const UI_PREFIX = `${API_PREFIX}/ui`

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
  if (code === 'CANDIDATE_DECIDED') return 409
  if (typeof code === 'string' && code.startsWith('SCHEMA_')) return 400
  if (code === 'NOT_VERSIONED') return 400
  if (code === 'PATH_REQUIRED' || code === 'SCHEMA_DIR_MISSING' || code === 'SCHEMA_NAME_INVALID' || code === 'MIGRATION_FAILED' || code === 'OPEN_FAILED' || code === 'SCHEMA_VERSION_MISMATCH') return 503
  return 500
}

/* ---------------- 摄取管线（18 号 v2 前置）：文件/拍照/文本 → parse_job → 候选 ----------------
 * 内置轻解析只做诚实的小事：纯文本/Markdown/CSV 抽取为候选；PDF/图片在本阶段如实返回
 * FAILED(PARSER_UNAVAILABLE)——真 MinerU 六部件在 M5 接入，FAILED 不计覆盖、不冒充已解析。
 * 候选确认走 /candidates/:id/accept → 同一 insert 写事实层（IP9）。 */
const TEXT_EXTS = new Set(['.txt', '.md', '.markdown', '.csv'])
const NEEDS_MINERU = new Set(['.pdf', '.jpg', '.jpeg', '.png', '.heic', '.tiff', '.doc', '.docx'])

function parseCsvToLabCandidates(text, { profileId, recorder }) {
  const out = []
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  for (const line of lines) {
    if (/^(日期|date)/i.test(line)) continue   // 表头行
    const cells = line.split(/[,，\t]/).map((c) => c.trim())
    if (cells.length < 4) continue
    const [d, nameRaw, valueRaw, unit, lab] = cells
    const marker = MARKER_NAMES[nameRaw] || MARKER_NAMES[nameRaw.replace(/\s+/g, '')]
    if (!marker) continue
    const value = Number(valueRaw)
    if (!Number.isFinite(value) || !/\d{4}-\d{2}-\d{2}/.test(d)) continue
    out.push({ profile_id: profileId, marker, value, unit: unit || '', measured_at: d, lab_name: lab || '', report_quote: line, recorder: recorder || 'PATIENT', source_kind: 'import' })
  }
  return out
}

async function handleParse(req, res, source, url) {
  const body = await safeBody(req, res); if (body === null) return
  const profileId = body.profileId
  if (!profileId) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'profileId 必填' })
  const filename = String(body.filename || '粘贴文本.txt')
  const mime = String(body.mime || '')
  const recorder = CHECKS_OK.recorder.includes(body.recorder) ? body.recorder : 'PATIENT'
  let buf = null
  let text = null
  if (typeof body.text === 'string') {
    text = body.text
    buf = Buffer.from(text, 'utf8')
  } else if (typeof body.contentBase64 === 'string') {
    buf = Buffer.from(body.contentBase64, 'base64')
    text = buf.toString('utf8')
  } else {
    return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: '提供 text 或 contentBase64 之一' })
  }
  if (buf.length > 10 * 1024 * 1024) return sendJson(res, 413, { error: 'BODY_TOO_LARGE', message: '文件超过 10MB（真机走资料目录导入，不经接口塞字节）' })

  const dot = filename.lastIndexOf('.')
  const ext = dot >= 0 ? filename.slice(dot).toLowerCase() : ''
  const docType = CHECKS_OK.doc_type.includes(body.docType) ? body.docType : '其他'
  const doc = source.insert('document', {
    profile_id: profileId, name: filename, doc_type: docType, doc_date: body.docDate || new Date().toISOString().slice(0, 10),
    sha256: createHash('sha256').update(buf).digest('hex'), report_quote: (text || '').slice(0, 300) || null, recorder, visibility: 'normal',
  })

  if (NEEDS_MINERU.has(ext) || /pdf|image/i.test(mime)) {
    const job = source.createParseJob({ profileId, documentId: doc.id, sourceKind: ext === '.pdf' ? 'file' : 'photo', filename, mime, sizeBytes: buf.length, status: 'failed', errorCode: 'PARSER_UNAVAILABLE', errorText: 'PDF/图片解析需要 MinerU 六部件（M5 接入）；本阶段如实记录 FAILED，不冒充已解析' })
    return sendJson(res, 202, { job, document: doc, candidates: [], note: '已存原件并登记解析任务（FAILED 如实）；M5 接 MinerU 后同一端点产出候选' })
  }
  if (!TEXT_EXTS.has(ext)) {
    const job = source.createParseJob({ profileId, documentId: doc.id, sourceKind: 'file', filename, mime, sizeBytes: buf.length, status: 'unsupported', errorText: `暂不支持的类型：${ext || '(无扩展名)'}` })
    return sendJson(res, 202, { job, document: doc, candidates: [] })
  }

  const job = source.createParseJob({ profileId, documentId: doc.id, sourceKind: ext === '.csv' ? 'file' : 'text', filename, mime, sizeBytes: buf.length, status: 'queued' })
  let candidates = []
  try {
    if (ext === '.csv') {
      const rows = parseCsvToLabCandidates(text, { profileId, recorder })
      candidates = rows.map((r) => source.createCandidate({ profileId, parseJobId: job.id, kind: 'lab', payload: r, quoteText: r.report_quote }))
    } else {
      const snippet = text.replace(/\s+/g, ' ').trim().slice(0, 400)
      candidates = snippet ? [source.createCandidate({ profileId, parseJobId: job.id, kind: 'note', payload: { profile_id: profileId, note_date: body.docDate || new Date().toISOString().slice(0, 10), text: snippet, recorder, visibility: 'normal' }, quoteText: snippet.slice(0, 120) })] : []
    }
    source.finishParseJob(job.id, 'parsed')
  } catch (error) {
    source.finishParseJob(job.id, 'failed', error.code || 'PARSE_FAILED', error.message)
    return sendJson(res, 202, { job: source.getParseJob(job.id), document: doc, candidates, note: '解析部分失败（如实）' })
  }
  return sendJson(res, 201, { job: source.getParseJob(job.id), document: doc, candidates })
}

/** 路由内部用的枚举表（与 WRITE_KINDS.checks 同源，避免 import Schemastery） */
const CHECKS_OK = {
  recorder: ['PATIENT', 'FAMILY'],
  doc_type: ['检查报告', '病理报告', '影像报告', '门诊记录', '出院记录', '住院记录', '处方', '个人材料', '其他'],
}

/**
 * @param {object} opts
 * @param {{insert:Function, correct:Function, list:Function, saveTrial:Function,
 *          unsaveTrial:Function, listSavedTrials:Function, capabilities:Function, close:Function}} opts.source
 */
export function createApiHandler({ source, version, build, failure, serveUi }) {
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

    /* UI 静态（public/）：/ui/ 前缀交给 serveUi；缺它时回 404 JSON，不返回 HTML */
    if (path === `${API_PREFIX}/ui` || path.startsWith(`${API_PREFIX}/ui/`)) {
      if (method !== 'GET' && method !== 'HEAD') return sendJson(res, 405, { error: 'Method not allowed' })
      if (!serveUi) return sendJson(res, 404, { error: 'UI_NOT_BUILT', hint: 'public/ 未生成：先跑 node scripts/build-public.mjs' })
      /* 传 /ui/ 之后的相对路径（'/app.js'）；servePublic 内部再拼 public/ */
      const rel = url.pathname.slice(`${API_PREFIX}/ui`.length) || '/'
      return serveUi(req, res, rel)
    }

    if (path === `${API_PREFIX}/bootstrap`) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      const cap = source.capabilities()
      const model = bootstrap(source, { version, build })
      return sendJson(res, 200, {
        ...model,
        version, build, apiVersion: 'v1', schemaVersion: SCHEMA_VERSION,
        storage: cap.storage,
        write: {
          base: `${API_PREFIX}/records/`,
          kinds: WRITE_KINDS,
          denyColumns: DENY_COLUMNS,
          note: 'AI 候选入库与手工编辑走同一写接口、同一列映射、同一更正链（IP9）；deny 列永不接受（T1）。'
        },
        endpoints: [
          'GET  /health', 'GET  /bootstrap', 'POST /parse（文件/拍照/文本 → 候选；PDF/图片 M5 接 MinerU）',
          'GET  /candidates', 'POST /candidates/:id/accept', 'POST /candidates/:id/reject',
          'GET/POST /settings/mineru（Token 状态/保存/清除）',
          'POST /parse/document（PDF/图片 → MinerU → 候选；文本类本地抽）',
          ...WRITE_KIND_KEYS.map((k) => `POST /records/${k}`),
          ...WRITE_KIND_KEYS.map((k) => `GET  /records/${k}`),
          'GET  /trials（35 号三态：命中/无法自动匹配；不产出"不适用"）',
          'GET  /trials/snapshot（快照日期、覆盖来源、待人工复核）',
          'POST /saved-trials', 'DELETE /saved-trials', 'GET /saved-trials'
        ]
      })
    }

    if (path === `${API_PREFIX}/parse`) {
      if (method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      return handleParse(req, res, source, url)
    }

    if (path === `${API_PREFIX}/candidates`) {
      if (method === 'GET') {
        const profileId = url.searchParams.get('profileId') || undefined
        const status = url.searchParams.get('status') || undefined
        return sendJson(res, 200, { rows: source.listCandidates({ profileId, status }) })
      }
      return sendJson(res, 405, { error: 'Method not allowed' })
    }

    const candMatch = path.match(new RegExp(`^${API_PREFIX}/candidates/([^/]+)/(accept|reject)$`))
    if (candMatch) {
      if (method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      try {
        const result = candMatch[2] === 'accept'
          ? source.acceptCandidate(candMatch[1])
          : { candidate: source.rejectCandidate(candMatch[1]) }
        return sendJson(res, 200, result)
      } catch (error) {
        const status = statusForError(error)
        if (status === 500) throw error
        return sendJson(res, status, { error: error.code || 'CANDIDATE_FAILED', message: error.message })
      }
    }

    /* ---- MinerU 设置（18 号 §5：GET 给状态、POST 存/清；响应体永不回显 token） ---- */
    if (path === `${API_PREFIX}/settings/mineru`) {
      if (method === 'GET') {
        const st = mineruSettingsStatus()
        return sendJson(res, 200, {
          configured: st.configured, source: st.source, masked: st.masked ?? null,
          path: st.path ?? null, tokenUrl: 'https://mineru.net/apiManage/token',
          note: st.configured ? '已配置：解析走 MinerU 云端' : '未配置：PDF/图片导入会如实 FAILED(NO_TOKEN)，原件仍会入库',
        })
      }
      if (method === 'POST') {
        const body = await safeBody(req, res); if (body === null) return
        try {
          if (body.clear === true) {
            clearMineruToken(body)
            return sendJson(res, 200, { ok: true, cleared: true, configured: false })
          }
          if (typeof body.token !== 'string' || !body.token.trim()) {
            return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'token 必填（或传 clear:true 清除）' })
          }
          saveMineruToken(body.token.trim(), body)
          const st = mineruSettingsStatus()
          return sendJson(res, 200, { ok: true, configured: st.configured, masked: st.masked ?? null })
        } catch (error) {
          const status = /TOKEN_INVALID|TOKEN_FORMAT/.test(String(error?.code)) ? 400 : 500
          return sendJson(res, status, { error: error?.code || 'SETTINGS_FAILED', message: String(error?.message || error).slice(0, 200) })
        }
      }
      return sendJson(res, 405, { error: 'Method not allowed' })
    }

    /* ---- 解析任务（18 号六部件之四）：文件/拍照 → parse_job → candidate ---- */
    if (path === `${API_PREFIX}/parse/document`) {
      if (method !== 'POST') return sendJson(res, 405, { error: 'Method not allowed' })
      const body = await safeBody(req, res); if (body === null) return
      const profileId = body.profileId
      if (!profileId) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: 'profileId 必填' })
      let bytes = null
      if (typeof body.contentBase64 === 'string') bytes = Buffer.from(body.contentBase64, 'base64')
      else if (typeof body.text === 'string') bytes = Buffer.from(body.text, 'utf8')
      if (!bytes || !bytes.length) return sendJson(res, 400, { error: 'VALIDATION_FAILED', message: '提供 contentBase64 或 text' })
      if (bytes.length > 30 * 1024 * 1024) return sendJson(res, 413, { error: 'BODY_TOO_LARGE', message: '单文件上限 30MB' })

      const st = mineruSettingsStatus()
      const client = st.configured ? createMineruClient() : null
      try {
        const result = await parseAndRecord(source, {
          bytes,
          filename: String(body.filename || 'document.pdf'),
          mime: String(body.mime || ''),
          profileId,
          recorder: ['PATIENT', 'FAMILY'].includes(body.recorder) ? body.recorder : 'PATIENT',
          docType: ['检查报告', '病理报告', '影像报告', '门诊记录', '出院记录', '住院记录', '处方', '个人材料', '其他'].includes(body.docType) ? body.docType : '其他',
          client,
        })
        const failed = ['failed', 'unsupported'].includes(result.job.status)
        return sendJson(res, failed ? 202 : 201, result)
      } catch (error) {
        const status = statusForError(error)
        if (status === 500) return sendJson(res, 400, { error: error.code || 'PARSE_FAILED', message: String(error.message || error).slice(0, 200) })
        return sendJson(res, status, { error: error.code || 'PARSE_FAILED', message: error.message })
      }
    }

    /* 35 号三态：线索分层 + 无法自动匹配 + 不产出"不适用"；不产出数值匹配度 */
    if (path === `${API_PREFIX}/trials`) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      const profileId = url.searchParams.get('profileId')
      const rows = profileId ? source.list('profile', { profileId }) : []
      const profile = rows[0] || {}
      const result = trialMatches(profile)
      return sendJson(res, 200, result)
    }

    if (path === `${API_PREFIX}/trials/snapshot`) {
      if (method !== 'GET') return sendJson(res, 405, { error: 'Method not allowed' })
      return sendJson(res, 200, snapshotMeta())
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
