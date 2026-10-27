/**
 * 试验线索读模型（35 号 · 三态）：
 *   命中（结构化 / 文本 / 宽口径）→ 无法自动匹配（逐条列原因）→ 不产出"不适用"。
 *
 * 三条硬规矩（与 docs/35-TRIAL-MATCHING.md 一致，不因数据变少而放松）：
 * 1. 只出**带证据的线索**，绝不产出数值匹配度（任何数值化「匹配度」字段一律不落库、不出接口）；
 * 2. 缺字段判"无法自动匹配"，**不判"不适用"**——工作台永不写"你不适合 / 你能入组"；
 * 3. 每条结果固定带：来源通道与终态、snapshotDate、"登记状态，未核实"、登记≠有效≠可入组声明。
 *
 * 数据来源：research/anca-vasculitis/ 四件套（本地快照，随附 snapshotDate 与"快照会过期"提示）。
 * 本读模型只读快照，不联网；在线通道（unified-trial-mcp）属采集侧（scripts/fetch-anca-trials-2026.mjs）。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

export const PACK_DIR = fileURLToPath(new URL('../research/anca-vasculitis/', import.meta.url))

const STALE_DAYS = 180

/** 快照元信息（manifest）：供 bootstrap 与界面提示"快照什么时候采的、覆盖了哪些来源" */
export function snapshotMeta(dir = PACK_DIR) {
  const p = join(dir, 'manifest.json')
  if (!existsSync(p)) return { available: false, reason: '数据包未生成（research/anca-vasculitis/manifest.json 缺失）' }
  const m = JSON.parse(readFileSync(p, 'utf8'))
  const ageDays = Math.round((Date.now() - Date.parse(m.snapshotDate)) / 86400000)
  return {
    available: true,
    snapshotDate: m.snapshotDate,
    ageDays,
    stale: ageDays > STALE_DAYS,
    recordCount: m.recordCount,
    coverage: m.coverage ?? null,
    sourceStates: m.sourceStates ?? {},
    needsHumanReview: m.needsHumanReview ?? [],
    caveat: m.relevance?.caveat ?? '',
    packDir: dir,
  }
}

/** 读快照记录（只读；DB 不可用时回退 jsonl） */
export function loadTrials(dir = PACK_DIR) {
  const db = join(dir, 'anca_trials_2026.sqlite')
  if (existsSync(db)) {
    try {
      const conn = new DatabaseSync(db, { readOnly: true })
      const rows = conn.prepare('SELECT * FROM trials ORDER BY record_id').all()
      conn.close()
      return rows.map((r) => ({
        recordId: r.record_id,
        title: r.title,
        studyType: r.study_type,
        sponsors: safeJson(r.sponsors),
        registryNumbers: safeJson(r.registry_numbers),
        dates: safeJson(r.dates),
        sourceUrl: r.source_url,
        sourceId: r.source_id,
        statusNote: r.status_note,
        snapshotDate: r.snapshot_date,
        relevanceHits: safeJson(r.relevance_hits) ?? [],
        matchedQuery: r.matched_query,
      }))
    } catch { /* 落到 jsonl */ }
  }
  const jl = join(dir, 'trials-2026.jsonl')
  if (!existsSync(jl)) return []
  return readFileSync(jl, 'utf8').split('\n').filter(Boolean).map((l) => {
    const r = JSON.parse(l)
    return { ...r, relevanceHits: r.relevanceHits ?? [] }
  })
}

const safeJson = (v) => { if (!v) return null; try { return JSON.parse(v) } catch { return null } }

/**
 * 分层匹配（结构化 > 文本 > 宽口径）。建档值只取"已确认入库"的字段（调用方保证）。
 * @param {object} profile  { subtypeText, serologyText }（只作原文比对，不做判定）
 * @param {Array} trials    loadTrials() 结果
 */
