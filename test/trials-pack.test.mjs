import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { createHash } from 'node:crypto'

/* M4 四件套一致性断言（35 号纪律）：
   manifest.recordCount == jsonl 行数 == sqlite trials 行数；
   manifest.sourceStatusRows == sqlite source_statuses 行数；
   manifest 记录的文件 sha256 与实际文件一致（防"改了数据没更新 manifest"）；
   不计覆盖的来源不得有 counted_coverage=1（FAILED/DENIED/NEEDS_SETUP/NO_RESULTS 不算"查过"）；
   任何记录不得带数值匹配度字段（35 号禁止 match_score/eligible/suitability）。 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = join(ROOT, 'research/anca-vasculitis')
const M = join(DIR, 'manifest.json')
const J = join(DIR, 'trials-2026.jsonl')
const D = join(DIR, 'anca_trials_2026.sqlite')

test('四件套存在', () => {
  for (const f of [M, J, D, join(DIR, 'README.md')]) assert.ok(existsSync(f), `缺文件 ${f}`)
})

test('manifest = jsonl = sqlite（条数一致）', () => {
  const m = JSON.parse(readFileSync(M, 'utf8'))
  const lines = readFileSync(J, 'utf8').split('\n').filter(Boolean)
  const db = new DatabaseSync(D)
  const n = db.prepare('SELECT COUNT(*) AS n FROM trials').get().n
  const st = db.prepare('SELECT COUNT(*) AS n FROM source_statuses').get().n
  db.close()
  assert.equal(m.recordCount, lines.length, 'manifest.recordCount ≠ jsonl 行数')
  assert.equal(m.recordCount, n, 'manifest.recordCount ≠ sqlite trials')
  assert.equal(m.sourceStatusRows, st, 'manifest.sourceStatusRows ≠ sqlite source_statuses')
})

test('manifest 文件指纹与实际文件一致', () => {
  const m = JSON.parse(readFileSync(M, 'utf8'))
  const sha = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
  assert.equal(m.files.jsonl.sha256, sha(J), 'jsonl 哈希与 manifest 不符（改了数据未更新 manifest）')
  assert.equal(m.files.sqlite.sha256, sha(D), 'sqlite 哈希与 manifest 不符')
})

test('覆盖纪律：FAILED/DENIED/NEEDS_SETUP/NO_RESULTS 不计覆盖', () => {
  const db = new DatabaseSync(D)
  const bad = db.prepare(`SELECT source_id, state FROM source_statuses
    WHERE counted_coverage = 1 AND state NOT IN ('SUCCESS') AND state NOT LIKE 'OK%'`).all()
  db.close()
  assert.deepEqual(bad, [], `不应计覆盖却计了：${JSON.stringify(bad)}`)
})

test('每条记录带 snapshotDate 与"登记状态，未核实"', () => {
  const lines = readFileSync(J, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
  for (const r of lines) {
    assert.ok(r.snapshotDate, `缺 snapshotDate：${r.recordId}`)
    assert.equal(r.statusNote, '登记状态，未核实', `状态措辞不符：${r.recordId}`)
  }
})

test('35 号禁止列：jsonl 不得出现数值匹配度字段', () => {
  const raw = readFileSync(J, 'utf8')
  for (const w of ['match_score', 'matchScore', 'eligible', 'suitability']) {
    assert.ok(!raw.includes(w), `数据包出现禁止字段：${w}`)
  }
})

test('manifest 如实披露未覆盖来源与本轮结论', () => {
  const m = JSON.parse(readFileSync(M, 'utf8'))
  assert.ok(m.coverage.rule.includes('不计覆盖'), 'coverage.rule 未写明不计覆盖纪律')
  assert.ok(Array.isArray(m.coverage.notCounted), 'coverage.notCounted 缺失')
  assert.ok(m.honesty.statusWording.includes('未核实'), 'honesty.statusWording 缺失')
  for (const w of ['零命中', '不得据此说']) {
    assert.ok(m.relevance.caveat.includes(w), `caveat 缺少如实声明：${w}`)
  }
})
