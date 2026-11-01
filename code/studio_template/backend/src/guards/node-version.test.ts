/**
 * 守衛：Node 主版本只有一個來源（.node-version），其他地方都要跟它一樣：
 * 根目錄 package.json 的 engines.node、.github/workflows/check.yml、deploy/ 的 Dockerfile（有的話）。
 * 本機與正式機跑不同主版本，同一份程式會在其中一邊炸（例如 fetch、Intl 的行為差異）。
 */
import { existsSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { listFiles } from '@studio/guard-kit'
import { ROOT } from './_paths.js'

const nodeVersion = readFileSync(`${ROOT}.node-version`, 'utf8').trim()
const major = Number(nodeVersion.split('.')[0])

describe('守衛：Node 主版本一致', () => {
  it('.node-version 是一個合理的主版本', () => {
    expect(major).toBeGreaterThanOrEqual(22)
  })
  it('根目錄 package.json 的 engines.node 指向同一個主版本', () => {
    const pkg = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as { engines?: { node?: string } }
    const m = /(\d+)/.exec(pkg.engines?.node ?? '')
    expect(m, 'engines.node 要寫版本').not.toBeNull()
    expect(Number(m![1])).toBe(major)
  })
  it('check.yml 用 .node-version（node-version-file），或寫同一個主版本', () => {
    const p = `${ROOT}.github/workflows/check.yml`
    expect(existsSync(p)).toBe(true)
    const y = readFileSync(p, 'utf8')
    const usesFile = /node-version-file:\s*['"]?\.node-version/.test(y)
    const pinned = [...y.matchAll(/node-version:\s*['"]?(\d+)/g)].map((m) => Number(m[1]))
    expect(usesFile || (pinned.length > 0 && pinned.every((v) => v === major))).toBe(true)
  })
  it('deploy/ 的每個 Dockerfile FROM node:<同一個主版本>', () => {
    const files = listFiles(`${ROOT}deploy`, { exts: ['Dockerfile', '.backend', '.admin', '.front'] }).filter((f) => /Dockerfile/.test(f))
    for (const f of files) {
      const froms = [...readFileSync(f, 'utf8').matchAll(/^FROM\s+node:(\d+)/gm)].map((m) => Number(m[1]))
      expect(froms.length, `${f} 要有 FROM node:<版本>`).toBeGreaterThan(0)
      expect(froms.every((v) => v === major), `${f} 的 Node 版本與 .node-version 不同`).toBe(true)
    }
  })
  it('目前跑測試的 Node 就是那個主版本（本機與 CI 都要對）', () => {
    expect(Number(process.versions.node.split('.')[0])).toBe(major)
  })
})
