/**
 * /auth/login、/auth/callback、/auth/logout。
 * mcc：導向 MCC → 回來換 token → 以 sub 找或建使用者 → 發 Session Cookie。
 * mock：/auth/login?as=<mccSub> 直接以種子使用者登入（只准本機與測試，env.ts 會擋正式環境）。
 */
import { randomBytes } from 'node:crypto'
import type { FastifyInstance } from 'fastify'
import { badRequest, notFound } from '../lib/errors.js'
import { cookieSecure } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { buildAuthorizeUrl, exchangeCode, profileFromIdToken, readJwtClaims } from './oidc.js'
import { logoutMember } from './mcc-member.js'
import { SESSION_COOKIE, clearedCookieOptions, createSession, deleteSession, sessionCookieOptions } from './session.js'

const STATE_COOKIE = 'oidc_state'
const STATE_TTL_SEC = 600

/** 第一位登入的人自動成為管理員（D1），之後的都是一般成員；既有使用者不改角色。 */
async function findOrCreateUser(p: { sub: string; name: string; email: string | null; avatarUrl: string | null }) {
  const existing = await prisma.user.findUnique({ where: { mccSub: p.sub } })
  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data: { name: p.name, email: p.email, avatarUrl: p.avatarUrl, lastLoginAt: new Date() },
    })
  }
  const count = await prisma.user.count()
  const codes = count === 0 ? ['admin', 'member'] : ['member']
  const roles = await prisma.role.findMany({ where: { code: { in: codes } } })
  if (roles.length !== codes.length) throw new Error('角色資料表沒有 admin／member，請先跑 prisma:seed 放入角色')
  return prisma.user.create({
    data: {
      mccSub: p.sub,
      name: p.name,
      email: p.email,
      avatarUrl: p.avatarUrl,
      lastLoginAt: new Date(),
      roles: { create: roles.map((r) => ({ roleId: r.id })) },
    },
  })
}

export async function authRoutes(app: FastifyInstance) {
  const env = app.env

  app.get<{ Querystring: { as?: string } }>(
    '/auth/login',
    { schema: { querystring: { type: 'object', properties: { as: { type: 'string' } } } } },
    async (req, reply) => {
      if (env.AUTH_MODE === 'mock') {
        const as = req.query.as
        if (!as) throw badRequest('mock 模式需要 as 參數，例如 /auth/login?as=mock-admin。')
        const user = await prisma.user.findUnique({ where: { mccSub: as } })
        if (!user) throw notFound(`使用者 ${as}`)
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
        const s = await createSession(prisma, { userId: user.id, ttlHours: env.SESSION_TTL_HOURS })
        reply.setCookie(SESSION_COOKIE, s.token, sessionCookieOptions(env, s.expiresAt))
        return reply.redirect(`${env.FRONT_URL}/`, 302)
      }
      const state = randomBytes(16).toString('base64url')
      const nonce = randomBytes(16).toString('base64url')
      reply.setCookie(STATE_COOKIE, `${state}.${nonce}`, {
        path: '/auth',
        httpOnly: true,
        secure: cookieSecure(env),
        sameSite: 'lax',
        maxAge: STATE_TTL_SEC,
        signed: true,
      })
      return reply.redirect(await buildAuthorizeUrl(env, state, nonce), 302)
    },
  )

  app.get<{ Querystring: { code?: string; state?: string; error?: string; error_description?: string } }>(
    '/auth/callback',
    async (req, reply) => {
      if (env.AUTH_MODE !== 'mcc') throw notFound('這個路徑')
      const { code, state, error, error_description } = req.query
      if (error) throw badRequest(`MCC 登入失敗：${error_description || error}`)
      if (!code || !state) throw badRequest('登入回應缺 code 或 state，請重新登入。')
      const raw = req.cookies[STATE_COOKIE]
      const unsigned = raw ? req.unsignCookie(raw) : null
      reply.clearCookie(STATE_COOKIE, { path: '/auth' })
      if (!unsigned?.valid) throw badRequest('登入狀態已失效，請重新登入。')
      const [expectState, expectNonce] = unsigned.value.split('.')
      if (state !== expectState) throw badRequest('登入狀態不符，請重新登入。')

      const tokens = await exchangeCode(env, code)
      const profile = profileFromIdToken(readJwtClaims(tokens.id_token))
      if (profile.nonce && profile.nonce !== expectNonce) throw badRequest('登入狀態不符，請重新登入。')

      const user = await findOrCreateUser(profile)
      const s = await createSession(prisma, {
        userId: user.id,
        ttlHours: env.SESSION_TTL_HOURS,
        mccAccessToken: tokens.access_token,
        mccRefreshToken: tokens.refresh_token ?? null,
      })
      reply.setCookie(SESSION_COOKIE, s.token, sessionCookieOptions(env, s.expiresAt))
      return reply.redirect(`${env.FRONT_URL}/`, 302)
    },
  )

  app.post('/auth/logout', async (req, reply) => {
    const token = req.sessionToken
    if (token) {
      const s = await prisma.session.findUnique({ where: { tokenHash: (await import('./session.js')).hashToken(token) } })
      if (s?.mccAccessToken && req.user) await logoutMember(env, s.mccAccessToken, req.user.mccSub)
      await deleteSession(prisma, token)
    }
    reply.clearCookie(SESSION_COOKIE, clearedCookieOptions(env))
    return reply.code(204).send()
  })
}
