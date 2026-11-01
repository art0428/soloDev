/**
 * 登入骨架的 E2E（手冊步 1 的「完成」）：真實登入 → 看到名字與該角色的選單 → 每個選單點得進 → 登出。
 * 這一檔的帳號：e2e-login-admin、e2e-login-member（一檔一組帳號）。
 */
import { expect, test } from '@playwright/test'
import { loginAs, seedUser } from './seed-user'

const ADMIN = { mccSub: 'e2e-login-admin', name: 'E2E 登入管理員', roles: ['admin', 'member'] }
const MEMBER = { mccSub: 'e2e-login-member', name: 'E2E 登入成員', roles: ['member'] }

test.beforeAll(async () => {
  await seedUser(ADMIN)
  await seedUser(MEMBER)
})

test('沒登入進首頁被導去登入頁', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByTestId('mock-login')).toBeVisible()
})

test('管理員：登入看到名字與系統管理，每個選單點得進，登出回登入頁', async ({ page }) => {
  await loginAs(page, ADMIN.mccSub)
  await expect(page.getByTestId('me-name')).toHaveText(ADMIN.name)
  const nav = page.getByRole('navigation', { name: '主選單' })
  await expect(nav.getByRole('link', { name: '系統管理' })).toBeVisible()

  const links = await nav.getByRole('link').all()
  for (const link of links) {
    const label = (await link.textContent())?.trim() ?? ''
    await link.click()
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(label)
  }
  await expect(page.getByText('管理員權限確認成功。')).toBeVisible()

  await page.getByRole('button', { name: '登出' }).click()
  await expect(page).toHaveURL(/\/login$/)
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
})

test('一般成員：沒有系統管理，直接打 /admin 看到沒有權限', async ({ page }) => {
  await loginAs(page, MEMBER.mccSub)
  await expect(page.getByTestId('me-name')).toHaveText(MEMBER.name)
  const nav = page.getByRole('navigation', { name: '主選單' })
  await expect(nav.getByRole('link', { name: '系統管理' })).toHaveCount(0)
  await page.goto('/admin')
  await expect(page.getByRole('alert')).toContainText('你沒有這個功能的使用權限。')
})

test('後端擋住一般成員打管理員 API（不是只有前台藏按鈕）', async ({ page, request }) => {
  await loginAs(page, MEMBER.mccSub)
  const res = await page.request.get('/api/admin/ping')
  expect(res.status()).toBe(403)
  const anon = await request.get('/api/me')
  expect(anon.status()).toBe(401)
})
