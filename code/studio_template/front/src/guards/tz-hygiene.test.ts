// @vitest-environment node
/**
 * 守衛：前台的時間寫法（dev-guidelines 4.7）。掃 front/src 含測試。
 * 比後端多一條：不可用 slice(0, 10) 切 ISO 字串當日期（切出來的是 UTC 日，比台北早一天）。
 * lib/datetime.ts 是唯一的實作，也在掃描範圍內（它用 Intl 與 getUTC*，不會命中）。
 */
import { describe, expect, it } from 'vitest'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { FRONT_SRC, GUARDS_DIR, ROOT } from './_paths'

const RULES: Rule[] = [
  { name: 'local-clock', re: /\.(getFullYear|getMonth|getDate|getHours|getMinutes|getDay)\(/ },
  { name: 'local-date-ctor', re: /new Date\(\s*\d{4}\s*,/ },
  { name: 'fixed-offset', re: /8 ?\* ?3600|28800000|\+08:00/ },
  { name: 'toLocale-without-timeZone', re: /toLocale(?:Date|Time)?String\((?![^)]*timeZone)/ },
  { name: 'slice-iso-as-date', re: /\.slice\(0,\s*10\)/ },
]

describe('守衛：時間寫法（前台）', () => {
  it('front/src 沒有違規', () => {
    const fs = readFiles(listFiles(FRONT_SRC, { exts: ['.ts', '.tsx'], exclude: [GUARDS_DIR] }))
    expect(fs.length).toBeGreaterThan(20)
    const vs = findViolations(fs, RULES)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('五種違規各塞一行都會紅', () => {
    const bad = [
      `const y = new Date().getFullYear()`,
      `const d = new Date(2026, 0, 1)`,
      `const t = ms + 28800000`,
      `const s = d.toLocaleString()`,
      `const day = iso.slice(0, 10)`,
    ].join('\n')
    expect(findViolations([{ path: 'bad.tsx', text: bad }], RULES).map((v) => v.rule)).toEqual([
      'local-clock', 'local-date-ctor', 'fixed-offset', 'toLocale-without-timeZone', 'slice-iso-as-date',
    ])
  })
})