export function matchTrials(profile, trials, meta) {
  const subtype = String(profile?.subtypeText ?? '')
  const serology = String(profile?.serologyText ?? '')
  const subtypeTerms = ['GPA', 'MPA', 'EGPA', '肉芽肿性多血管炎', '显微镜下多血管炎', '嗜酸性肉芽肿性多血管炎']
    .filter((t) => subtype.toUpperCase().includes(t.toUpperCase()))
  const seroTerms = ['PR3', 'MPO'].filter((t) => serology.toUpperCase().includes(t))

  const hits = [], unmatched = []
  for (const t of trials) {
    const hay = `${t.title ?? ''} ${t.sourceUrl ?? ''}`
    const structured = []
    if (seroTerms.length && seroTerms.some((s) => hay.toUpperCase().includes(`ANCA`) || hay.toUpperCase().includes(s))) {
      /* 抗体型只在登记文本出现 ANCA 语境时才算结构化命中（避免把 PR3 当任意词命中） */
      if (hay.toUpperCase().includes('ANCA')) structured.push(`抗体语境命中：${seroTerms.join('/')}（本地已建档）`)
    }
    const text = subtypeTerms.filter((s) => hay.toUpperCase().includes(s.toUpperCase()))
    const broad = /vasculitis|血管炎/i.test(hay) ? ['宽口径词：vasculitis/血管炎'] : []
    const layer = structured.length ? 'structured' : (text.length ? 'text' : (broad.length ? 'broad' : null))
    if (!layer) { continue }
    hits.push({
      recordId: t.recordId,
      title: t.title,
      sourceUrl: t.sourceUrl,
      layer,
      evidence: [...structured, ...(text.length ? [`命中词：${text.join('、')}（登记文本）`] : []), ...broad],
      channel: `本地快照 · ${t.sourceId}`,
      terminalState: 'SUCCESS（快照内已采）',
      statusNote: t.statusNote ?? '登记状态，未核实',
      snapshotDate: t.snapshotDate ?? meta?.snapshotDate,
      registryNumbers: t.registryNumbers ?? null,
      dates: t.dates ?? null,
      needsHumanReview: (meta?.needsHumanReview ?? []).some((x) => x.recordId === t.recordId),
    })
  }
  /* 无法自动匹配：缺哪些本地字段，逐条列（不判"不适用"） */
  const missing = []
  if (!subtypeTerms.length) missing.push({ item: '临床亚型（GPA/MPA/EGPA）', reason: '本地档案未填写亚型原文；无法按亚型比对登记条件' })
  if (!seroTerms.length) missing.push({ item: 'ANCA 血清型（PR3/MPO）', reason: '本地档案未填写血清型原文；无法按抗体比对登记条件' })
  missing.push({ item: '受累器官量化评分', reason: '本地未建档对应结构化字段' })
  missing.push({ item: '既往免疫抑制累积剂量', reason: '本地剂量为医嘱原文文本，未结构化' })
  missing.push({ item: '入组/排除标准逐条对照', reason: '本台只做线索分层，不解析登记条件全文' })

  const order = { structured: 0, text: 1, broad: 2 }
  hits.sort((a, b) => order[a.layer] - order[b.layer])
  return {
    hits,
    unmatched: missing,
    disclaimer: '登记状态 ≠ 有效 ≠ 可入组；是否适合由医生与研究中心判定。本台不产出数值匹配度，也不写"不适用"。',
    snapshotDate: meta?.snapshotDate ?? null,
    staleNote: meta?.stale ? `快照已 ${meta.ageDays} 天，可能过期` : null,
    channelNote: '渠道：本地快照（只读）。在线通道由采集侧 scripts/fetch-anca-trials-2026.mjs 更新快照。',
  }
}

/** 一步到位：快照元信息 + 匹配（供 routes 直接调用） */
export function trialMatches(profile, dir = PACK_DIR) {
  const meta = snapshotMeta(dir)
  if (!meta.available) {
    return { available: false, reason: meta.reason, hits: [], unmatched: [], disclaimer: '' }
  }
  const trials = loadTrials(dir)
  return { available: true, meta, ...matchTrials(profile, trials, meta) }
}
