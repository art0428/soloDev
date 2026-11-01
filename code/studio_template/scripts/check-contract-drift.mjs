#!/usr/bin/env node
/**
 * 契約漂移檢查（pre-commit 與 check.yml 跑；手冊 10.5）。三件事，任何一件不成立就 exit 1：
 *   1. 後端每支路由都在 api/openapi.yaml 裡（方法＋路徑）。
 *   2. 契約裡每支端點後端都有實作。
 *   3. 後端每支路由都被測試用 app.inject 打過。
 *
 * 怎麼認：
 *   路由：backend/src 非測試檔裡的 app.get('/x')、app.post<...>('/x')。路徑參數 :id 與契約的 {id} 都視為 *。
 *   測試：backend/src 的 *.test.ts 與 src/test/*.ts 裡的 { method: 'GET', url: '/x?...' }、樣板字串的 ${...} 視為 *。
 *   /internal/* 是測試輔助端點，不在契約裡、不要求測試。
 *   某一行路由真的不該進契約（極少見）：同一行加註解 contract: skip，並在回報裡說明。
 *
 *   node scripts/check-contract-drift.mjs            檢查
 *   node scripts/check-contract-drift.mjs --list     另外列出對照表
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BACKEND_SRC = join(ROOT, 'backend', 'src')
const SPEC = join(ROOT, 'api', 'openapi.yaml')
const LIST = process.argv.includes('--list')

const walk = (dir, out = []) => {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules') continue
    const p = join(dir, n)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.ts$/.test(n)) out.push(p)
  }
  return out
}
const isTest = (p) => /\.test\.ts$/.test(p) || /[\\/]test[\\/]/.test(p) || /[\\/]guards[\\/]/.test(p)
const norm = (path) =>
  path
    .split('?')[0]
    .replace(/\$\{[^}]*\}/g, '*')
    .replace(/:[A-Za-z_]\w*/g, '*')
    .replace(/\{[^}]+\}/g, '*')
    .replace(/\/+$/, '') || '/'
const key = (method, path) => `${method.toUpperCase()} ${norm(path)}`

// 1. 路由
const routes = new Map() // key → 檔案:行
const routeRe = /\bapp\.(get|post|put|patch|delete)\s*(?:<[^()]*?>)?\(\s*(['"`])([^'"`]+)\2/g
for (const f of walk(BACKEND_SRC).filter((p) => !isTest(p))) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  let m
  while ((m = routeRe.exec(text))) {
    const line = text.slice(0, m.index).split('\n').length
    if (/contract:\s*skip/.test(lines[line - 1] ?? '')) continue
    routes.set(key(m[1], m[3]), `${relative(ROOT, f)}:${line}`)
  }
}

// 2. 契約（不用 YAML 套件：只認最外層 paths: 底下兩格縮排的路徑與四格縮排的方法）
const spec = readFileSync(SPEC, 'utf8').split('\n')
const contract = new Set()
let inPaths = false
let current = null
for (const raw of spec) {
  if (/^paths:\s*$/.test(raw)) { inPaths = true; continue }
  if (inPaths && /^\S/.test(raw)) inPaths = false
  if (!inPaths) continue
  let m
  if ((m = /^  (\/\S*):\s*$/.exec(raw))) { current = m[1]; continue }
  if (current && (m = /^    (get|post|put|patch|delete):\s*$/.exec(raw))) contract.add(key(m[1], current))
}

// 3. 測試打過的
const tested = new Set()
const injectRe = /method:\s*['"](GET|POST|PUT|PATCH|DELETE)['"][^}]*?url:\s*(['"`])([^'"`]*)\2/g
for (const f of walk(BACKEND_SRC).filter(isTest)) {
  const text = readFileSync(f, 'utf8')
  let m
  while ((m = injectRe.exec(text))) tested.add(key(m[1], m[3]))
}

const isInternal = (k) => / \/internal\//.test(k)
const problems = []
for (const [k, where] of routes) {
  if (isInternal(k)) continue
  if (!contract.has(k)) problems.push(`路由不在契約裡：${k}（${where}）→ 先寫進 api/openapi.yaml`)
  if (!tested.has(k)) problems.push(`路由沒被測試打過：${k}（${where}）→ 補一題 app.inject`)
}
for (const k of contract) {
  if (!routes.has(k)) problems.push(`契約有、後端沒實作：${k} → 實作它，或從契約拿掉`)
}

if (LIST) {
  console.log('端點 × 契約 × 測試')
  const all = new Set([...routes.keys(), ...contract])
  for (const k of [...all].sort()) console.log(`  ${k.padEnd(32)} 契約:${contract.has(k) ? '有' : '無'}  實作:${routes.has(k) ? '有' : '無'}  測試:${tested.has(k) ? '有' : '無'}`)
}

if (problems.length) {
  console.error('✖ 契約漂移：')
  for (const p of problems) console.error(`  - ${p}`)
  process.exit(1)
}
console.log(`✓ 契約無漂移：${routes.size} 支路由、${contract.size} 支契約端點、${[...routes.keys()].filter((k) => !isInternal(k)).length} 支都有測試`)
