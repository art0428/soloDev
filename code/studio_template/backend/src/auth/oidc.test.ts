/**
 * mcc 模式的登入流程，用 MSW 假扮 MCC（https://mcc.test）。
 * 假服務要像真的：沒帶對 client_secret 回 401、code 用過一次就失效、state 不符要擋。
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { FastifyInstance } from 'fastify'
import { TEST_ENV_MCC, fakeJwt, makeApp, prisma, resetDb, seed, sidFrom } from '../test/helpers.js'
import { clearDiscoveryCache } from './oidc.js'

const ISSUER = 'https://mcc.test'
const usedCodes = new Set<string>()
let memberCheckCalls = 0
let memberCheckAnswer: 'valid' | 'revoked' | 'group-error' = 'valid'

const mcc = setupServer(
  http.get(`${ISSUER}/.well-known/openid-configuration`, () =>
    HttpResponse.json({
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}/oauth/authorize`,
      token_endpoint: `${ISSUER}/oauth/token`,
    }),
  ),
  http.post(`${ISSUER}/oauth/token`, async ({ request }) => {
    const form = new URLSearchParams(await request.text())
    if (form.get('client_id') !== 'test-client-id' || form.get('client_secret') !== 'test-client-secret') {
      return HttpResponse.json({ error: 'invalid_client' }, { status: 401 })
    }
    if (form.get('grant_type') === 'refresh_token') {
      if (form.get('refresh_token') === 'rt-dead') return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })
      return HttpResponse.json({ access_token: fakeJwt({ exp: Math.floor(Date.now() / 1000) + 900 }), refresh_token: 'rt-2', expires_in: 900 })
    }
    const code = form.get('code') ?? ''
    if (!code.startsWith('code~') || usedCodes.has(code)) return HttpResponse.json({ error: 'invalid_grant' }, { status: 400 })
    usedCodes.add(code)
    const [, sub, nonce] = code.split('~')
    return HttpResponse.json({
      access_token: fakeJwt({ sub, exp: Math.floor(Date.now() / 1000) + 900 }),
      refresh_token: 'rt-1',
      expires_in: 900,
      id_token: fakeJwt({ sub, name: `會員 ${sub}`, email: `${sub}@mcc.test`, picture: `https://mcc.test/a/${sub}.png`, nonce }),
    })
  }),
  http.post(`${ISSUER}/member/check`, ({ request }) => {
    memberCheckCalls++
    if (request.headers.get('authorization') !== 'Bearer group-jwt') return HttpResponse.json({ error: 'FORBIDDEN', details: { reason: 'invalid_jwt_encoding' } }, { status: 403 })
    if (memberCheckAnswer === 'group-error') return HttpResponse.json({ error_code: 'GROUP_NOT_INITIATED' }, { status: 403 })
    if (memberCheckAnswer === 'revoked') return HttpResponse.json({ success: false, error_code: 'MEMBER_REVOKED' }, { status: 401 })
    return HttpResponse.json({ success: true, data: { ttl: 3600 } })
  }),
  http.post(`${ISSUER}/member/logout`, () => HttpResponse.json({ success: true })),
)

/** 走完 /auth/login → 假裝 MCC 回來 → /auth/callback，回 sid cookie 與 callback 回應 */
async function fullLogin(app: FastifyInstance, sub: string) {
  const start = await app.inject({ method: 'GET', url: '/auth/login' })
  expect(start.statusCode).toBe(302)
  const loc = new URL(start.headers.location as string)
  const state = loc.searchParams.get('state')!
  const nonce = loc.searchParams.get('nonce')!
  const stateCookie = String(start.headers['set-cookie']).split(';')[0]!
  const cb = await app.inject({
    method: 'GET',
    url: `/auth/callback?code=code~${sub}~${nonce}&state=${state}`,
    headers: { cookie: stateCookie },
  })
  expect(cb.statusCode, cb.body).toBe(302)
  return { cb, sid: sidFrom(cb.headers['set-cookie']) }
}

