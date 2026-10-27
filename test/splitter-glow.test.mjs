import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/* 全家族统一行为：AI 面板分隔线可左右拖动；悬停显示本工作台同色系增亮色 + 拖动把手。
   对已构建的 lib/client.js 做静态断言，防止构建或回退把行为丢掉。 */
const built = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

test('分隔线有加宽的抓取区与 col-resize 光标', () => {
  assert.match(built, /const splitterStyle = \{[\s\S]*?width: 10,/m)
  assert.match(built, /cursor: 'col-resize'/)
})

test('悬停与拖动使用同色系增亮样式（非固定蓝色）', () => {
  assert.match(built, /SPLITTER_BRAND/)
  assert.match(built, /splitterMix/)
  assert.match(built, /const splitterHoverStyle = \{/)
  assert.match(built, /const splitterDragStyle = \{/)
  assert.match(built, /style: dragging \? splitterDragStyle : hovering \? splitterHoverStyle : splitterStyle/)
})

test('悬停时出现拖动把手 icon', () => {
  assert.match(built, /splitterGripStyle/)
  assert.match(built, /⠿/)
  assert.match(built, /\(hovering \|\| dragging\)/)
})

test('悬停状态与指针捕获已接通（拖过业务 iframe 不丢事件）', () => {
  assert.match(built, /const \[hovering, setHovering\] = React\.useState\(false\)/)
  assert.match(built, /onPointerEnter: \(\) => setHovering\(true\)/)
  assert.match(built, /onPointerLeave: \(\) => setHovering\(false\)/)
  assert.match(built, /setPointerCapture\(event\.pointerId\)/)
})

test('拖动仍限制在宿主允许的 25%–45%', () => {
  assert.match(built, /AGENT_MIN/)
  assert.match(built, /AGENT_MAX/)
  assert.match(built, /clampWidth/)
})
