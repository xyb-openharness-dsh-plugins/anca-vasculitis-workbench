/**
 * 演示数据播种（M5）：把 prototypes/v0.2/demo-data.js 的合成档案写进库里。
 *
 * 两条纪律：
 * 1. 只播**合成演示**数据（人物/医院/数值均为编写示例），不碰任何真实患者资料；
 * 2. 库里已有 profile 就不播（幂等），避免重复叠加把演示库搞脏。
 *
 * 返回值为写入的事实记录数，供 --seed 输出与测试断言使用。
 */
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
/* 装机包里没有 prototypes/（那只是原型期的源码），所以演示数据要在构建时落成 JSON 随包发出。
   顺序：包内 demo/demo-data.json（装机态） → 仓库内 prototypes/v0.2/demo-data.js（开发态）。 */
const DEMO_JSON = join(ROOT, 'demo/demo-data.json')
const DEMO_JS = join(ROOT, 'prototypes/v0.2/demo-data.js')

/** 在 Node 里求值 demo-data.js（它是 window 全局脚本，不是 ESM） */
export function loadDemoData(file = null) {
  /* 装机态：直接读构建产物 JSON */
  if (!file && existsSync(DEMO_JSON)) {
    try {
      const data = JSON.parse(readFileSync(DEMO_JSON, 'utf8'))
      if (data && Array.isArray(data.profiles)) return data
    } catch { /* 落到开发态 */ }
  }
  const target = file || DEMO_JS
  if (!existsSync(target)) return null
  const src = readFileSync(target, 'utf8')
  const sandbox = { window: {} }
  /* demo-data.js 用 `const DEMO_DATA = (() => {...})()` 定义（不是 window 全局），
     所以把求值结果显式 return 出来；文件本身无副作用、不访问网络与文件系统。 */
  const fn = new Function('window', `${src}\nreturn (typeof DEMO_DATA !== 'undefined') ? DEMO_DATA : window.DEMO_DATA;`)
  const data = fn(sandbox.window)
  return data && Array.isArray(data.profiles) ? data : null
}

export function hasDemoData(store) {
  try { return store.list('profile').length > 0 } catch { return false }
}

/**
 * 播种：return 写入的事实记录条数。
 * 副作用只落在本机库；不触碰资料目录里的任何真实文件。
 */
export function seedDemo(store, data = loadDemoData()) {
  if (!data) throw new Error('找不到演示数据（prototypes/v0.2/demo-data.js）')
  if (hasDemoData(store)) return 0
  let n = 0
  for (const p of data.profiles) {
    store.insert('profile', {
      id: p.id, name: p.name,
      birth_date: p.age ? `${new Date().getFullYear() - p.age}-01-01` : null,
      gender: p.sex ?? null, subtype_text: p.subtypeText ?? null,
      serology_text: p.serologyText ?? null,
      dx_date: p.dxDate ? (p.dxDate.length === 7 ? `${p.dxDate}-01` : p.dxDate) : null,
      caregiver_label: p.caregiverLabel ?? null,
    })
    n++

    for (const [marker, rows] of Object.entries(p.labs ?? {})) {
      for (const r of rows) {
        store.insert('lab', {
          profile_id: p.id, marker, value: r.v, unit: r.unit,
          measured_at: r.d, lab_name: r.lab ?? null, method: r.method ?? null,
          report_quote: r.quote ?? null, recorder: r.recorder ?? 'PATIENT',
          visibility: r.visibility ?? 'normal', source_kind: 'import',
        })
        n++
      }
    }
    for (const t of p.treatmentVersions ?? []) {
      store.insert('treatment', {
        profile_id: p.id, drug: t.drug, dose_text: t.dose, route: t.route || null,
        start_date: t.start, end_date: t.end || null,
        change_reason_text: t.reason ?? null, source_label: t.source ?? null,
        recorder: t.recorder ?? 'PATIENT', visibility: t.visibility ?? 'normal', source_kind: 'import',
      })
      n++
    }
    for (const e of p.relapseEvents ?? []) {
      store.insert('relapse', {
        profile_id: p.id, event_date: e.d, organs: e.organs ?? [],
        symptoms_text: e.symptoms, confirmation_text: e.confirm || null,
        department: e.dept ?? null, recorder: e.recorder ?? 'PATIENT',
        visibility: e.visibility ?? 'normal', source_kind: 'import',
      })
      n++
    }
    for (const [section, rows] of Object.entries(p.sideEffects ?? {})) {
      for (const x of rows) {
        store.insert('side-effect', {
          profile_id: p.id, section, event_date: x.d, symptom_text: x.text,
          test_text: x.src ?? null, report_quote: x.quote ?? null,
          recorder: x.recorder ?? 'PATIENT', visibility: x.visibility ?? 'normal', source_kind: 'import',
        })
        n++
      }
    }
    for (const d of p.documents ?? []) {
      store.insert('document', {
        profile_id: p.id, name: d.name, doc_type: d.type, doc_date: d.d ?? null,
        recorder: 'PATIENT', visibility: d.visibility ?? 'normal',
      })
      n++
    }
    for (const x of p.pathology ?? []) {
      store.insert('pathology-note', {
        profile_id: p.id, note_date: x.d, note_kind: 'biopsy',
        terms: x.terms ?? [], report_quote: x.quote, recorder: 'PATIENT', visibility: 'normal',
      })
      n++
    }
    for (const x of p.imaging ?? []) {
      store.insert('pathology-note', {
        profile_id: p.id, note_date: x.d, note_kind: 'imaging',
        terms: [], report_quote: x.quote, recorder: 'PATIENT', visibility: 'normal',
      })
      n++
    }
    for (const f of p.followups ?? []) {
      store.insert('followup', {
        profile_id: p.id, department: f.dept, planned_date: null,
        items_text: null, bring_text: null, source_text: f.text ?? f.source ?? '医嘱原文（演示）',
        recorder: 'PATIENT', visibility: 'normal',
      })
      n++
    }
    for (const u of p.upcoming ?? []) {
      store.insert('followup', {
        profile_id: p.id, department: u.dept, planned_date: u.d,
        items_text: u.items ?? null, bring_text: u.bring ?? null,
        source_text: '医嘱原文（演示）', recorder: 'PATIENT', visibility: 'normal',
      })
      n++
    }
    for (const q of p.visit?.questions ?? []) {
      store.insert('question', {
        profile_id: p.id, text: q.text, status: q.status ?? 'open',
        recorder: 'PATIENT', visibility: 'normal',
      })
      n++
    }
    for (const x of p.notes ?? []) {
      store.insert('note', {
        profile_id: p.id, note_date: x.d, text: x.text,
        recorder: x.recorder ?? 'PATIENT', visibility: x.visibility ?? 'normal',
      })
      n++
    }
  }
  return n
}
