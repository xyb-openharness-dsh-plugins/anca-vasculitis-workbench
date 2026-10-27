/**
 * 解析编排（六部件之四：dsh/parse.js）：读原件 → 调 MinerU → 抽候选 → 落候选层。
 *
 * 与样板仓的差别（本项目 schema 0001 已含 parse_job + candidate 表，G3 冻结）：
 * - 候选**真的落 candidate 表**（不再塞 dataset_state 的 JSON 字段里）；
 * - 解析任务每次一行 parse_job（重试新增一行，旧失败记录保留——18 号 §14 判据）；
 * - `解析中` 不写进 document 状态：document 只有"原件已入库"这一事实。
 *
 * 三态（失败如实）：
 * - 成功：parse_job.status='parsed' + 若干 candidate(status='pending')
 * - 失败：parse_job.status='failed' + error_code 如实（PARSER_UNAVAILABLE / NO_TOKEN / …），**不产候选**
 * - 不支持：parse_job.status='unsupported'（.html/.txt 等不走云端）
 *
 * 确认入事实层走 store.acceptCandidate()（同一写接口、同一列映射，IP9）。
 */
import { createHash } from 'node:crypto'
import { extractLabCandidates, extractDrugMentions, guessReportDate } from './ancaparse.js'
import { MineruError } from './mineru.js'

export class ParseError extends MineruError {}

/** 白名单：.html 上游必拒（-10002）；.txt/.md/.csv 不该走云端解析。 */
export const ALLOWED_EXT = /\.(pdf|jpg|jpeg|png|zip|docx|xlsx)$/i
export const TEXT_EXT = /\.(txt|md|markdown|csv)$/i

/**
 * 解析一份原件并落库。
 * @returns {{document, job, candidates, skipped, note?}}
 */
export async function parseAndRecord(store, { bytes, filename = 'document.pdf', mime = '', profileId, recorder = 'PATIENT', docType = '其他', client = null, parseText = null }) {
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new ParseError('BAD_INPUT', '文件是空的')
  if (!profileId) throw new ParseError('BAD_INPUT', 'profileId 必填')

  /* 原件先入库（无论解析成败，原件永远保留——这是可重试的前提） */
  const sha = createHash('sha256').update(bytes).digest('hex')
  const isText = TEXT_EXT.test(filename)
  const doc = store.insert('document', {
    profile_id: profileId,
    name: filename,
    doc_type: docType,
    doc_date: guessReportDate(filename) ?? new Date().toISOString().slice(0, 10),
    sha256: sha,
    report_quote: isText ? bytes.toString('utf8').slice(0, 300) : null,
    recorder,
    visibility: 'normal',
  })

  /* 文本类：本地抽（不花云端额度）；二进制类：走 MinerU */
  if (isText) {
    const text = typeof parseText === 'function' ? parseText(bytes) : bytes.toString('utf8')
    const job = store.createParseJob({ profileId, documentId: doc.id, sourceKind: 'text', filename, mime, sizeBytes: bytes.length, status: 'queued' })
    return finishWithMarkdown(store, { job, doc, profileId, recorder, markdown: text })
  }

  if (!ALLOWED_EXT.test(filename)) {
    const job = store.createParseJob({
      profileId, documentId: doc.id, sourceKind: 'file', filename, mime, sizeBytes: bytes.length,
      status: 'unsupported', errorCode: 'UNSUPPORTED_TYPE',
      errorText: `暂不支持的类型：${filename}（支持 pdf/jpg/png/zip/docx/xlsx，或 txt/md/csv）`,
    })
    return { document: doc, job, candidates: [], skipped: [], note: '该类型不走云端解析' }
  }

  const job = store.createParseJob({ profileId, documentId: doc.id, sourceKind: 'file', filename, mime, sizeBytes: bytes.length, status: 'queued' })

  if (!client) {
    const failed = store.finishParseJob(job.id, 'failed', 'NO_TOKEN', '未配置 MinerU Token（设置 → 文档解析），原件已保留可重试')
    return { document: doc, job: failed, candidates: [], skipped: [], note: '缺 Token：原件已入库，配置后重试即可' }
  }

  let markdown = ''
  try {
    const parsed = await client.parse({ bytes, filename })
    markdown = parsed.markdown ?? ''
  } catch (error) {
    const code = error?.code || 'PARSE_FAILED'
    const failed = store.finishParseJob(job.id, 'failed', code, String(error?.message || error).slice(0, 300))
    return { document: doc, job: failed, candidates: [], skipped: [], note: `解析失败（${code}）：原件已保留，可重试` }
  }
  return finishWithMarkdown(store, { job, doc, profileId, recorder, markdown })
}

/** 抽候选并落 candidate 表；抽不到也算成功（候选为空是合法结果） */
function finishWithMarkdown(store, { job, doc, profileId, recorder, markdown }) {
  const { candidates, skipped } = extractLabCandidates(markdown)
  const drugs = extractDrugMentions(markdown)
  const created = []
  const date = guessReportDate(markdown) ?? guessReportDate(doc.name) ?? new Date().toISOString().slice(0, 10)

  for (const c of candidates) {
    try {
      const payload = {
        profile_id: profileId,
        marker: c.payload.marker,
        value: c.payload.value,
        unit: c.payload.unit,
        measured_at: date,
        report_quote: c.payload.report_quote,
        recorder,
        visibility: 'normal',
        source_kind: 'ai_candidate',
        source_doc_id: doc.id,
      }
      created.push(store.createCandidate({ profileId, parseJobId: job.id, kind: 'lab', payload, quoteText: c.payload.report_quote }))
    } catch (error) {
      skipped.push({ name: c.payload.marker, cell: c.payload.value_raw, reason: error?.message || '候选校验未过' })
    }
  }
  for (const d of drugs) {
    try {
      created.push(store.createCandidate({
        profileId, parseJobId: job.id, kind: 'note',
        payload: { profile_id: profileId, note_date: date, text: d.payload.text, recorder, visibility: 'normal' },
        quoteText: d.payload.report_quote,
      }))
    } catch { /* 用药提及是附赠线索，落不进去不影响主流程 */ }
  }

  const done = store.finishParseJob(job.id, 'parsed')
  return {
    document: doc, job: done, candidates: created, skipped,
    note: created.length ? `抽出 ${created.length} 条候选，逐项核对后才入库` : '未抽到可识别的化验指标（原件已保留）',
  }
}
