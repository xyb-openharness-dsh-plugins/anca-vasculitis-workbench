#!/usr/bin/env node
/**
 * 文案红线扫描（T1/T7 的静态层，对应 audit「check/文案红线」项）：
 * 扫 dsh/、lib/、public/（存在时）的所有 js——判定类文案与判定列名零命中。
 *
 * 词表依据 docs/DEV-REQUIREMENTS-2026-10-25.md T1–T7 与 35 号：
 *   - 面向用户的判定/建议词（更正链语境下"调整"二字出现在"变更原因原文"等字段名
 *     属于事实记录，不在词表；词表只收会替用户下结论的短语）；
 *   - 判定列名（deny 列）；
 *   - "不可恢复"（IP8：更正=新增版本，全站无此文案）。
 * 「无法自动匹配」是 35 号合同词，白名单放行。
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs'
import { join, extname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const WORDS = [
  '不可恢复', '复发风险', '复发预告', '控制良好', '病情控制',
  '建议调整剂量', '建议加量', '建议减量', '可以停药', '建议停药',
  '建议使用', '推荐剂量', '治愈率',
  'match_score', 'eligible', 'suitability', 'flare_status', 'relapse_risk', 'control_status'
]
const ALLOW = ['无法自动匹配']
const DIRS = ['dsh', 'lib', 'public']

function collect(dir, acc) {
  if (!existsSync(dir)) return acc
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) collect(p, acc)
    else if (['.js', '.mjs'].includes(extname(name))) acc.push(p)
  }
  return acc
}

const files = DIRS.flatMap((d) => collect(join(ROOT, d), []))
const hits = []
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const rel = relative(ROOT, file)
  src.split('\n').forEach((line, i) => {
    for (const w of WORDS) {
      /* write-schema.js 的 DENY_COLUMNS 声明本身是红线契约的机器载体，放行纯列名词 */
      if (rel.endsWith('write-schema.js') && /^[a-z_]+$/.test(w)) continue
      if (line.includes(w) && !ALLOW.some((a) => line.includes(a))) {
        hits.push(`${rel}:${i + 1}  「${w}」  ${line.trim().slice(0, 90)}`)
      }
    }
  })
}

if (hits.length) {
  console.error(`✗ 文案红线：${hits.length} 处命中（词表 ${WORDS.length} 个 / 文件 ${files.length} 个）`)
  for (const h of hits) console.error('  ✗ ' + h)
  process.exit(1)
}
console.log(`✓ 无红线文案（扫了 ${files.length} 个文件，词表 ${WORDS.length} 条）`)
