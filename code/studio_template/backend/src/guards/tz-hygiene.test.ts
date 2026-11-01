/**
 * 守衛：時間寫法（dev-guidelines 4.7 的機械式 grep 清單，變成測試）。掃程式**也掃測試**（鐵則 9）。
 * 擋：本機時鐘的 getFullYear／getMonth／getDate／getHours／getDay、new Date(年, 月, 日)、固定 +8、toLocale*String 沒給 timeZone。
 * 唯一例外是 lib/dates.ts 本身（它用 getUTC* 與 Intl，本來就不會命中）。
 */
import { describe, expect, it } from 'vitest'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { BACKEND_PRISMA, BACKEND_SCRIPTS, BACKEND_SRC, CONTRACT_DIR, E2E_DIR, GUARDS_DIR, ROOT } from './_paths.js'

export const TZ_RULES: Rule[] = [
  { name: 'local-clock', re: /\.(getFullYear|getMonth|getDate|getHours|getMinutes|getDay)\(/ },
  { name: 'local-date-ctor', re: /new Date\(\s*\d{4}\s*,/ },
  { name: 'fixed-offset', re: /8 ?\* ?3600|28800000|\+08:00/ },
  { name: 'toLocale-without-timeZone', re: /toLocale(?:Date|Time)?String\((?![^)]*timeZone)/ },
]

const files = () =>
  readFiles([
    ...listFiles(BACKEND_SRC, { exts: ['.ts'], exclude: [GUARDS_DIR] }),
    ...listFiles(BACKEND_PRISMA, { exts: ['.ts'] }),
    ...listFiles(BACKEND_SCRIPTS, { exts: ['.ts', '.mjs'] }),
    ...listFiles(E2E_DIR, { exts: ['.ts'] }),
    ...listFiles(CONTRACT_DIR, { exts: ['.ts'] }),
  ])

describe('守衛：時間寫法（後端、測試、腳本、E2E）', () => {
  it('沒有本機時鐘、固定偏移、沒帶時區的 toLocale', () => {
    const fs = files()
    expect(fs.length).toBeGreaterThan(20)
    const vs = findViolations(fs, TZ_RULES)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('四種違規各塞一行都會紅；getUTCDate 與帶 timeZone 的不算', () => {
    const bad = [
      `const h = new Date().getHours()`,
      `const d = new Date(2026, 10, 1)`,
      `const t = now + 8 * 3600 * 1000`,
      `const s = d.toLocaleDateString('zh-TW')`,
    ].join('\n')
    const good = [`const u = d.getUTCDate()`, `const s = d.toLocaleDateString('zh-TW', { timeZone: 'Asia/Taipei' })`].join('\n')
    expect(findViolations([{ path: 'bad.ts', text: bad }], TZ_RULES).map((v) => v.rule)).toEqual([
      'local-clock', 'local-date-ctor', 'fixed-offset', 'toLocale-without-timeZone',
    ])
    expect(findViolations([{ path: 'good.ts', text: good }], TZ_RULES)).toHaveLength(0)
  })
})
