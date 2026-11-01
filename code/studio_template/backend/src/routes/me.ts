import type { FastifyInstance } from 'fastify'
import { requireLogin, requireRole, type AuthUser } from '../auth/guard.js'

/** Me 的 DTO：時刻欄位一律 xxxAtInstant、ISO 8601（dates 規則） */
export const meDto = (u: AuthUser) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  avatarUrl: u.avatarUrl,
  roles: u.roles,
  createdAtInstant: u.createdAt.toISOString(),
  lastLoginAtInstant: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
})

export async function meRoutes(app: FastifyInstance) {
  app.get('/api/me', { preHandler: requireLogin }, async (req) => meDto(req.user!))

  // 權限示範端點：步 2 寫業務 API 時照這個樣子掛 requireRole
  app.get('/api/admin/ping', { preHandler: requireRole('admin') }, async () => ({ ok: true }))
}
