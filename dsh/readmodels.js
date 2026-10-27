/**
 * 读模型（M5 · slice 2）：把库里的行拼成前端需要的 bootstrap 形状。
 *
 * 形状与 prototypes/v0.2/demo-data.js 的 DEMO_DATA **逐字段一致**——
 * 这样 public/app.js 不需要为开发版改任何视图函数（parity：原型与开发版同一份渲染代码）。
 *
 * 红线（T1–T7）在这个文件里守：
 * - 不产出任何判定字段（复发/缓解/控制/风险/匹配度）；
 * - PR3 与 MPO 分列返回（labs 对象按 marker 分组），滴度与肾功/尿检分轨；
 * - 副作用按 section 分节返回，**不进趋势**（趋势数据只走 MARKERS 白名单）；
 * - 只返回在用版本（in_use=1）；更正链历史由 /records 接口按 includeRetired 取。
 */
import { CHECKS } from './write-schema.js'

/** 指标白名单（与 schema/0001 的 marker CHECK 枚举同源；趋势只认这些数值型检验） */
export const MARKERS = Object.fromEntries(CHECKS.marker.map((m) => [m, { code: m }]))

const SIDE_SECTIONS = ['bone', 'glucose', 'infection', 'eye', 'other']

const safeJson = (v, fallback = null) => { if (!v) return fallback; try { return JSON.parse(v) } catch { return fallback } }
const isoDate = (d) => (d ? String(d).slice(0, 10) : null)

/** 化验：按 marker 分组（T2 分列） */
function groupLabs(rows) {
  const out = {}
  for (const m of Object.keys(MARKERS)) out[m] = []
  for (const r of rows) {
    if (!out[r.marker]) out[r.marker] = []
    out[r.marker].push({
      id: r.id, d: isoDate(r.measured_at), v: r.value, unit: r.unit,
      lab: r.lab_name ?? '', method: r.method ?? '', quote: r.report_quote ?? '',
      recorder: r.recorder, visibility: r.visibility, revision: r.revision,
    })
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => (a.d < b.d ? -1 : 1))
  return out
}

/** 副作用：按 section 分节（T5，不进趋势） */
function groupSideEffects(rows) {
  const out = Object.fromEntries(SIDE_SECTIONS.map((s) => [s, []]))
  for (const r of rows) {
    const key = SIDE_SECTIONS.includes(r.section) ? r.section : 'other'
    out[key].push({
      id: r.id, d: isoDate(r.event_date), text: r.symptom_text,
      quote: r.report_quote ?? '', src: r.test_text ?? '',
      recorder: r.recorder, visibility: r.visibility, revision: r.revision,
    })
  }
  for (const k of Object.keys(out)) out[k].sort((a, b) => (a.d < b.d ? -1 : 1))
  return out
}

/**
 * @param {object} store  dsh/store.js 的实例（list/insert/listSavedTrials）
 * @param {object} opts   { version, build, today }
 */
export function bootstrap(store, { version, build, today } = {}) {
  const now = today || new Date().toISOString().slice(0, 10)
  const profiles = store.list('profile')
  if (!profiles.length) {
    return { meta: { today: now, version, build, empty: true }, profiles: [], trialSnapshot: null,
      note: '本机资料目录为空：请先在「病情整理 → 病情档案」建档，或导入既有资料。' }
  }

  const out = profiles.map((p) => {
    const pid = p.id
    const labs = store.list('lab', { profileId: pid })
    const treat = store.list('treatment', { profileId: pid })
    const relapse = store.list('relapse', { profileId: pid })
    const side = store.list('side-effect', { profileId: pid })
    const docs = store.list('document', { profileId: pid })
    const pathNotes = store.list('pathology-note', { profileId: pid })
    const followups = store.list('followup', { profileId: pid })
    const questions = store.list('question', { profileId: pid })
    const notes = store.list('note', { profileId: pid })

    const pathology = pathNotes.filter((x) => x.note_kind === 'biopsy').map((x) => ({
      id: x.id, type: '肾活检', d: isoDate(x.note_date), terms: safeJson(x.terms, []), quote: x.report_quote, src: x.report_quote, visibility: x.visibility,
    }))
    const imaging = pathNotes.filter((x) => x.note_kind === 'imaging').map((x) => ({
      id: x.id, type: '影像', d: isoDate(x.note_date), quote: x.report_quote, src: x.report_quote, visibility: x.visibility,
    }))

    return {
      id: pid,
      name: p.name,
      age: p.birth_date ? Math.max(0, new Date(now).getFullYear() - Number(String(p.birth_date).slice(0, 4))) : null,
      sex: p.gender ?? '',
      subtypeText: p.subtype_text ?? '（未填写原文）',
      serologyText: p.serology_text ?? '（未填写原文）',
      dxDate: p.dx_date ?? null,
      meta: p.caregiver_label ? `照护者：${p.caregiver_label}` : '仅本人记录',
      caregiverLabel: p.caregiver_label ?? '',
      caregiver: p.caregiver_label ?? '',
      labQuoteNote: '检测方法与单位随各院报告原文；本台不换算、不判定。',
      labs: groupLabs(labs),
      treatmentVersions: treat.map((t) => ({
        id: t.id, drug: t.drug, dose: t.dose_text, route: t.route ?? '',
        start: isoDate(t.start_date), end: isoDate(t.end_date), reason: t.change_reason_text ?? '',
        source: t.source_label ?? '', recorder: t.recorder, visibility: t.visibility,
      })),
      /* T3：复发事件独立档案，只有事实与依据原文，无判定字段 */
      relapseEvents: relapse.map((r) => ({
        id: r.id, d: isoDate(r.event_date), organs: safeJson(r.organs, []),
        symptoms: r.symptoms_text, confirm: r.confirmation_text ?? '', dept: r.department ?? '',
        recorder: r.recorder, visibility: r.visibility, quote: r.confirmation_text ?? '',
      })),
      sideEffects: groupSideEffects(side),
      pathology,
      imaging,
      followups: followups.filter((f) => f.source_text).map((f) => ({
        id: f.id, dept: f.department, text: f.source_text, source: f.source_text,
      })),
      upcoming: followups.filter((f) => f.planned_date).map((f) => ({
        id: f.id, d: isoDate(f.planned_date), dept: f.department,
        items: f.items_text ?? '', bring: f.bring_text ?? '',
      })),
      documents: docs.map((d) => ({
        id: d.id, name: d.name, type: d.doc_type, d: isoDate(d.doc_date), visibility: d.visibility,
      })),
      notes: notes.map((n) => ({
        id: n.id, d: isoDate(n.note_date), text: n.text, recorder: n.recorder, visibility: n.visibility,
      })),
      visit: {
        nextDate: (followups.find((f) => f.planned_date)?.planned_date) ?? null,
        nextDept: (followups.find((f) => f.planned_date)?.department) ?? '',
        questions: questions.map((q) => ({ id: q.id, text: q.text, status: q.status })),
        summaries: [],
      },
      savedTrials: store.listSavedTrials(pid).map((s) => s.trial_key),
    }
  })

  return {
    meta: { today: now, version, build, empty: false },
    profiles: out,
    trialSnapshot: null,
  }
}
