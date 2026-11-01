// `pnpm --filter backend run prisma:seed`：把示範世界的角色與兩位使用者放進資料庫。
// 只放 @studio/demo-world 的資料；正式機不跑這支。邏輯在 src/lib/seed-demo.ts，測試與 verify-env 共用。
import { prisma } from '../src/lib/prisma.js'
import { seedDemo } from '../src/lib/seed-demo.js'

const r = await seedDemo(prisma)
console.log(`示範資料就緒：角色 ${r.roles}、使用者 ${r.users}`)
await prisma.$disconnect()
