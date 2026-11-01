import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { DEMO_USERS } from '@studio/demo-world'
import { loginAs, makeApp, resetDb, seed } from '../test/helpers.js'

describe('/api/me 與 /api/admin/ping', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await makeApp() })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetDb(); await seed() })

  // 失敗路徑先寫（CLAUDE.md 第 5 節）
  it('沒登入打 /api/me 回 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me' })
    expect(res.statusCode).toBe(401)
    expect(res.json().error.code).toBe('UNAUTHORIZED')
  })

  it('亂給的 cookie 回 401，而且會被清掉', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: 'sid=not-a-real-token' } })
    expect(res.statusCode).toBe(401)
    const sc = String(res.headers['set-cookie'] ?? '')
    expect(sc).toMatch(/^sid=;/)
  })

  it('一般成員打 /api/admin/ping 回 403', async () => {
    const cookie = await loginAs(app, DEMO_USERS.member.mccSub)
    const res = await app.inject({ method: 'GET', url: '/api/admin/ping', headers: { cookie } })
    expect(res.statusCode).toBe(403)
    expect(res.json()).toEqual({ error: { code: 'FORBIDDEN', message: '你沒有這個功能的使用權限。' } })
  })

  it('沒登入打 /api/admin/ping 回 401（不是 403）', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/admin/ping' })
    expect(res.statusCode).toBe(401)
  })

  it('登入後 /api/me 回名稱、角色與 ISO 時刻', async () => {
    const cookie = await loginAs(app, DEMO_USERS.admin.mccSub)
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    const me = res.json()
    expect(me.name).toBe(DEMO_USERS.admin.name)
    expect(me.email).toBe(DEMO_USERS.admin.email)
    expect(me.roles).toEqual(['admin', 'member'])
    expect(me.createdAtInstant).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
    expect(me.lastLoginAtInstant).toMatch(/Z$/)
    expect(me).not.toHaveProperty('mccSub')
  })

  it('管理員打 /api/admin/ping 回 200', async () => {
    const cookie = await loginAs(app, DEMO_USERS.admin.mccSub)
    const res = await app.inject({ method: 'GET', url: '/api/admin/ping', headers: { cookie } })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true })
  })
})
