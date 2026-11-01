/**
 * 真實 MCC 登入（上線前跑一次，手冊第 11 章）。預設 skip：要人在瀏覽器裡輸入帳密。
 *   E2E_REAL_LOGIN=1 E2E_WEB_URL=https://<測試環境前台> pnpm --filter e2e run test login-real --headed（不要加 `--`，加了會整套跑）
 * 只驗：按登入會到 MCC、完成後回到站內並看到名字。不自動輸入任何帳密。
 */
import { expect, test } from '@playwright/test'

test.skip(!process.env.E2E_REAL_LOGIN, '要真實 MCC 登入時設 E2E_REAL_LOGIN=1 並用 --headed')

test('按登入導向 MCC，完成後回到站內', async ({ page }) => {
  test.setTimeout(5 * 60_000)
  await page.goto('/login')
  await page.getByRole('link', { name: '登入' }).click()
  await page.waitForURL(/members\.managers\.center/)
  // 這裡由人完成登入；完成後 MCC 會導回 /auth/callback 再回到前台
  await page.waitForURL((u) => !/members\.managers\.center/.test(u.href), { timeout: 4 * 60_000 })
  await expect(page.getByTestId('me-name')).not.toBeEmpty()
})
