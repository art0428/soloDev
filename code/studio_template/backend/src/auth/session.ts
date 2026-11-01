/**
 * Session：Cookie 只放隨機 token，資料庫存它的 sha256。token 外洩的風險面只有瀏覽器那一端；
 * 資料庫被讀走也還原不出 token。MCC 的 access／refresh token 存在 Session 列上，不進瀏覽器。
 */
import { createHash, randomBytes } from 'node:crypto'
import type { CookieSerializeOptions } from '@fastify/cookie'
import { cookieSecure, type Env } from '../lib/env.js'
import type { Db } from '../lib/prisma.js'

export const SESSION_COOKIE = 'sid'

export const newToken = () => randomBytes(32).toString('base64url')
export const hashToken = (token: string) => createHash('sha256').update(token).digest('hex')

export async function createSession(
  db: Db,
  input: { userId: string; ttlHours: number; mccAccessToken?: string | null; mccRefreshToken?: string | null; now?: Date },
) {
  const now = input.now ?? new Date()
  const token = newToken()
  const expiresAt = new Date(now.getTime() + input.ttlHours * 3600_000)
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: input.userId,
      expiresAt,
      mccAccessToken: input.mccAccessToken ?? null,
      mccRefreshToken: input.mccRefreshToken ?? null,
    },
  })
  return { token, expiresAt }
}

/** 用 token 找 Session 與使用者；過期的順手刪掉並回 null */
export async function findSession(db: Db, token: string, now: Date = new Date()) {
  const s = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { include: { roles: { include: { role: true } } } } },
  })
  if (!s) return null
  if (s.expiresAt.getTime() <= now.getTime()) {
    await db.session.delete({ where: { id: s.id } }).catch(() => undefined)
    return null
  }
  return s
}

export async function deleteSession(db: Db, token: string) {
  await db.session.deleteMany({ where: { tokenHash: hashToken(token) } })
}

export function sessionCookieOptions(env: Env, expiresAt: Date): CookieSerializeOptions {
  return {
    path: '/',
    httpOnly: true,
    secure: cookieSecure(env),
    sameSite: env.COOKIE_SAME_SITE,
    expires: expiresAt,
  }
}

export function clearedCookieOptions(env: Env): CookieSerializeOptions {
  return { path: '/', httpOnly: true, secure: cookieSecure(env), sameSite: env.COOKIE_SAME_SITE }
}
