/**
 * 守衛：不准寫死埠號。兩組測試同時跑都把假服務起在寫死的埠，一邊的後端打進另一邊的假服務，紅得莫名其妙。
 * 埠一律從環境變數或設定來；唯一能寫預設值的地方：backend/src/lib/env.ts、tests/e2e/playwright.config.ts、tests/e2e/seed-user.ts。
 */
import { describe, expect, it } from 'vitest'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { BACKEND_SRC, CONTRACT_DIR, E2E_DIR, FRONT_SRC, GUARDS_DIR, ROOT } from './_paths.js'

const RULES: Rule[] = [{ name: 'hardcoded-port', re: /\b(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d{4,5}\b/ }]
// 守衛自己（含反例字串）不掃
const ALLOW = [/lib[\\/]env\.ts$/, /playwright\.config\.ts$/, /seed-user\.ts$/, GUARDS_DIR]

const files = () =>
  readFiles([
    ...listFiles(BACKEND_SRC, { exts: ['.ts'], exclude: ALLOW }),
    ...listFiles(FRONT_SRC, { exts: ['.ts', '.tsx'], exclude: [GUARDS_DIR] }),
    ...listFiles(E2E_DIR, { exts: ['.ts'], exclude: ALLOW }),
    ...listFiles(CONTRACT_DIR, { exts: ['.ts'] }),
  ])

describe('守衛：寫死埠號', () => {
  it('程式與測試裡沒有 localhost:埠 這類字樣', () => {
    const fs = files()
    expect(fs.length).toBeGreaterThan(30)
    const vs = findViolations(fs, RULES)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('塞一行會紅；註解裡的不算；guard: allow 放行', () => {
    const vs = findViolations(
      [{ path: 'x.ts', text: `const a = 'http://127.0.0.1:4300'\n// http://localhost:4300 註解\nconst b = 'localhost:4301' // guard: allow` }],
      RULES,
    )
    expect(vs.map((v) => v.line)).toEqual([1])
  })
})
