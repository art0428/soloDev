/**
 * 只在 AUTH_MODE=mock 掛載的測試輔助端點（E2E 的 seed-user 用）。不在契約裡；契約漂移檢查放行 /internal/*。
 * 正式環境不可能有：env.ts 不准 mock 模式在 production 啟動。
 */
import type { FastifyInstance } from 'fastify'
import { validationFailed } from '../lib/errors.js'
import { prisma } from '../lib/prisma.js'
import { upsertUserWithRoles } from '../lib/seed-demo.js'

type Body = { mccSub?: string; name?: string; email?: string; roles?: string[] }

export async function internalTestRoutes(app: FastifyInstance) {
  app.post<{ Body: Body }>('/internal/test/seed-user', async (req, reply) => {
    const b = req.body ?? {}
    const details: { field: string; message: string }[] = []
    if (!b.mccSub || !/^[a-z0-9][a-z0-9._-]{2,63}$/i.test(b.mccSub)) details.push({ field: 'mccSub', message: '必填，3 到 64 個英數字、點、底線或連字號。' })
    if (!b.name) details.push({ field: 'name', message: '必填。' })
    if (details.length) throw validationFailed(details)
    // 測試專用：要的角色不存在就順手建（正式的角色清單由 seed 與 migration 管）
    for (const code of b.roles ?? ['member']) {
      await prisma.role.upsert({ where: { code }, update: {}, create: { code, name: code } })
    }
    const user = await upsertUserWithRoles(prisma, {
      mccSub: b.mccSub!,
      name: b.name!,
      email: b.email ?? null,
      roles: b.roles && b.roles.length ? b.roles : ['member'],
    })
    return reply.code(201).send({
      id: user.id,
      mccSub: user.mccSub,
      loginUrl: `${app.env.API_URL}/auth/login?as=${encodeURIComponent(user.mccSub)}`,
    })
  })
}
