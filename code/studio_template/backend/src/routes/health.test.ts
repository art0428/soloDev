import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { FastifyInstance } from 'fastify'
import { makeApp } from '../test/helpers.js'

describe('GET /health', () => {
  let app: FastifyInstance
  beforeAll(async () => { app = await makeApp() })
  afterAll(async () => { await app.close() })

  it('不需登入，回 ok 與 authMode', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ ok: true, authMode: 'mock', businessTz: 'Asia/Taipei', version: null })
  })

  it('沒有的路徑回契約格式的 404', async () => {
    const res = await app.inject({ method: 'GET', url: '/nope' })
    expect(res.statusCode).toBe(404)
    expect(res.json()).toEqual({ error: { code: 'NOT_FOUND', message: '找不到這個路徑。' } })
  })
})
