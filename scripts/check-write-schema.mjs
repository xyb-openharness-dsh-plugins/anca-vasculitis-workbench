#!/usr/bin/env node
/**
 * 写映射 × 冻结 schema 检查器（G3/G4 的静态闸）：
 * 「写端点映射的列名必须逐列存在于冻结 schema/0001，且判定类红线列永不出现」。
 *
 * 检查项：
 *   W1 schema 语法与迁移命名：schema/00*.sql 命名合法；
 *   W2 判读列断言（T1）：全部 CREATE TABLE 的列名扫描 deny 词表 → 0 命中；
 *   W3 列存在：dsh/write-schema.js 每个 kind 的每个列（含必填列）都在对应表的
 *      CREATE TABLE 列清单里（逐列一致，防"写端点先于 schema 长出新列"）；
 *   W4 deny 列不进映射：WRITE_KINDS 各 kind 的 columns/required 里不得出现 deny 列；
 *   W5 版本链列：versioned 表的映射须包含修订所需的审计列语义——表定义里必须有
 *      revision + in_use；
 *   W6 路由接线：dsh/routes.js 必须为每个 kind 提供读写路径（/records/:kind）。
 *
 * 退出码：0 通过 / 1 有失败。
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { WRITE_KINDS, DENY_COLUMNS } from '../dsh/write-schema.js'

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)))
const SCHEMA_DIR = join(ROOT, 'schema')
const fails = []
const oks = []

function sqlFiles() {
  const files = readdirSync(SCHEMA_DIR).filter((f) => f.endsWith('.sql')).sort()
  const bad = files.filter((f) => !/^\d{4}_[a-z0-9_]+\.sql$/.test(f))
  if (bad.length) fails.push(`W1: schema/ 有不合法迁移名：${bad.join(', ')}`)
  else oks.push(`W1: 迁移命名合法（${files.length} 个）`)
  return files
}

/** 解析 CREATE TABLE 的列名（按行扫，遇表级约束关键词跳过） */
function parseColumns(sql, table) {
  const m = sql.match(new RegExp(`CREATE TABLE ${table} \\([\\s\\S]*?\\n\\);`))
  if (!m) return null
  const lines = m[0].split('\n').slice(1)
  const cols = []
  for (const line of lines) {
    const t = line.trim()
    if (!t || t.startsWith('--')) continue
    if (/^\);?$/.test(t)) break
    const cm = t.match(/^([a-z_][a-z0-9_]*)\s/i)
    if (!cm) continue
    const name = cm[1].toLowerCase()
    if (/^(primary|foreign|unique|check|constraint)$/.test(name)) continue
    cols.push(name)
  }
  return cols
}

const files = sqlFiles()
const allSql = files.map((f) => readFileSync(join(SCHEMA_DIR, f), 'utf8')).join('\n')

/* W2 判读列断言 */
const tables = [...allSql.matchAll(/CREATE TABLE ([a-z_]+) \(/g)].map((m) => m[1])
const colHits = []
for (const t of tables) {
  const cols = parseColumns(allSql, t) || []
  for (const c of cols) if (DENY_COLUMNS.includes(c)) colHits.push(`${t}.${c}`)
}
if (colHits.length) fails.push(`W2/T1: 判定类红线列出现 ${colHits.length} 处：${colHits.join(', ')}`)
else oks.push(`W2/T1: ${tables.length} 张表全部列名 deny 词表 0 命中`)

/* W3/W4/W5 写映射 × schema */
let missing = 0, denyInMap = 0, noChain = 0
for (const [kind, spec] of Object.entries(WRITE_KINDS)) {
  const cols = parseColumns(allSql, spec.table)
  if (!cols) { fails.push(`W3: kind=${kind} 的表 ${spec.table} 在 schema 里找不到`); missing++; continue }
  for (const c of [...spec.columns, ...(spec.required || [])]) {
    if (DENY_COLUMNS.includes(c)) { fails.push(`W4: kind=${kind} 映射含 deny 列 ${c}`); denyInMap++; continue }
    if (!cols.includes(c)) { fails.push(`W3: kind=${kind} 列「${c}」不在 ${spec.table} 的冻结 schema 里`); missing++ }
  }
  if (spec.versioned) {
    const need = ['revision', 'in_use']
    const lack = need.filter((c) => !cols.includes(c))
    if (lack.length) { fails.push(`W5: ${spec.table} 缺版本链列：${lack.join(', ')}`); noChain++ }
  }
}
if (!missing && !denyInMap && !noChain) oks.push(`W3–W5: ${Object.keys(WRITE_KINDS).length} 个 kind 的映射列全部存在于冻结 schema；deny 列 0；版本链列齐`)

/* W6 路由接线 */
const routesSrc = readFileSync(join(ROOT, 'dsh/routes.js'), 'utf8')
const unrouted = Object.keys(WRITE_KINDS).filter((k) => !routesSrc.includes('/records/'))
if (unrouted.length) fails.push(`W6: routes.js 缺路由接线：${unrouted.join(', ')}`)
else oks.push(`W6: routes.js 对 ${Object.keys(WRITE_KINDS).length} 个 kind 均有 /records/ 接线`)

console.log(fails.length
  ? `✗ check-write-schema：${fails.length} 项失败\n${fails.map((f) => '  ✗ ' + f).join('\n')}`
  : `✓ check-write-schema：全部通过\n${oks.map((o) => '  ✓ ' + o).join('\n')}`)
process.exit(fails.length ? 1 : 0)
