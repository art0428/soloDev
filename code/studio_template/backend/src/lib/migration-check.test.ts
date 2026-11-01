import { describe, expect, it } from 'vitest'
import { checkPendingMigrations, diffMigrations, formatMigrationCheck, listAppliedMigrations, listMigrationsOnDisk } from './migration-check.js'
import { prisma } from './prisma.js'

describe('diffMigrations（純函式）', () => {
  it('repo 有、庫沒有 → pending；庫有、repo 沒有 → unknown', () => {
    const d = diffMigrations(['a', 'b', 'c'], ['a', 'z'])
    expect(d).toEqual({ pending: ['b', 'c'], unknown: ['z'] })
  })
  it('完全一致 → 兩邊都空', () => {
    expect(diffMigrations(['a'], ['a'])).toEqual({ pending: [], unknown: [] })
  })
})

describe('formatMigrationCheck', () => {
  it('ok／no_table／error 不印東西', () => {
    expect(formatMigrationCheck({ status: 'ok', pending: [], unknown: [] })).toBe('')
    expect(formatMigrationCheck({ status: 'no_table', pending: [], unknown: [] })).toBe('')
    expect(formatMigrationCheck({ status: 'error', pending: [], unknown: [], error: 'x' })).toBe('')
  })
  it('pending 列出名稱與指令', () => {
    const s = formatMigrationCheck({ status: 'pending', pending: ['20261101000000_init'], unknown: [] })
    expect(s).toContain('落後 1 支')
    expect(s).toContain('20261101000000_init')
    expect(s).toContain('prisma:migrate')
  })
})

describe('checkPendingMigrations（接真資料庫）', () => {
  it('repo 的 migration 目錄至少有 init', () => {
    expect(listMigrationsOnDisk()).toContain('20261101000000_init')
  })
  it('push 模式建的測試庫沒有 _prisma_migrations → no_table；migrate 模式 → ok', async () => {
    const r = await checkPendingMigrations({ applied: () => listAppliedMigrations(prisma) })
    expect(['no_table', 'ok']).toContain(r.status)
  })
  it('applied 丟錯 → error 不往外丟（這是提醒，不能把服務弄倒）', async () => {
    const r = await checkPendingMigrations({ applied: async () => { throw new Error('db down') } })
    expect(r.status).toBe('error')
  })
})
