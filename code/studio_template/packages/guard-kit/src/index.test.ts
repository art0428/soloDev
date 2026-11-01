/** guard-kit 自己的測試：去註解、抓中文字串、詞表解析，各驗正反例。由 backend 的 vitest 一起跑（見 backend/vitest.config.ts include）。 */
import { describe, expect, it } from 'vitest'
import { cjkStrings, findForbiddenTerms, findViolations, parseForbiddenTerms, stripComments } from './index.js'

describe('stripComments', () => {
  it('去掉 // 與 /* */，保留行數，不切 http://', () => {
    const src = `const a = 1 // 註解\n/* 區塊\n註解 */ const u = 'http://x.test/' // 尾`
    const out = stripComments(src)
    expect(out.split('\n')).toHaveLength(3)
    expect(out).not.toContain('註解')
    expect(out).toContain("'http://x.test/'")
  })
  it('字串裡的 // 不是註解', () => {
    expect(stripComments(`const s = "a // b"`)).toContain('a // b')
  })
})

describe('cjkStrings', () => {
  it('抓字串與 JSX 文字，不抓識別字與註解', () => {
    const src = `// 這是註解\nconst role = 'admin'\nconst msg = '請先登入。'\nconst j = <p>目前沒有資料</p>`
    const got = cjkStrings(src).map((s) => s.text)
    expect(got).toEqual(['請先登入。', '目前沒有資料'])
  })
})

describe('parseForbiddenTerms', () => {
  it('讀「不要用」欄、拆頓號、去括號與刪節號、丟單字', () => {
    const md = `# 詞表\n| 這件事 | 唯一說法 | 不要用 | 例外 |\n|---|---|---|---|\n| 存 | 儲存 | 保存、存檔、Save | 無 |\n| 新增 | 新增… | 建立…、添加…（口語） | 無 |\n| 清單沒資料 | 目前沒有資料 | 無資料、空 | 無 |\n| x | y | — | |\n\n文字\n\n| 這件事 | 唯一說法 | 不要用 |\n|---|---|---|\n| z | 返回 | 回上一頁 |`
    expect(parseForbiddenTerms(md)).toEqual(['保存', '回上一頁', '存檔', '建立', '添加', '無資料'])
  })
})

describe('findViolations / findForbiddenTerms', () => {
  it('塞一行違規會紅、guard: allow 放行', () => {
    const files = [{ path: 'x.ts', text: `const a = new Date().getHours()\nconst b = new Date().getHours() // guard: allow` }]
    const vs = findViolations(files, [{ name: 'local-clock', re: /\.getHours\(/ }])
    expect(vs).toHaveLength(1)
    expect(vs[0]!.line).toBe(1)
  })
  it('詞表守衛：字串裡有舊說法會紅，識別字不會', () => {
    const files = [{ path: 'y.tsx', text: `const save = '保存'\nconst t = <button>儲存</button>\nconst ok = '保存' // guard: allow` }]
    const vs = findForbiddenTerms(files, ['保存'])
    expect(vs).toHaveLength(1)
    expect(vs[0]!.line).toBe(1)
  })
})
