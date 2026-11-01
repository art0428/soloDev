/**
 * 守衛：畫面用語（docs/ui-terms.md「不要用」欄的中文詞）。後端這邊掃的是錯誤訊息、通知、Email 內文這類會到使用者眼前的字串。
 * 只看含中文的字串，不看識別字；測試檔不掃。例外在那一行加 `guard: allow`。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { findForbiddenTerms, formatViolations, listFiles, parseForbiddenTerms, readFiles } from '@studio/guard-kit'
import { BACKEND_SRC, IS_TEST_FILE, ROOT } from './_paths.js'

const terms = parseForbiddenTerms(readFileSync(`${ROOT}docs/ui-terms.md`, 'utf8'))

describe('守衛：畫面用語（後端字串）', () => {
  it('詞表讀得到、至少有十個詞', () => {
    expect(terms.length).toBeGreaterThanOrEqual(10)
    expect(terms).toContain('保存')
  })
  it('後端程式的中文字串沒有舊說法', () => {
    const fs = readFiles(listFiles(BACKEND_SRC, { exts: ['.ts'], exclude: [IS_TEST_FILE] }))
    expect(fs.length).toBeGreaterThan(10)
    const vs = findForbiddenTerms(fs, terms)
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('塞一句舊說法會紅', () => {
    const vs = findForbiddenTerms([{ path: 'x.ts', text: `throw new AppError(422, 'X', '無資料，請稍候')` }], terms)
    expect(vs.map((v) => v.rule).sort()).toEqual(['ui-terms:無資料', 'ui-terms:請稍候'])
  })
})
