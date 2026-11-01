import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { DEMO_USERS } from '@studio/demo-world'
import { loginAs, makeApp, prisma, resetDb, seed, sidFrom } from '../test/helpers.js'
import { hashToken } from './session.js'

describe('mock 登入與登出', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await makeApp() })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetDb(); await seed() })

  it('沒有 as 回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/login' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('BAD_REQUEST')
  })

  it('as 給不存在的使用者回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/login?as=nobody' })
    expect(res.statusCode).toBe(404)
    expect(res.json().error.code).toBe('NOT_FOUND')
  })

  it('mock 模式打 /auth/callback 回 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/callback?code=x&state=y' })
    expect(res.statusCode).toBe(404)
  })

  it('登入成功：302 導回前台、發 httpOnly 的 sid、資料庫只存雜湊', async () => {
    const res = await app.inject({ method: 'GET', url: `/auth/login?as=${DEMO_USERS.admin.mccSub}` })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toBe('http://front.test/')
    const sc = String(res.headers['set-cookie'])
    expect(sc).toMatch(/HttpOnly/)
    expect(sc).toMatch(/SameSite=Lax/)
    expect(sc).toMatch(/Path=\//)
    const sid = sidFrom(res.headers['set-cookie'])!
    const token = sid.split('=')[1]!
    const sessions = await prisma.session.findMany()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]!.tokenHash).toBe(hashToken(token))
    expect(sessions[0]!.tokenHash).not.toBe(token)
  })

  it('登入會更新 lastLoginAt', async () => {
    const before = await prisma.user.findUniqueOrThrow({ where: { mccSub: DEMO_USERS.member.mccSub } })
    expect(before.lastLoginAt).toBeNull()
    await loginAs(app, DEMO_USERS.member.mccSub)
    const after = await prisma.user.findUniqueOrThrow({ where: { mccSub: DEMO_USERS.member.mccSub } })
    expect(after.lastLoginAt).not.toBeNull()
  })

  it('登出：204、清 cookie、Session 刪掉，之後 /api/me 回 401', async () => {
    const cookie = await loginAs(app, DEMO_USERS.admin.mccSub)
    const out = await app.inject({ method: 'POST', url: '/auth/logout', headers: { cookie } })
    expect(out.statusCode).toBe(204)
    expect(String(out.headers['set-cookie'])).toMatch(/^sid=;/)
    expect(await prisma.session.count()).toBe(0)
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect(me.statusCode).toBe(401)
  })

  it('沒登入打登出也回 204，不洩漏狀態', async () => {
    const out = await app.inject({ method: 'POST', url: '/auth/logout' })
    expect(out.statusCode).toBe(204)
  })

  it('過期的 Session 視同沒登入，並被刪掉', async () => {
    const cookie = await loginAs(app, DEMO_USERS.admin.mccSub)
    await prisma.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } })
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect(me.statusCode).toBe(401)
    expect(await prisma.session.count()).toBe(0)
  })

  it('壞 JSON 回 400 契約格式（守衛沒掉線）', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { 'content-type': 'application/json' },
      payload: '{not json',
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.code).toBe('BAD_REQUEST')
  })
})

describe('mock 模式的測試輔助端點 /internal/test/seed-user', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await makeApp() })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetDb(); await seed() })

  it('缺欄位回 422 並逐欄位列出', async () => {
    const res = await app.inject({ method: 'POST', url: '/internal/test/seed-user', payload: { mccSub: 'x' } })
    expect(res.statusCode).toBe(422)
    const body = res.json()
    expect(body.error.code).toBe('VALIDATION_FAILED')
    expect(body.error.details.map((d: { field: string }) => d.field).sort()).toEqual(['mccSub', 'name'])
  })

  it('建好使用者並回登入網址；同一個 mccSub 重跑是冪等', async () => {
    const payload = { mccSub: 'e2e-login', name: 'E2E 登入員', roles: ['admin', 'member'] }
    const a = await app.inject({ method: 'POST', url: '/internal/test/seed-user', payload })
    expect(a.statusCode).toBe(201)
    expect(a.json().loginUrl).toBe('http://api.test/auth/login?as=e2e-login')
    const b = await app.inject({ method: 'POST', url: '/internal/test/seed-user', payload })
    expect(b.statusCode).toBe(201)
    expect(await prisma.user.count({ where: { mccSub: 'e2e-login' } })).toBe(1)
    const cookie = await loginAs(app, 'e2e-login')
    const me = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie } })
    expect(me.json().roles).toEqual(['admin', 'member'])
  })

  it('mcc 模式沒有這個端點', async () => {
    const mcc = await makeApp({ AUTH_MODE: 'mcc', MCC_CLIENT_ID: 'c', MCC_CLIENT_SECRET: 's' })
    try {
      const res = await mcc.inject({ method: 'POST', url: '/internal/test/seed-user', payload: { mccSub: 'x', name: 'y' } })
      expect(res.statusCode).toBe(404)
    } finally {
      await mcc.close()
    }
  })
})
