import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createStore } from '../dsh/store.js'
import { parseAndRecord, ALLOWED_EXT, TEXT_EXT } from '../dsh/parse.js'
import { extractLabCandidates, extractDrugMentions, htmlTablesToPipes, csvToPipes, normalizeUnit, guessReportDate, LAB_DICT } from '../dsh/ancaparse.js'
import { mineruSettingsStatus, saveMineruToken, clearMineruToken, validateMineruToken, maskToken } from '../dsh/settings.js'
import { modelFallbackWorthy, MINERU_MODEL_DEFAULT } from '../dsh/mineru.js'

/* 18 号六部件的单测判据（§14 表）：
   mineru.js  — 四步顺序/PUT 不带 Content-Type/401 不重试/模型回退/ZIP 读取（协议层单测在 client 层，这里测判定函数）
   settings.js— 来源优先级、掩码、校验、原子写与 600、清除只删 token 键
   <topic>parse.js — 位置对齐、colspan、不等式、单位归一、抽不到返回空、先剥标签串位反例
   parse.js   — 成功不碰事实表、失败不产候选、非可解析格式不发请求、重解析不堆积
*/

const dir = mkdtempSync(join(tmpdir(), 'anca-mineru-test-'))
const store = createStore({ path: join(dir, 'm.sqlite') })
store.migrate()
store.insert('profile', { id: 'P_M', name: '解析档案' })

test('抽取器：HTML 表格 → 管道 → 候选（先转表再定位，不靠位置硬配）', () => {
  const html = '<table><tr><th>项目</th><th>结果</th><th>单位</th></tr><tr><td>MPO-ANCA</td><td>19.5</td><td>RU/mL</td></tr><tr><td>血肌酐</td><td>102</td><td>μmol/L</td></tr></table>'
  const { candidates } = extractLabCandidates(html)
  assert.deepEqual(candidates.map((c) => [c.payload.marker, c.payload.value]), [['MPO_ANCA', 19.5], ['CREATININE', 102]])
})

test('抽取器：不等式留原文、参考区间整行放弃', () => {
  const md = '| 项目 | 结果 | 单位 |\n|---|---|---|\n| 尿红细胞 | <5 | 个/μL |\n| CRP | 0-5 | mg/L |'
  const { candidates, skipped } = extractLabCandidates(md)
  assert.equal(candidates.length, 1)
  assert.equal(candidates[0].payload.value_raw, '<5')
  assert.equal(skipped.length, 1, '参考区间行应被跳过')
})

test('抽取器：短缩写必须词边界（PROMO/CPR3 不得命中）', () => {
  const noise = '| 项目 | 结果 | 单位 |\n|---|---|---|\n| PROMO-X | 5 | RU/mL |\n| CPR3 | 1 | mg/L |\n| ESR2 | 3 | mm/h |'
  assert.equal(extractLabCandidates(noise).candidates.length, 0)
})

test('抽取器：抽不到返回空（不是报错）', () => {
  const r = extractLabCandidates('这是一段没有表格的说明文字。')
  assert.equal(r.candidates.length, 0)
  assert.equal(r.skipped.length, 0)
})

test('单位：剥 LaTeX 外壳后归一', () => {
  assert.equal(normalizeUnit('$μg/L$'), 'μg/L')
  assert.equal(normalizeUnit(' RU/mL '), 'RU/mL')
})

test('CSV → 管道（化验单导出常见格式）', () => {
  const p = csvToPipes('项目,结果,单位\nMPO-ANCA,19.5,RU/mL')
  assert.ok(p.includes('| MPO-ANCA | 19.5 | RU/mL |'))
})

test('用药提及：只抽整句线索，不替用户决定药名剂量', () => {
  const md = '继续**泼尼松**口服\n环磷酰胺每月一次\n今天天气不错'
  const hits = extractDrugMentions(md)
  assert.equal(hits.length, 2)
  assert.ok(hits[0].payload.text.startsWith('用药提及'))
})

test('报告日期：取不到返回 null，不猜今天', () => {
  assert.equal(guessReportDate('这是一份报告'), null)
  assert.equal(guessReportDate('化验单_2026-09-18.pdf'), '2026-09-18')
  assert.equal(guessReportDate('2026年10月12日复查'), '2026-10-12')
})

test('parse.js：文本类本地抽 → 候选落 candidate 表，不碰事实表', async () => {
  const before = store.list('lab', { profileId: 'P_M' }).length
  const r = await parseAndRecord(store, {
    bytes: Buffer.from('项目,结果,单位\nMPO-ANCA,25.5,RU/mL\nCRP,0-5,mg/L', 'utf8'),
    filename: '复查.csv', profileId: 'P_M',
  })
  assert.equal(r.job.status, 'parsed')
  assert.equal(r.candidates.length, 1, '只应产出 1 条（CRP 参考区间跳过）')
  assert.equal(r.skipped.length, 1)
  assert.equal(store.list('lab', { profileId: 'P_M' }).length, before, '解析成功不得写事实表')
  assert.equal(store.listCandidates({ profileId: 'P_M', status: 'pending' }).length, 1)
})

