/**
 * pre-commit 的 .env 檢查：在暫存資料夾開一個 git repo、暫存不同組合的檔，直接跑 scripts/git-hooks/pre-commit 看擋不擋。
 * 只暫存 .env 類的檔，不會觸發契約漂移、lint 那些要裝相依的檢查。
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

const HOOK = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'scripts', 'git-hooks', 'pre-commit')
const made: string[] = []
afterAll(() => {
  for (const d of made) rmSync(d, { recursive: true, force: true })
})

function stageAndRun(files: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-commit-'))
  made.push(dir)
  execFileSync('git', ['init', '-q'], { cwd: dir })
  for (const f of files) {
    mkdirSync(dirname(join(dir, f)), { recursive: true })
    writeFileSync(join(dir, f), 'X=1\n')
  }
  execFileSync('git', ['add', '-f', ...files], { cwd: dir })
  const r = spawnSync('bash', [HOOK], { cwd: dir, encoding: 'utf8' })
  return { code: r.status, out: `${r.stdout}${r.stderr}` }
}

describe('pre-commit 擋 .env 進版控', () => {
  it.each(['.env', 'backend/.env', 'front/.env.local', 'backend/.env.production'])('%s：擋', (f) => {
    const r = stageAndRun([f])
    expect(r.code).toBe(1)
    expect(r.out).toContain(f)
  })

  it('.env 跟 .env.example 同一次提交：照樣擋（以前只要有 .example 就整個放行）', () => {
    const r = stageAndRun(['backend/.env', 'front/.env.example'])
    expect(r.code).toBe(1)
    expect(r.out).toContain('backend/.env')
    expect(r.out).not.toContain('front/.env.example')
  })

  it('只有 .env.example、.env.prod.example 這類範本：放行', () => {
    const r = stageAndRun(['backend/.env.example', 'deploy/env/.env.prod.example'])
    expect(r.out).toContain('通過')
    expect(r.code).toBe(0)
  })
})
