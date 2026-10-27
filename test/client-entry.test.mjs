import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { API_PREFIX, UI_PREFIX } from '../dsh/routes.js'
import { PANEL } from '../lib/layout.js'

test('DSH 客户端入口唯一来源：UI_PREFIX 与 API_PREFIX 同属 routes.js', () => {
  assert.equal(UI_PREFIX, `${API_PREFIX}/ui`)
  assert.equal(UI_PREFIX, '/api/anca-vasculitis/ui')
})

test('lib/client.js 已构建客户端 iframe 指向唯一 UI_PREFIX（不是空串/逗号）', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const m = src.match(/const UI_ENTRY = '([^']+)'/)
  assert.ok(m, 'lib/client.js 缺 UI_ENTRY')
  assert.equal(m[1], `${UI_PREFIX}/`, `UI_ENTRY=${m[1]} 应为 ${UI_PREFIX}/`)
  assert.ok(m[1].startsWith('/api/'), 'UI_ENTRY 必须是本地 API 相对路径')
  assert.ok(!/^[,./]*$/.test(m[1]), 'UI_ENTRY 不得为空字符串或标点')
  assert.equal(src.match(/const UI_ENTRY =/g)?.length, 1, 'UI_ENTRY 必须只有一个定义')
})

test('iframe UI、API 健康路径均在同一 API_PREFIX 下', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  const ui = src.match(/const UI_ENTRY = '([^']+)'/)?.[1]
  const api = src.match(/const API_PREFIX = '([^']+)'/)?.[1]
  assert.equal(api, API_PREFIX)
  assert.equal(ui, `${API_PREFIX}/ui/`)
  assert.equal(PANEL.customFrame, true)
})
