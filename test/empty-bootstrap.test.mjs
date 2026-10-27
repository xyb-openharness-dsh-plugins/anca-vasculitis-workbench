import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const app = readFileSync(new URL('../prototypes/v0.2/app.js', import.meta.url), 'utf8')

test('empty bootstrap renders onboarding before dereferencing patient fields', () => {
  const fn = app.slice(app.indexOf('function pageDashboard() {'), app.indexOf('const sceneLabel =', app.indexOf('function pageDashboard() {')))
  const guard = fn.indexOf('if (!DATA.profiles.length)')
  const patientField = fn.indexOf('p.serologyText.includes')
  assert.ok(guard >= 0, 'pageDashboard needs empty-profile guard')
  assert.ok(patientField < 0 || guard < patientField, 'empty guard must run before profile serology access')
  assert.match(fn, /建立一个病情档案/)
  assert.match(fn, /导入文件或粘贴文本/)
})

test('profile form can create the first profile via the persistent write adapter', () => {
  const fn = app.slice(app.indexOf('async function saveProfile() {'), app.indexOf('const SAVES =', app.indexOf('async function saveProfile() {')))
  assert.match(fn, /const isNew = DATA\.profiles\.length === 0/)
  assert.match(fn, /await persist\('profile'/)
  assert.match(fn, /if \(isNew\) DATA\.profiles\.push\(p\)/)
  assert.match(fn, /navigate\('dashboard'/)
})

test('synthetic-example data is visibly marked globally and must not look like real records', () => {
  assert.match(app, /synthetic-banner/)
  assert.match(app, /不对应真实患者，不可作为诊疗依据/)
})
