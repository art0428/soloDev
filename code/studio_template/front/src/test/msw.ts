import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { Me } from '@studio/api-client'

/** jsdom 的 origin 是 http://localhost:3000，api 的 baseUrl 是空字串，所以 handler 用相對路徑的絕對寫法 */
export const ORIGIN = 'http://localhost:3000' // guard: allow（jsdom 的固定 origin，不是服務埠）

export const adminMe: Me = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '許經理',
  email: 'hsu.manager@demo.local',
  avatarUrl: null,
  roles: ['admin', 'member'],
  createdAtInstant: '2026-11-01T00:00:00.000Z',
  lastLoginAtInstant: '2026-11-01T08:30:00.000Z',
}

export const memberMe: Me = { ...adminMe, id: '22222222-2222-4222-8222-222222222222', name: '蔡業務', email: 'tsai.sales@demo.local', roles: ['member'] }

export const unauthorized = () => HttpResponse.json({ error: { code: 'UNAUTHORIZED', message: '請先登入。' } }, { status: 401 })
export const forbidden = () => HttpResponse.json({ error: { code: 'FORBIDDEN', message: '你沒有這個功能的使用權限。' } }, { status: 403 })

export const handlers = {
  health: (authMode: 'mcc' | 'mock' = 'mock') =>
    http.get(`${ORIGIN}/health`, () => HttpResponse.json({ ok: true, authMode, businessTz: 'Asia/Taipei', version: null })),
  meAs: (me: Me | null) => http.get(`${ORIGIN}/api/me`, () => (me ? HttpResponse.json(me) : unauthorized())),
  logout: () => http.post(`${ORIGIN}/auth/logout`, () => new HttpResponse(null, { status: 204 })),
  adminPing: (ok: boolean) => http.get(`${ORIGIN}/api/admin/ping`, () => (ok ? HttpResponse.json({ ok: true }) : forbidden())),
}

export const server = setupServer()
