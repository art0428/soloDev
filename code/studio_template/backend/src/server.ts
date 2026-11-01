/** 真正 listen 的入口：pnpm --filter backend run dev（tsx watch，會讀 .env）。 */
import 'dotenv/config'
import { buildApp } from './app.js'
import { loadEnv } from './lib/env.js'
import { checkPendingMigrations, formatMigrationCheck, listAppliedMigrations } from './lib/migration-check.js'
import { prisma } from './lib/prisma.js'

const env = loadEnv()
const app = await buildApp({ env })

// 啟動時提醒 migration 落後（只提醒不阻擋；見 lib/migration-check.ts）
const check = await checkPendingMigrations({ applied: () => listAppliedMigrations(prisma) })
const msg = formatMigrationCheck(check)
if (msg) console.error(`\n${msg}\n`)

await app.listen({ host: env.HOST, port: env.PORT })
app.log.info(`AUTH_MODE=${env.AUTH_MODE}  FRONT_URL=${env.FRONT_URL}  BUSINESS_TZ=${env.BUSINESS_TZ}`)

const shutdown = async () => {
  await app.close()
  await prisma.$disconnect()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
