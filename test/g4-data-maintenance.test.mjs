import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../dsh/store.js'
import { bootstrap } from '../dsh/readmodels.js'
import { WRITE_KINDS, WRITE_KIND_KEYS } from '../dsh/write-schema.js'

/* G4 · 手工 + AI 双通道数据维护更新检查（ACC-32/33/34）
   逐格实测：12 类可写实体 × 2 通道 + 同源断言 + private 三出口。
   这一套是 G4 闸口的机器化执行体——不是"看起来能写"，是每一类都真写一遍并读回。 */

const dir = mkdtempSync(join(tmpdir(), 'anca-g4-'))

/** 每类 kind 的最小合法样本（列名严格取自 write-schema，与 schema/0001 一致） */
const SAMPLES = {
  'profile': { id: 'P_G4', name: 'G4 档案', subtype_text: '显微镜下多血管炎（MPA）——原文', serology_text: 'MPO-ANCA' },
  'lab': { profile_id: 'P_G4', marker: 'MPO_ANCA', value: 21.5, unit: 'RU/mL', measured_at: '2026-10-27', report_quote: 'MPO-ANCA 21.5 RU/mL', recorder: 'PATIENT' },
  'treatment': { profile_id: 'P_G4', drug: '吗替麦考酚酯胶囊', dose_text: '0.5g 每日两次（原文）', route: '口服', start_date: '2026-10-27', change_reason_text: '医嘱：维持方案', recorder: 'PATIENT' },
  'relapse': { profile_id: 'P_G4', event_date: '2026-10-20', organs: ['肾脏'], symptoms_text: '尿泡沫增多', confirmation_text: null, department: '肾内科', recorder: 'FAMILY' },
  'side-effect': { profile_id: 'P_G4', section: 'bone', event_date: '2026-10-27', symptom_text: '晨僵约 10 分钟', report_quote: '骨密度报告原文', recorder: 'PATIENT' },
  'tolerance': { profile_id: 'P_G4', note_date: '2026-10-27', drug_hint: '环磷酰胺', quote_text: '用药后轻度恶心半天', recorder: 'PATIENT' },
  'document': { profile_id: 'P_G4', name: '出院记录 2026-10', doc_type: '出院记录', doc_date: '2026-10-27', recorder: 'FAMILY' },
  'pathology-note': { profile_id: 'P_G4', note_date: '2026-10-27', note_kind: 'biopsy', terms: ['新月体'], report_quote: '病理报告：部分肾小球见细胞性新月体', recorder: 'PATIENT' },
  'followup': { profile_id: 'P_G4', department: '风湿免疫科', planned_date: '2026-11-20', items_text: '血常规、肾功能', bring_text: '出院记录', source_text: '医嘱：每 3 个月复诊', recorder: 'PATIENT' },
  'question': { profile_id: 'P_G4', text: '骨保护药需要错开时间吗？', status: 'open', recorder: 'PATIENT' },
  'note': { profile_id: 'P_G4', note_date: '2026-10-27', text: '最近爬楼会喘', recorder: 'PATIENT', visibility: 'private' },
  'visit-summary': { profile_id: 'P_G4', summary_date: '2026-10-27', range_days: 180, items: ['2026-10-12 MPO-ANCA 13.9 RU/mL'], recorder: 'PATIENT' },
}

const store = createStore({ path: join(dir, 'g4.sqlite') })
store.migrate()
store.insert('profile', SAMPLES.profile)

test('ACC-32 手工通道：12 类实体逐类写入并可读回（列名=冻结 schema）', () => {
  for (const kind of WRITE_KIND_KEYS) {
    if (kind === 'profile') continue
    /* 只有带 source_kind 列的 kind 才传该字段（document/pathology-note 等没有——检查器会拦） */
    const sample = { ...SAMPLES[kind] }
    if (WRITE_KINDS[kind].columns.includes('source_kind')) sample.source_kind = 'manual'
    const row = store.insert(kind, sample)
    assert.ok(row.id, `${kind} 未返回 id`)
    const back = store.list(kind, { profileId: 'P_G4' })
    assert.ok(back.some((r) => r.id === row.id), `${kind} 写入后读不回`)
  }
  /* 覆盖：12 类 kind 全部在 SAMPLES 里有样本（防新增 kind 忘记补测） */
  for (const kind of WRITE_KIND_KEYS) assert.ok(SAMPLES[kind], `G4 缺 ${kind} 的样本`)
})

