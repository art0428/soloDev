/**
 * 啟動時檢查資料庫有沒有跟上 repo 裡的 migration。只提醒，不擋啟動。
 *
 * 為什麼要有：新增 migration 之後，開發伺服器熱重載成新程式、Prisma 開始查新欄位，資料庫卻還沒套，
 * 畫面就 500；測試走拋棄式庫所以照樣全綠，沒有任何地方會主動講。正式機漏套 migration 也是同一個樣子。
 *
 * 分三層：讀 repo（listMigrationsOnDisk）、讀資料庫（listAppliedMigrations）、比對與組訊息（純函式，好測）。
 * 資料庫沒有 _prisma_migrations 表（db push 建的）就無從比對，不出聲。
 */
import { existsSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { Db } from './prisma.js'

const DEFAULT_DIR = fileURLToPath(new URL('../../prisma/migrations', import.meta.url))

/** repo 裡每支 migration 的資料夾名。名稱開頭是時間戳記，照名稱排就是時間順序。 */
export function listMigrationsOnDisk(dir = DEFAULT_DIR): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => (entry.isDirectory() ? [entry.name] : []))
    .sort()
}

/** 資料庫已經成功套用、沒被退回的 migration；沒有紀錄表就回 null。 */
export async function listAppliedMigrations(db: Db): Promise<string[] | null> {
  const [probe] = await db.$queryRaw<{ present: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = current_schema() AND table_name = '_prisma_migrations'
    ) AS present`
  if (probe?.present !== true) return null
  const applied = await db.$queryRaw<{ name: string }[]>`
    SELECT migration_name AS name FROM _prisma_migrations
    WHERE rolled_back_at IS NULL AND finished_at IS NOT NULL`
  return applied.map(({ name }) => name).sort()
}

export type MigrationDiff = {
  /** repo 有、資料庫還沒套：要跑 prisma migrate deploy */
  pending: string[]
  /** 資料庫套過、repo 卻沒有：跑著的程式比資料庫舊（切錯分支，或 migration 檔沒進 repo） */
  unknown: string[]
}

export function diffMigrations(onDisk: readonly string[], applied: readonly string[]): MigrationDiff {
  const minus = (from: readonly string[], drop: readonly string[]) => {
    const dropped = new Set(drop)
    return from.filter((name) => !dropped.has(name)).sort()
  }
  return { pending: minus(onDisk, applied), unknown: minus(applied, onDisk) }
}

type NothingToList = { pending: []; unknown: [] }
export type MigrationCheck =
  | ({ status: 'ok' | 'pending' } & MigrationDiff)
  | ({ status: 'no_table' } & NothingToList)
  | ({ status: 'error'; error: string } & NothingToList)

/** 任何一步出錯都收成 status: 'error'：這是提醒，不能反過來把服務弄倒。 */
export function checkPendingMigrations(deps: {
  applied: () => Promise<string[] | null>
  onDisk?: () => string[]
}): Promise<MigrationCheck> {
  const readDisk = deps.onDisk ?? (() => listMigrationsOnDisk())
  return Promise.resolve()
    .then(deps.applied)
    .then((applied): MigrationCheck => {
      if (applied === null) return { status: 'no_table', pending: [], unknown: [] }
      const diff = diffMigrations(readDisk(), applied)
      const behind = diff.pending.length > 0 || diff.unknown.length > 0
      return { status: behind ? 'pending' : 'ok', ...diff }
    })
    .catch((err: unknown): MigrationCheck => ({
      status: 'error',
      error: err instanceof Error ? err.message : String(err),
      pending: [],
      unknown: [],
    }))
}

/** 給人看的訊息。只有 pending 有內容，其他狀態回空字串，呼叫端就不印。 */
export function formatMigrationCheck(result: MigrationCheck): string {
  if (result.status !== 'pending') return ''
  const bullets = (names: string[]) => names.map((name) => `    · ${name}`)
  const out: string[] = []
  if (result.pending.length > 0) {
    out.push(
      `※ migration 落後 ${result.pending.length} 支：程式會用到這些變更，資料庫還沒有，相關的讀寫會失敗。`,
      ...bullets(result.pending),
      '  本機（只新增的 migration 才可以直接套）：pnpm --filter backend run prisma:migrate',
      '  正式機：照 deploy/部署說明.md 第三章，只新增的先套 migration 再部署程式，破壞性的順序相反。',
    )
  }
  if (result.unknown.length > 0) {
    out.push(
      `※ 資料庫多了 ${result.unknown.length} 支 repo 裡沒有的 migration：現在跑的程式比資料庫舊，可能切錯分支，或 migration 檔沒有進 repo。`,
      ...bullets(result.unknown),
    )
  }
  return out.join('\n')
}