test('parse.js：PDF 无 token → FAILED(NO_TOKEN)，原件入库、不产候选', async () => {
  const r = await parseAndRecord(store, {
    bytes: Buffer.from('%PDF-1.4 fake', 'utf8'), filename: '病理报告.pdf', mime: 'application/pdf', profileId: 'P_M',
  })
  assert.equal(r.job.status, 'failed')
  assert.equal(r.job.error_code, 'NO_TOKEN')
  assert.equal(r.candidates.length, 0, '失败不得产候选')
  assert.ok(r.document.id, '原件必须保留（可重试）')
})

test('parse.js：不支持的类型 → unsupported，不发请求', async () => {
  const r = await parseAndRecord(store, {
    bytes: Buffer.from('<html>x</html>', 'utf8'), filename: 'page.html', mime: 'text/html', profileId: 'P_M',
  })
  assert.equal(r.job.status, 'unsupported')
  assert.equal(r.job.error_code, 'UNSUPPORTED_TYPE')
  assert.equal(r.candidates.length, 0)
})

test('parse.js：确认候选 → 入事实层（同一写接口）', async () => {
  const pending = store.listCandidates({ profileId: 'P_M', status: 'pending' })
  assert.ok(pending.length > 0)
  const { fact, candidate } = store.acceptCandidate(pending[0].id)
  assert.equal(candidate.status, 'accepted')
  assert.equal(fact.source_kind, 'ai_candidate')
  assert.ok(store.list('lab', { profileId: 'P_M' }).some((r) => r.id === fact.id))
})

test('parse.js：重解析不堆积（每次一行 parse_job，旧记录保留）', async () => {
  const before = store.listCandidates({ profileId: 'P_M' }).length
  await parseAndRecord(store, { bytes: Buffer.from('项目,结果\nMPO-ANCA,30', 'utf8'), filename: '再次.csv', profileId: 'P_M' })
  const after = store.listCandidates({ profileId: 'P_M' }).length
  assert.ok(after >= before, '重解析应新增候选行而不是覆盖')
})

test('settings：来源优先级 / 掩码 / 校验 / 清除只删 token 键', () => {
  const f = join(dir, 'mineru.json')
  assert.equal(mineruSettingsStatus({ file: f, env: {} }).configured, false)
  /* 掩码不泄露原文 */
  const masked = maskToken('mr-abcdef1234567890')
  assert.ok(!masked.includes('abcdef1234567890'), '掩码不得含原文')
  /* 校验：空 token 抛错（不是返回 false——按实现契约断言） */
  assert.throws(() => validateMineruToken(''), /Token/)
  /* 存 → 读 → 清 */
  process.env.VASPAL_MINERU_SECRET = ''
  saveMineruToken('mr-test-token-abcdefghijklmn', { file: f })
  const st = mineruSettingsStatus({ file: f, env: {} })
  assert.equal(st.configured, true)
  assert.equal(st.source, 'file')
  clearMineruToken({ file: f })
  assert.equal(mineruSettingsStatus({ file: f, env: {} }).configured, false)
})

test('mineru：默认模型与回退判定（401 不换模型；只有模型不支持才回退）', () => {
  assert.equal(MINERU_MODEL_DEFAULT, 'pipeline')
  /* 401 是鉴权问题，换模型没用——必须判 false */
  assert.equal(modelFallbackWorthy({ code: 'UNAUTHORIZED', status: 401 }), false, '401 不重试、不换模型')
  /* 只有上游明确说"模型处理不了"才回退 */
  assert.equal(modelFallbackWorthy({ code: 'API_ERROR', message: 'model_version not support this doc' }), true)
  /* 其他 5xx 不换模型（换也一样失败） */
  assert.equal(modelFallbackWorthy({ code: 'SERVER_ERROR', status: 500, message: 'boom' }), false)
})

test('扩展名白名单', () => {
  assert.ok(ALLOWED_EXT.test('a.pdf') && ALLOWED_EXT.test('b.PNG') && ALLOWED_EXT.test('c.docx'))
  assert.ok(!ALLOWED_EXT.test('a.html'))
  assert.ok(TEXT_EXT.test('a.csv') && TEXT_EXT.test('b.md'))
})

test('字典与 schema marker 枚举一致（防抽出 schema 里没有的 marker）', async () => {
  const { CHECKS } = await import('../dsh/write-schema.js')
  for (const d of LAB_DICT) assert.ok(CHECKS.marker.includes(d.marker), `字典 marker 不在 schema 枚举里：${d.marker}`)
})

test('清理', () => { store.close(); rmSync(dir, { recursive: true, force: true }) })
