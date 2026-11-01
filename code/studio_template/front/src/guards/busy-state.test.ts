// @vitest-environment node
/**
 * 守衛：處理中指示只有一種（dev-guidelines 4.6）。
 * 擋：圖示字型裡靜止的 loading 字符（ti-loader、fa-spinner 這類，不會轉）、自己寫的 animation、
 * styles.css 裡除了 spin-rot 以外的 @keyframes。全站的轉圈只有 <Spinner />。
 * 起因：前一個專案的「忙碌圖示」用的是圖示字型裡靜止的字符，看起來有做、其實一個都沒在轉（dev-guidelines 第 7 節教材）。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { FRONT_SRC, GUARDS_DIR, ROOT } from './_paths'

const RULES: Rule[] = [
  { name: 'static-loader-icon', re: /ti-loader|fa-spinner|fa-spin\b|icon-loading|loading-icon|animate-spin|lucide-loader/ },
  { name: 'inline-animation', re: /animation\s*[:=]/, only: /\.tsx?$/ },
  { name: 'own-keyframes', re: /@keyframes\s+(?!spin-rot\b)/, only: /\.css$/ },
]

describe('守衛：處理中指示', () => {
  it('front/src 沒有靜止載入圖示、自己寫的 animation、多餘的 keyframes', () => {
    const fs = readFiles(listFiles(FRONT_SRC, { exts: ['.ts', '.tsx', '.css'], exclude: [GUARDS_DIR] }))
    expect(fs.length).toBeGreaterThan(20)
    const vs = findViolations(fs, RULES)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('styles.css 只有一個 @keyframes，而且叫 spin-rot；.spin 用它', () => {
    const css = readFileSync(`${FRONT_SRC}styles.css`, 'utf8')
    const names = [...css.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
    expect(names).toEqual(['spin-rot'])
    expect(css).toMatch(/\.spin\s*{[^}]*animation:\s*spin-rot/)
  })
  it('三種違規各塞一行都會紅', () => {
    const vs = findViolations(
      [
        { path: 'a.tsx', text: `<i className="ti ti-loader-2" />\n<span style={{ animation: 'spin 1s linear infinite' }} />` },
        { path: 'b.css', text: `@keyframes spin { to { transform: rotate(360deg) } }` },
      ],
      RULES,
    )
    expect(vs.map((v) => v.rule)).toEqual(['static-loader-icon', 'inline-animation', 'own-keyframes'])
  })
})
