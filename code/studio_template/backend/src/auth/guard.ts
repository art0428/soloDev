/**
 * 登入狀態與角色守衛。
 * authPlugin 在每個請求一開始解出 request.user（有 Cookie 才查一次資料庫）；
 * 路由用 requireLogin／requireRole 當 preHandler。權限判斷只看 request.user.roles，是純函式，好測。
 */
import type { FastifyInstance, FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify'
import { forbidden, unauthorized } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { accessTokenNeedsRefresh, refreshTokens } from './oidc.js'
import { checkMember, memberApiEnabled } from './mcc-member.js'
import { SESSION_COOKIE, clearedCookieOptions, deleteSession, findSession } from './session.js'

export type AuthUser = {
  id: string
  mccSub: string
  name: string
  email: string | null
  avatarUrl: string | null
  roles: string[]
  createdAt: Date
  lastLoginAt: Date | null
}

/** 多久向 MCC 複驗一次會員仍有效（秒）。太密會拖慢每個請求，太疏撤銷會晚生效。 */
const MEMBER_CHECK_INTERVAL_SEC = 60

export async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('user', null)
  app.decorateRequest('sessionToken', null)

  app.addHook('onRequest', async (req, reply) => {
    const token = req.cookies[SESSION_COOKIE]
    if (!token) return
    const s = await findSession(prisma, token)
    if (!s) {
      reply.clearCookie(SESSION_COOKIE, clearedCookieOptions(app.env))
      return
    }

    // mcc 模式且有 Group JWT：定期向 MCC 複驗；access_token 過期先用 refresh 續期
    if (memberApiEnabled(app.env) && s.mccAccessToken) {
      const stale = !s.lastCheckedAt || Date.now() - s.lastCheckedAt.getTime() > MEMBER_CHECK_INTERVAL_SEC * 1000
      if (stale) {
        let access = s.mccAccessToken
        let refresh = s.mccRefreshToken
        if (accessTokenNeedsRefresh(access)) {
          const r = await refreshTokens(app.env, refresh ?? '')
          if (r.status === 'invalid') {
            await deleteSession(prisma, token)
            reply.clearCookie(SESSION_COOKIE, clearedCookieOptions(app.env))
            return
          }
          if (r.status === 'ok') {
            access = r.accessToken
            refresh = r.refreshToken ?? refresh
          }
        }
        const memberStatus = await checkMember(app.env, access, s.user.mccSub)
        if (memberStatus === 'revoked') {
          await deleteSession(prisma, token)
          reply.clearCookie(SESSION_COOKIE, clearedCookieOptions(app.env))
          return
        }
        if (memberStatus === 'error') req.log.warn({ userId: s.userId }, 'MCC member/check 無法完成，降級放行')
        await prisma.session.update({
          where: { id: s.id },
          data: { lastCheckedAt: new Date(), mccAccessToken: access, mccRefreshToken: refresh },
        })
      }
    }

    req.sessionToken = token
    req.user = {
      id: s.user.id,
      mccSub: s.user.mccSub,
      name: s.user.name,
      email: s.user.email,
      avatarUrl: s.user.avatarUrl,
      roles: s.user.roles.map((ur) => ur.role.code).sort(),
      createdAt: s.user.createdAt,
      lastLoginAt: s.user.lastLoginAt,
    }
  })
}

/** 純函式：這組角色能不能通過「需要其中任一角色」的門 */
export const hasAnyRole = (userRoles: readonly string[], required: readonly string[]) =>
  required.length === 0 || required.some((r) => userRoles.includes(r))

export const requireLogin: preHandlerHookHandler = async (req: FastifyRequest, _reply: FastifyReply) => {
  if (!req.user) throw unauthorized()
}

/** 要求登入且角色含其中任一個；沒登入 401、登入了但角色不對 403 */
export const requireRole = (...roles: string[]): preHandlerHookHandler =>
  async (req: FastifyRequest, _reply: FastifyReply) => {
    if (!req.user) throw unauthorized()
    if (!hasAnyRole(req.user.roles, roles)) throw forbidden()
  }
