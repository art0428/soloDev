import { PrismaClient } from '@prisma/client'

/** 全程式唯一的 Prisma client。連線字串由 DATABASE_URL 來（測試時是 run-tests.sh 給的拋棄式庫）。 */
export const prisma = new PrismaClient()

export type Db = PrismaClient
