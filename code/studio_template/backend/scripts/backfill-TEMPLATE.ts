/**
 * 回填腳本範本。複製成 backfill-<主題>.ts 再改 TODO 的地方。
 *
 * 慣例（dev-guidelines 第 3 節）：
 *   不帶參數＝試跑，只報數字不寫；--write 才寫。
 *   冪等：只填空的（NULL），重跑不覆寫已有值。
 *   無來源的留 NULL，不硬塞預設值。
 *   時區相關的要 --stamp-tz=<IANA> 明確宣告，不可依賴環境 TZ。
 *   正式機在部署後手動跑：先試跑貼數字給使用者，允許後 --write；結果寫進部署說明現況表「backfill 已跑」。
 *
 *   pnpm --filter backend run script scripts/backfill-<主題>.ts            試跑
 *   pnpm --filter backend run script scripts/backfill-<主題>.ts --write    真的寫
 * （用 run script 不用 exec：CLAUDE.md 第 4 節，exec 不切換目錄）
 */
import 'dotenv/config'
import { prisma } from '../src/lib/prisma.js'

const args = new Set(process.argv.slice(2))
const WRITE = args.has('--write')
const stampTz = [...args].find((a) => a.startsWith('--stamp-tz='))?.split('=')[1]

async function main() {
  // TODO：找出要補的列。只挑「還是 NULL」的，冪等才成立。
  // 例：const rows = await prisma.user.findMany({ where: { email: null }, select: { id: true, mccSub: true } })
  const rows: { id: string }[] = []

  let filled = 0
  let skippedNoSource = 0
  for (const row of rows) {
    // TODO：算出新值；算不出來（沒有來源）就 skippedNoSource++ 並 continue，留 NULL。
    const next: string | null = null
    if (next === null) { skippedNoSource++; continue }
    if (WRITE) {
      // TODO：await prisma.user.update({ where: { id: row.id }, data: { email: next } })
      void row
    }
    filled++
  }

  console.log(JSON.stringify({
    mode: WRITE ? 'write' : 'dry-run',
    stampTz: stampTz ?? null,
    candidates: rows.length,
    filled,
    skippedNoSource,
  }, null, 2))
  if (!WRITE) console.log('試跑完成，沒有寫入。確認數字後加 --write 再跑一次。')
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1 })
  .finally(() => prisma.$disconnect())
