#!/usr/bin/env node
/**
 * 冻结完整性检查（G3 之后的结构闸）：schema/0001_initial.sql 的 sha256 必须
 * 与 schema/freeze-contract.md 里记录的哈希逐字符一致。
 *
 * 为什么需要它：冻结合同写在文档里只是约定，改了文件没人拦。
 * 每次 check 跑一遍，哈希一变立刻红——结构变更必须走「新增 000N_*.sql」，
 * 而不是改 0001。
 *
 * 判据：
 *   F1 freeze-contract.md 存在且含合法 sha256；
 *   F2 0001_initial.sql 实算哈希 == 合约哈希；
 *   F3 schema/ 下不存在比 0001 更早的文件被改动（只检查存在性：0001 必须存在）。
 * 退出码：0 通过 / 1 冻结破坏。
 */
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCHEMA = join(ROOT, 'schema/0001_initial.sql')
const CONTRACT = join(ROOT, 'schema/freeze-contract.md')
const fails = []

if (!existsSync(CONTRACT)) fails.push('F1: 缺 schema/freeze-contract.md')
if (!existsSync(SCHEMA)) fails.push('F3: 缺 schema/0001_initial.sql')

let actual = ''
if (existsSync(SCHEMA)) {
  actual = createHash('sha256').update(readFileSync(SCHEMA)).digest('hex')
}

let expected = ''
if (existsSync(CONTRACT)) {
  const m = readFileSync(CONTRACT, 'utf8').match(/sha256[：:]\s*`?([0-9a-f]{64})`?/)
  if (!m) fails.push('F1: freeze-contract.md 里找不到 sha256')
  else expected = m[1]
}

if (actual && expected && actual !== expected) {
  fails.push(`F2: 冻结破坏——0001 实算 ${actual.slice(0, 16)}… ≠ 合约 ${expected.slice(0, 16)}…。`
    + '结构变更请新增 schema/000N_*.sql，不要改 0001。')
}

if (fails.length) {
  console.error('✗ check-schema-freeze：' + fails.length + ' 项失败')
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log(`✓ schema 冻结完整（0001 sha256 ${actual.slice(0, 16)}… 与合约一致）`)