describe('mcc 模式登入流程', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    mcc.listen({ onUnhandledRequest: 'error' })
    app = await makeApp(TEST_ENV_MCC)
  })
  afterAll(async () => { await app.close(); mcc.close() })
  beforeEach(async () => { await resetDb(); await seed(); clearDiscoveryCache(); usedCodes.clear(); memberCheckCalls = 0; memberCheckAnswer = 'valid' })
  afterEach(() => mcc.resetHandlers())

  it('/auth/login 導向 MCC 並帶 state、nonce、offline_access', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/login' })
    expect(res.statusCode).toBe(302)
    const u = new URL(res.headers.location as string)
    expect(u.origin + u.pathname).toBe(`${ISSUER}/oauth/authorize`)
    expect(u.searchParams.get('client_id')).toBe('test-client-id')
    expect(u.searchParams.get('redirect_uri')).toBe('http://api.test/auth/callback')
    expect(u.searchParams.get('scope')).toContain('offline_access')
    expect(u.searchParams.get('state')).toBeTruthy()
    expect(u.searchParams.get('nonce')).toBeTruthy()
    expect(String(res.headers['set-cookie'])).toMatch(/^oidc_state=.*HttpOnly/)
  })

  it('callback 缺 code 回 400', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/callback?state=x' })
    expect(res.statusCode).toBe(400)
  })

  it('callback 沒帶 state cookie 回 400（防 CSRF）', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/callback?code=code~u1~n&state=whatever' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toMatch(/重新登入/)
  })

  it('callback state 與 cookie 不符回 400', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/login' })
    const stateCookie = String(start.headers['set-cookie']).split(';')[0]!
    const res = await app.inject({ method: 'GET', url: '/auth/callback?code=code~u1~n&state=forged', headers: { cookie: stateCookie } })
    expect(res.statusCode).toBe(400)
    expect(await prisma.session.count()).toBe(0)
  })

  it('MCC 回 error 參數時回 400 並帶原因', async () => {
    const res = await app.inject({ method: 'GET', url: '/auth/callback?error=access_denied&error_description=user%20cancelled' })
    expect(res.statusCode).toBe(400)
    expect(res.json().error.message).toContain('user cancelled')
  })

  it('第一位登入的人成為管理員，第二位是一般成員；以 sub 為主鍵', async () => {
    await resetDb()
    await prisma.role.createMany({ data: [{ code: 'admin', name: '管理員' }, { code: 'member', name: '一般成員' }] })
    const a = await fullLogin(app, 'first')
    expect(a.cb.statusCode).toBe(302)
    expect(a.cb.headers.location).toBe('http://front.test/')
    expect(a.sid).toBeTruthy()
    const b = await fullLogin(app, 'second')
    expect(b.sid).toBeTruthy()
    const meA = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: a.sid! } })
    const meB = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: b.sid! } })
    expect(meA.json().roles).toEqual(['admin', 'member'])
    expect(meA.json().name).toBe('會員 first')
    expect(meA.json().avatarUrl).toBe('https://mcc.test/a/first.png')
    expect(meB.json().roles).toEqual(['member'])
    const users = await prisma.user.findMany({ orderBy: { mccSub: 'asc' } })
    expect(users.map((u) => u.mccSub)).toEqual(['first', 'second'])
  })

  it('同一個 sub 再登入不會建第二個使用者，角色不變，名稱更新', async () => {
    await fullLogin(app, 'mock-admin')
    const again = await fullLogin(app, 'mock-admin')
    expect(again.cb.statusCode).toBe(302)
    expect(await prisma.user.count({ where: { mccSub: 'mock-admin' } })).toBe(1)
    const u = await prisma.user.findUniqueOrThrow({ where: { mccSub: 'mock-admin' }, include: { roles: { include: { role: true } } } })
    expect(u.name).toBe('會員 mock-admin')
    expect(u.roles.map((r) => r.role.code).sort()).toEqual(['admin', 'member'])
  })

  it('MCC 的 token 存在 Session、不在 Cookie', async () => {
    const { sid } = await fullLogin(app, 'u1')
    const s = await prisma.session.findFirstOrThrow()
    expect(s.mccAccessToken).toBeTruthy()
    expect(s.mccRefreshToken).toBe('rt-1')
    expect(sid).not.toContain(s.mccAccessToken!)
  })

  it('同一個 code 用第二次失敗（假 MCC 跟真的一樣嚴）', async () => {
    const start = await app.inject({ method: 'GET', url: '/auth/login' })
    const loc = new URL(start.headers.location as string)
    const state = loc.searchParams.get('state')!, nonce = loc.searchParams.get('nonce')!
    const stateCookie = String(start.headers['set-cookie']).split(';')[0]!
    const first = await app.inject({ method: 'GET', url: `/auth/callback?code=code~u2~${nonce}&state=${state}`, headers: { cookie: stateCookie } })
    expect(first.statusCode).toBe(302)
    const second = await app.inject({ method: 'GET', url: `/auth/callback?code=code~u2~${nonce}&state=${state}`, headers: { cookie: stateCookie } })
    expect(second.statusCode).toBe(500)
  })
})

describe('mcc 模式的 member/check 複驗（有 Group JWT 才啟用）', () => {
  let app: FastifyInstance
  beforeAll(async () => {
    mcc.listen({ onUnhandledRequest: 'error' })
    app = await makeApp({ ...TEST_ENV_MCC, MCC_GROUP_JWT: 'group-jwt' })
  })
  afterAll(async () => { await app.close(); mcc.close() })
  beforeEach(async () => { await resetDb(); await seed(); clearDiscoveryCache(); usedCodes.clear(); memberCheckCalls = 0; memberCheckAnswer = 'valid' })

  it('第一次請求打一次 member/check，60 秒內不再打', async () => {
    const { sid } = await fullLogin(app, 'c1')
    await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    expect(memberCheckCalls).toBe(1)
  })

  it('MCC 說會員已撤銷 → 401 並刪 Session', async () => {
    const { sid } = await fullLogin(app, 'c2')
    memberCheckAnswer = 'revoked'
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    expect(res.statusCode).toBe(401)
    expect(await prisma.session.count()).toBe(0)
  })

  it('群組層設定問題 → 降級放行，不踢人', async () => {
    const { sid } = await fullLogin(app, 'c3')
    memberCheckAnswer = 'group-error'
    const res = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    expect(res.statusCode).toBe(200)
  })

  it('access_token 過期先 refresh；refresh 失效才 401', async () => {
    const { sid } = await fullLogin(app, 'c4')
    const expired = fakeJwt({ sub: 'c4', exp: Math.floor(Date.now() / 1000) - 10 })
    await prisma.session.updateMany({ data: { mccAccessToken: expired, lastCheckedAt: null } })
    const ok = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    expect(ok.statusCode).toBe(200)
    expect((await prisma.session.findFirstOrThrow()).mccRefreshToken).toBe('rt-2')

    await prisma.session.updateMany({ data: { mccAccessToken: expired, mccRefreshToken: 'rt-dead', lastCheckedAt: null } })
    const dead = await app.inject({ method: 'GET', url: '/api/me', headers: { cookie: sid! } })
    expect(dead.statusCode).toBe(401)
    expect(await prisma.session.count()).toBe(0)
  })
})
