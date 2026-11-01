import { DEMO_ROLES, DEMO_USERS } from '@studio/demo-world'
import type { Db } from './prisma.js'

/** 把示範世界的角色與使用者放進資料庫。冪等：重跑不會多出東西。 */
export async function seedDemo(db: Db): Promise<{ roles: number; users: number }> {
  for (const r of DEMO_ROLES) {
    await db.role.upsert({ where: { code: r.code }, update: { name: r.name }, create: { code: r.code, name: r.name } })
  }
  for (const u of Object.values(DEMO_USERS)) {
    await upsertUserWithRoles(db, { mccSub: u.mccSub, name: u.name, email: u.email, roles: [...u.roles] })
  }
  return { roles: DEMO_ROLES.length, users: Object.keys(DEMO_USERS).length }
}

/** 建立或更新使用者並把角色設成指定清單（E2E 的 seed-user 與 seed 共用） */
export async function upsertUserWithRoles(
  db: Db,
  u: { mccSub: string; name: string; email?: string | null; avatarUrl?: string | null; roles: string[] },
) {
  const user = await db.user.upsert({
    where: { mccSub: u.mccSub },
    update: { name: u.name, email: u.email ?? null, avatarUrl: u.avatarUrl ?? null },
    create: { mccSub: u.mccSub, name: u.name, email: u.email ?? null, avatarUrl: u.avatarUrl ?? null },
  })
  const roles = await db.role.findMany({ where: { code: { in: u.roles } } })
  const missing = u.roles.filter((c) => !roles.some((r) => r.code === c))
  if (missing.length) throw new Error(`角色不存在：${missing.join('、')}（先 seed 角色）`)
  await db.userRole.deleteMany({ where: { userId: user.id } })
  await db.userRole.createMany({ data: roles.map((r) => ({ userId: user.id, roleId: r.id })) })
  return user
}
