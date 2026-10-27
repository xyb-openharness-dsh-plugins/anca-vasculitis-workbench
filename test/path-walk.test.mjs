import { test } from 'node:test'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/* X4 无头断言（静态层）：对已签认交互路径文档的三个数字化合同出数字。
   判据：docs/INTERACTION-DESIGN.md（G1 已签认 v1）：
   - 10 条一级线（ROUTES == PAGES）；
   - 32 个 (view,sub)（ROUTE_MANIFEST == SUBPAGES）；
   - 7 条场景路径（S01–S07），孤儿页 = 0（X1）；
   - 红线词零命中（T1/IP8 静态层；运行层在 G2 无头走查与 M5 check-wording）。
   浏览器级逐字走通（X2/X3）在 G2 用 serve-artifact + verify-tabs 执行。 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const APP = join(ROOT, 'prototypes/v0.2', 'app.js')

const list = (src, name) => {
  const m = src.match(new RegExp(`(?:var|const) ${name} = \\[([^\\]]*)\\]`))
  return m ? m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).filter(Boolean) : null
}
const pairs = (src, name) => {
  if (name === 'PAGES') {
    const m = src.match(/const PAGES = \[([\s\S]*?)\n\];/)
    return m ? [...m[1].matchAll(/\['([^']+)',\s*'([^']+)'(?:,\s*'[^']*')?\]/g)].map((x) => [x[1], x[2]]) : null
  }
  if (name === 'SUBPAGES') {
    const m = src.match(/const SUBPAGES = \{([\s\S]*?)\n\};/)
    if (!m) return null
    const out = []
    for (const line of m[1].split('\n')) {
      const lm = line.trim().match(/^(\w+): \[(.+)\],?$/)
      if (lm) for (const sm of lm[2].matchAll(/\['([^']+)',/g)) out.push([lm[1], sm[1]])
    }
    return out
  }
  const m = src.match(new RegExp(`const ${name} = \\[[\\s\\S]*?\\n\\];`))
  return m ? [...m[0].matchAll(/\['([^']+)',\s*'([^']+)'/g)].map((x) => [x[1], x[2]]) : null
}

test('原型存在且语法常量齐备（IP1 前置：路径文档已签认）', () => {
  if (!existsSync(APP)) throw new Error('prototypes/v0.2/app.js 不存在')
  const src = readFileSync(APP, 'utf8')
  for (const name of ['ROUTES', 'PAGES', 'SUBPAGES', 'ROUTE_MANIFEST', 'SCENES']) {
    if (!src.includes(name)) throw new Error(`app.js 缺常量 ${name}`)
  }
})

test('X1 覆盖：10 线 / 32 页 / 孤儿页 = 0', () => {
  const src = readFileSync(APP, 'utf8')
  const routes = list(src, 'ROUTES')
  const pages = pairs(src, 'PAGES')
  const subs = pairs(src, 'SUBPAGES')
  const manifest = pairs(src, 'ROUTE_MANIFEST')
  if (routes.length !== 10) throw new Error(`ROUTES=${routes.length}，合同 10`)
  if (pages.length !== 10) throw new Error(`PAGES=${pages.length}，合同 10`)
  if (manifest.length !== 32) throw new Error(`ROUTE_MANIFEST=${manifest.length}，合同 32`)
  if (JSON.stringify(subs.slice().sort()) !== JSON.stringify(manifest.slice().sort())) {
    throw new Error('SUBPAGES 与 ROUTE_MANIFEST 不一致')
  }
  const scenes = src.match(/const SCENES = \[([\s\S]*?)\n\];/)[1]
  const covers = [...scenes.matchAll(/covers: \[([^\]]*)\]/g)].flatMap((m) =>
    m[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')))
  const sceneTargets = [...scenes.matchAll(/view: '([^']+)', sub: '([^']*)'/g)].map((m) => `${m[1]}/${m[2]}`)
  const covered = new Set([...covers, ...sceneTargets])
  const orphans = manifest.map(([v, s]) => `${v}/${s}`).filter((k) => !covered.has(k) && k !== 'dashboard/')
  if (orphans.length) throw new Error(`孤儿页 ${orphans.length} 个：${orphans.join(', ')}`)
})

test('场景路径 7 条（S01–S07）且入口文案逐字（IP3 静态层）', () => {
  const src = readFileSync(APP, 'utf8')
  for (const label of ['记一次复查', '记一次事件', '记一次用药变更', '记一条副作用', '准备复诊', '存一份报告', '替家人记']) {
    if (!src.includes(label)) throw new Error(`入口文案缺失：${label}`)
  }
  const scenes = src.match(/const SCENES = \[([\s\S]*?)\n\];/)[1]
  const n = (scenes.match(/id: 'S/g) || []).length
  if (n !== 7) throw new Error(`SCENES=${n} 条，合同 7`)
})

test('红线静态：无"不可恢复"、无判定列名、无建议文案', () => {
  const src = readFileSync(APP, 'utf8')
  for (const w of ['不可恢复', '复发风险', '控制良好', '建议调整剂量', '可以停药']) {
    if (src.includes(w)) throw new Error(`红线词命中：${w}`)
  }
})