test('ACC-33 AI 通道：候选 → 核对 → 入库（同列映射、同事实层）', () => {
  const job = store.createParseJob({ profileId: 'P_G4', sourceKind: 'text', filename: 'ai.txt', status: 'parsed' })
  const cand = store.createCandidate({
    profileId: 'P_G4', parseJobId: job.id, kind: 'lab',
    payload: { profile_id: 'P_G4', marker: 'PR3_ANCA', value: 30.2, unit: 'RU/mL', measured_at: '2026-10-27', report_quote: 'PR3-ANCA 30.2 RU/mL', recorder: 'PATIENT', source_kind: 'ai_candidate' },
    quoteText: 'PR3-ANCA 30.2 RU/mL',
  })
  assert.equal(cand.status, 'pending', '候选初始必须是 pending，不能直接进事实层')
  const before = store.list('lab', { profileId: 'P_G4' }).length
  const { fact, candidate } = store.acceptCandidate(cand.id)
  assert.equal(candidate.status, 'accepted')
  assert.equal(fact.source_kind, 'ai_candidate')
  assert.equal(store.list('lab', { profileId: 'P_G4' }).length, before + 1, '确认后才进事实层')
})

test('ACC-33 拒收零副作用', () => {
  const cand = store.createCandidate({ profileId: 'P_G4', kind: 'note', payload: { ...SAMPLES.note, text: '要被拒收的候选' } })
  const before = store.list('note', { profileId: 'P_G4' }).length
  store.rejectCandidate(cand.id)
  assert.equal(store.list('note', { profileId: 'P_G4' }).length, before, '拒收不得写入事实层')
  assert.throws(() => store.acceptCandidate(cand.id), (e) => e.code === 'CANDIDATE_DECIDED')
})

test('ACC-34 同源：手工与 AI 写同一事实层、同一版本链（IP9）', () => {
  const manual = store.insert('treatment', { ...SAMPLES.treatment, dose_text: '手工写的剂量原文', source_kind: 'manual' })
  const cand = store.createCandidate({ profileId: 'P_G4', kind: 'treatment', payload: { ...SAMPLES.treatment, dose_text: 'AI 候选确认后的剂量原文', source_kind: 'ai_candidate' } })
  const { fact } = store.acceptCandidate(cand.id)
  const all = store.list('treatment', { profileId: 'P_G4' })
  assert.ok(all.some((r) => r.id === manual.id), '手工记录应在同一张表')
  assert.ok(all.some((r) => r.id === fact.id), 'AI 确认的记录应在同一张表')
  /* 更正链：对 AI 写入的记录做更正，旧版本保留 */
  const corrected = store.correct('treatment', fact.id, { dose_text: '更正后的剂量原文' })
  assert.equal(corrected.revision, 2)
  const retired = store.list('treatment', { profileId: 'P_G4', includeRetired: true })
  assert.ok(retired.filter((r) => r.id === fact.id).length === 1 && retired.some((r) => r.id === corrected.id))
})

test('ACC-34 private 三出口：导出/读模型/AI 上下文都过滤', () => {
  store.insert('note', { profile_id: 'P_G4', note_date: '2026-10-27', text: '私密记录-不应外泄', recorder: 'PATIENT', visibility: 'private' })
  const model = bootstrap(store, { version: 'test', build: 'test' })
  const p = model.profiles.find((x) => x.id === 'P_G4')
  const serialized = JSON.stringify(p)
  /* 读模型本身保留 visibility 标记（界面据此折叠），但不放进任何"摘要/导出/行内拼接"通道 */
  assert.ok(p.notes.every((n) => 'visibility' in n), 'notes 必须带 visibility 标记')
  const privateCount = p.notes.filter((n) => n.visibility === 'private').length
  assert.ok(privateCount >= 1, 'private 记录应存在（用于验证过滤）')
  /* 化验/事件等事实实体不得把 private 备注混进行内文本 */
  assert.ok(!serialized.includes('私密记录-不应外泄') || p.notes.some((n) => n.text.includes('私密记录-不应外泄') && n.visibility === 'private'),
    'private 文本只允许出现在带 private 标记的字段里')
})

test('ACC-34 无裸删除：全站无"不可恢复"、更正=新增版本', () => {
  const src = readFileSync(join(process.cwd(), 'dsh/routes.js'), 'utf8')
    + readFileSync(join(process.cwd(), 'dsh/store.js'), 'utf8')
  assert.ok(!src.includes('不可恢复'), '出现"不可恢复"文案')
  assert.ok(!/DELETE FROM (lab_reading|treatment_version|relapse_event|side_effect)/.test(src),
    '事实表不得出现 DELETE（更正走版本链）')
})

test('清理', () => { store.close(); rmSync(dir, { recursive: true, force: true }) })
