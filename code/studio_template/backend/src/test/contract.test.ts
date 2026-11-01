/**
 * 回應符合契約：拿 api/openapi.yaml 的 response schema 驗真正打出來的 JSON。
 * 契約改了、程式沒跟上（或反過來）這裡會紅。新端點照 CASES 加一列。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import OpenAPIResponseValidator from 'openapi-response-validator'
import { parse } from 'yaml'
import { DEMO_USERS } from '@studio/demo-world'
import { loginAs, makeApp, resetDb, seed } from './helpers.js'

const specPath = fileURLToPath(new URL('../../../api/openapi.yaml', import.meta.url))
const spec = parse(readFileSync(specPath, 'utf8')) as {
  paths: Record<string, Record<string, { responses: Record<string, { $ref?: string } & Record<string, unknown>> }>>
  components: { schemas: Record<string, unknown>; responses: Record<string, unknown> }
}

/** openapi-response-validator 不解 #/components/responses 的 $ref，這裡先展開 */
function derefResponses(responses: Record<string, { $ref?: string } & Record<string, unknown>>) {
  const out: Record<string, unknown> = {}
  for (const [code, r] of Object.entries(responses)) {
    if (r.$ref) {
      const name = r.$ref.replace('#/components/responses/', '')
      const target = spec.components.responses[name]
      if (!target) throw new Error(`契約找不到 ${r.$ref}`)
      out[code] = target
    } else out[code] = r
  }
  return out
}

function validatorFor(path: string, method: string) {
  const op = spec.paths[path]?.[method]
  if (!op) throw new Error(`契約沒有 ${method.toUpperCase()} ${path}`)
  return new OpenAPIResponseValidator({
    responses: derefResponses(op.responses) as never,
    components: { schemas: spec.components.schemas } as never,
  })
}

type Case = { path: string; method: 'get' | 'post'; status: number; auth?: 'admin' | 'member' }
const CASES: Case[] = [
  { path: '/health', method: 'get', status: 200 },
  { path: '/api/me', method: 'get', status: 401 },
  { path: '/api/me', method: 'get', status: 200, auth: 'admin' },
  { path: '/api/admin/ping', method: 'get', status: 403, auth: 'member' },
  { path: '/api/admin/ping', method: 'get', status: 200, auth: 'admin' },
  { path: '/auth/login', method: 'get', status: 404 },
]

describe('回應符合 api/openapi.yaml', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await makeApp() })
  afterAll(async () => { await app.close() })
  beforeEach(async () => { await resetDb(); await seed() })

  for (const c of CASES) {
    it(`${c.method.toUpperCase()} ${c.path} → ${c.status}${c.auth ? `（${c.auth}）` : ''}`, async () => {
      const cookie = c.auth ? await loginAs(app, DEMO_USERS[c.auth].mccSub) : undefined
      const url = c.path === '/auth/login' ? '/auth/login?as=nobody' : c.path
      const res = await app.inject({ method: c.method.toUpperCase() as 'GET' | 'POST', url, headers: cookie ? { cookie } : {} })
      expect(res.statusCode).toBe(c.status)
      const v = validatorFor(c.path, c.method)
      const problems = v.validateResponse(String(c.status), res.json())
      expect(problems, JSON.stringify(problems)).toBeUndefined()
    })
  }

  it('契約裡的每個 /api 路徑程式都有掛（沒掛會回 404 NOT_FOUND）', async () => {
    const cookie = await loginAs(app, DEMO_USERS.admin.mccSub)
    for (const [path, ops] of Object.entries(spec.paths)) {
      if (!path.startsWith('/api/')) continue
      for (const method of Object.keys(ops)) {
        const res = await app.inject({ method: method.toUpperCase() as 'GET', url: path, headers: { cookie } })
        expect(res.statusCode, `${method} ${path}`).not.toBe(404)
      }
    }
  })
})
