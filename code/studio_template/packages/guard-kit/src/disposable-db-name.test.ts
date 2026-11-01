/**
 * scripts/lib/disposable-db.sh 的庫名：只呼叫 tmpdb_init（算名字、組連線字串，不連資料庫），看代號與保險絲。
 * 代號取根目錄 package.json 的 name；以前取 backend/package.json，每個專案都叫 backend_…，殘留庫看不出是誰的。
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const LIB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'lib', 'disposable-db.sh')
const made: string[] = []
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true })
})

function init(rootName: string, env: Record<string, string> = {}) {
  const root = mkdtempSync(join(tmpdir(), 'tmpdb-name-'))
  made.push(root)
  mkdirSync(join(root, 'backend'))
  writeFileSync(join(root, 'package.json'), JSON.stringify({ name: rootName }))
  writeFileSync(join(root, 'backend', 'package.json'), JSON.stringify({ name: 'backend' }))
  const script = `source "${LIB}"; tmpdb_init "${join(root, 'backend')}" unit; echo "$TMPDB_NAME"; echo "$DATABASE_URL"`
  const r = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, DATABASE_ADMIN_URL: 'postgresql://ci:pw@db.local:6543/postgres', PROJECT_SLUG: '', ...env },
  })
  const [name = '', url = ''] = r.stdout.trim().split('\n')
  return { code: r.status, name, url, err: r.stderr }
}

describe('拋棄式庫的名字', () => {
  it('代號是根目錄的專案名，不是 backend', () => {
    const r = init('shop-order')
    expect(r.code).toBe(0)
    expect(r.name).toMatch(/^shop_order_unit_test_\d+_\d+$/)
  })

  it('去掉 @scope/ 與非英數字元；全是中文就用 app', () => {
    expect(init('@acme/門市-Shop Order').name).toMatch(/^shop_order_unit_test_/)
    expect(init('雲端訂貨').name).toMatch(/^app_unit_test_/)
  })

  it('代號最多 24 字，整個庫名不超過 PostgreSQL 的 63 bytes', () => {
    const r = init('a-very-long-project-name-that-keeps-going-and-going')
    expect(r.name.split('_unit_test_')[0]).toHaveLength(24)
    expect(Buffer.byteLength(r.name)).toBeLessThanOrEqual(63)
  })

  it('連線字串只換庫名：帳密、主機、埠照舊，補上 schema=public', () => {
    const r = init('shop-order')
    expect(r.url).toBe(`postgresql://ci:pw@db.local:6543/${r.name}?schema=public`)
  })

  it('PROJECT_SLUG 不合規就被保險絲擋下（exit 2），不會拿去建庫', () => {
    const r = init('shop-order', { PROJECT_SLUG: 'Bad Name' })
    expect(r.code).toBe(2)
    expect(r.err).toContain('拒絕')
  })
})
