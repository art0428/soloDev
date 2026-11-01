import { describe, expect, it } from 'vitest'
import { MENU, visibleMenu } from './menu'

describe('visibleMenu（純函式）', () => {
  it('沒角色限制的項目所有人都看得到；admin 項目只有 admin 看得到', () => {
    const member = visibleMenu(['member']).map((m) => m.path)
    const admin = visibleMenu(['admin', 'member']).map((m) => m.path)
    expect(member).toContain('/')
    expect(member).not.toContain('/admin')
    expect(admin).toContain('/admin')
  })
  it('每個選單項目的 path 唯一、label 不空', () => {
    const paths = MENU.map((m) => m.path)
    expect(new Set(paths).size).toBe(paths.length)
    expect(MENU.every((m) => m.label.trim().length > 0)).toBe(true)
  })
})
