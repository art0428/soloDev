/**
 * 守衛：真實資料不准進程式（D3）。掃 backend、tests、prisma、scripts 的原始碼（含註解），
 * 擋 @studio/demo-world 的 REAL_DATA_FORBIDDEN 清單裡的字（你公司、你客戶、真實品牌）。
 * 清單預設是空的，守衛仍要能運作：第二題塞一個假的禁字進去驗它會紅。
 */
import { describe, expect, it } from 'vitest'
import { REAL_DATA_FORBIDDEN } from '@studio/demo-world'
import { findViolations, formatViolations, listFiles, readFiles, type Rule } from '@studio/guard-kit'
import { BACKEND_PRISMA, BACKEND_SCRIPTS, BACKEND_SRC, CONTRACT_DIR, E2E_DIR, ROOT } from './_paths.js'

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const rulesFor = (terms: readonly string[]): Rule[] => terms.map((t) => ({ name: `real-data:${t}`, re: new RegExp(escape(t)) }))

const files = () =>
  readFiles([
    ...listFiles(BACKEND_SRC, { exts: ['.ts'] }),
    ...listFiles(BACKEND_PRISMA, { exts: ['.ts', '.prisma', '.sql'] }),
    ...listFiles(BACKEND_SCRIPTS, { exts: ['.ts', '.sh', '.mjs'] }),
    ...listFiles(E2E_DIR, { exts: ['.ts'] }),
    ...listFiles(CONTRACT_DIR, { exts: ['.ts'] }),
  ])

describe('守衛：真實資料', () => {
  it('後端、測試、seed、腳本裡沒有 REAL_DATA_FORBIDDEN 的字', () => {
    const fs = files()
    expect(fs.length).toBeGreaterThan(15)
    const vs = findViolations(fs, rulesFor(REAL_DATA_FORBIDDEN), { stripComments: false })
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })

  it('塞一行真實公司名會紅（清單為空時也驗得到機制）', () => {
    const vs = findViolations(
      [{ path: 'fake.ts', text: `const customer = '某某真實公司股份有限公司'` }],
      rulesFor(['某某真實公司']),
      { stripComments: false },
    )
    expect(vs).toHaveLength(1)
  })

  it('示範世界的資料本身不含禁字（清單所在的 forbidden.ts 除外）', () => {
    const demoFiles = readFiles(listFiles(`${ROOT}packages/demo-world/src`, { exts: ['.ts'], exclude: [/[\\/]forbidden\.ts$/] }))
    expect(demoFiles.length).toBeGreaterThan(0)
    const vs = findViolations(demoFiles, rulesFor(REAL_DATA_FORBIDDEN), { stripComments: false })
    expect(vs, formatViolations(vs, ROOT)).toHaveLength(0)
  })

  it('清單填了之後，自我檢查不會被清單本身弄紅', () => {
    const demoFiles = readFiles(listFiles(`${ROOT}packages/demo-world/src`, { exts: ['.ts'], exclude: [/[\\/]forbidden\.ts$/] }))
    expect(demoFiles.some((f) => /forbidden\.ts$/.test(f.path))).toBe(false)
    const list = { path: 'forbidden.ts', text: `export const REAL_DATA_FORBIDDEN = ['某某真實公司']` }
    expect(findViolations(demoFiles, rulesFor(['某某真實公司']), { stripComments: false })).toHaveLength(0)
    expect(findViolations([list], rulesFor(['某某真實公司']), { stripComments: false })).toHaveLength(1)
  })
})
