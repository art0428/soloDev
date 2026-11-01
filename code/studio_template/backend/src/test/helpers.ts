/**
 * 測試共用：建 app、清庫、seed、登入拿 Cookie。
 * 每個測試檔自己 beforeAll(makeApp) 與 beforeEach(resetDb)，檔與檔之間不共用狀態。
 */
import type { FastifyInstance } from 'fastify'
import { buildApp } from '../app.js'
import { loadEnv, type Env } from '../lib/env.js'
import { prisma } from '../lib/prisma.js'
import { seedDemo } from '../lib/seed-demo.js'
import { SESSION_COOKIE } from '../auth/session.js'

export const TEST_ENV_BASE: Record<string, string> = {
  NODE_ENV: 'test',
  LOG_LEVEL: 'silent',
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
  AUTH_MODE: 'mock',
  API_URL: 'http://api.test',
  FRONT_URL: 'http://front.test',
  BUSINESS_TZ: 'Asia/Taipei',
  MCC_ISSUER: 'https://mcc.test',
}

/** mcc 模式的測試環境（MSW 假扮 https://mcc.test） */
export const TEST_ENV_MCC: Record<string, string> = {
  ...TEST_ENV_BASE,
  AUTH_MODE: 'mcc',
  MCC_CLIENT_ID: 'test-client-id',
  MCC_CLIENT_SECRET: 'test-client-secret',
  MCC_SERVICE_CODE: 'test-service',
}

export function testEnv(over: Record<string, string> = {}): Env {
  return loadEnv({ ...TEST_ENV_BASE, ...over, DATABASE_URL: process.env.DATABASE_URL })
}

export async function makeApp(over: Record<string, string> = {}): Promise<FastifyInstance> {
  const app = await buildApp({ env: testEnv(over), logger: false })
  await app.ready()
  return app
}

/** 清空所有表（順序無所謂，CASCADE） */
export async function resetDb() {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "Session", "UserRole", "User", "Role" CASCADE')
}

export async function seed() {
  await seedDemo(prisma)
}

/** 從 Set-Cookie 標頭取出 sid 的 cookie 字串（給後續請求的 cookie header 用） */
export function sidFrom(setCookie: string | string[] | undefined): string | null {
  const list = Array.isArray(setCookie) ? setCookie : setCookie ? [setCookie] : []
  for (const c of list) {
    const m = new RegExp(`^${SESSION_COOKIE}=([^;]*)`).exec(c)
    if (m && m[1]) return `${SESSION_COOKIE}=${m[1]}`
  }
  return null
}

/** mock 登入，回 cookie header 字串 */
export async function loginAs(app: FastifyInstance, mccSub: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: `/auth/login?as=${encodeURIComponent(mccSub)}` })
  if (res.statusCode !== 302) throw new Error(`mock 登入失敗：${res.statusCode} ${res.body}`)
  const sid = sidFrom(res.headers['set-cookie'])
  if (!sid) throw new Error('mock 登入沒有發 sid cookie')
  return sid
}

/** 做一個假的 JWT（只有 payload 有意義；不驗簽） */
export function fakeJwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64(payload)}.sig`
}

export { prisma }
