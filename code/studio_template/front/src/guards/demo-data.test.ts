// @vitest-environment node
/** 守衛：真實資料不准進前台程式（D3）。清單在 @studio/demo-world 的 REAL_DATA_FORBIDDEN。 */
import { describe, expect, it } from 'vitest'
import { REAL_DATA_FORBIDDEN } from '@studio/demo-world'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { FRONT_SRC, ROOT } from './_paths'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rulesFor = (terms: readonly string[]): Rule[] => terms.map((t) => ({ name: `real-data:${t}`, re: new RegExp(escape(t)) }))

describe('守衛：真實資料（前台）', () => {
  it('front/src 沒有 REAL_DATA_FORBIDDEN 的字（含註解與測試）', () => {
    const fs = readFiles(listFiles(FRONT_SRC, { exts: ['.ts', '.tsx', '.css'] }))
    expect(fs.length).toBeGreaterThan(20)
    const vs = findViolations(fs, rulesFor(REAL_DATA_FORBIDDEN), { stripComments: false })
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })
  it('塞一行會紅', () => {
    const vs = findViolations([{ path: 'x.tsx', text: `<p>某某真實公司</p>` }], rulesFor(['某某真實公司']), { stripComments: false })
    expect(vs).toHaveLength(1)
  })
})
