/**
 * E2E 的 seed 工具。規則（dev-guidelines 4.5）：
 *   一個測試檔一個帳號，mccSub 用「e2e-<檔名>」，不可共用（共用會互相汙染）。
 *   beforeAll 建資料要冪等：seed-user 端點本身就是 upsert，重跑不會多出東西。
 */
import type { Page } from '@playwright/test'

export const WEB = process.env.E2E_WEB_URL || 'http://127.0.0.1:4120'
export const API = process.env.E2E_API_URL || 'http://127.0.0.1:4220'

export type SeedUser = { mccSub: string; name: string; email?: string; roles?: string[] }

export async function seedUser(u: SeedUser): Promise<{ id: string; mccSub: string; loginUrl: string }> {
  const res = await fetch(`${API}/internal/test/seed-user`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(u),
  })
  if (!res.ok) throw new Error(`seed-user 失敗：${res.status} ${await res.text()}`)
  return (await res.json()) as { id: string; mccSub: string; loginUrl: string }
}

/** mock 登入：走前台 origin 的 /auth/login（vite 代理到後端），Cookie 才會落在前台 origin。 */
export async function loginAs(page: Page, mccSub: string) {
  await page.goto(`${WEB}/auth/login?as=${encodeURIComponent(mccSub)}`)
  await page.waitForURL((u) => u.origin === new URL(WEB).origin && !u.pathname.startsWith('/auth'))
}
