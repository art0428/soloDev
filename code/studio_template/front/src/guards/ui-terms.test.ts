// @vitest-environment node
/**
 * 守衛：畫面用語（docs/ui-terms.md「不要用」欄的中文詞）。掃 front/src 的字串與 JSX 文字，測試檔不掃。
 * 例外在那一行加 `guard: allow`，並在 ui-terms.md「例外」欄寫明。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findForbiddenTerms, formatViolations, listFiles, parseForbiddenTerms, readFiles } from '@studio/guard-kit'
import { FRONT_SRC, IS_TEST_FILE, ROOT } from './_paths'

const terms = parseForbiddenTerms(readFileSync(`${ROOT}docs/ui-terms.md`, 'utf8'))

describe('守衛：畫面用語（前台）', () => {
  it('詞表讀得到', () => {
    expect(terms.length).toBeGreaterThanOrEqual(10)
  })
  it('front/src 的字串與 JSX 文字沒有舊說法', () => {
    const fs = readFiles(listFiles(FRONT_SRC, { exts: ['.ts', '.tsx'], exclude: [IS_TEST_FILE] }))
    expect(fs.length).toBeGreaterThan(10)
    const vs = findForbiddenTerms(fs, terms)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('JSX 文字與字串裡的舊說法都會紅', () => {
    const vs = findForbiddenTerms([{ path: 'x.tsx', text: `<button>保存</button>\nconst hint = '目前無資料'` }], terms)
    expect(vs.map((v) => v.rule).sort()).toEqual(['ui-terms:保存', 'ui-terms:無資料'])
  })
})
