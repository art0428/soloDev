# 測試基準

最近幾次「全套」測試的題數。判斷「有沒有掉測試」是跟這裡最近一列比，不是跟 README 比。只有跑完全套（三端單元測試＋lint＋整套 E2E）才加一列；開發中跑相關檔、併回前跑單端的不記。

誰寫：夜間守衛全綠時自動加一列；步 4 完整測試做完由開發對話加一列。

| 日期 | main commit | 後端（題／過） | admin（題／過） | 前端（題／過） | lint | E2E（題／過） | 跑在哪個環境 | 備註 |
|---|---|---|---|---|---|---|---|---|
| 2026-11-01 | 範本 v1＋部署檔與 studio-init（尚未 init） | 102／102（push 與 migrate 兩種模式） | 無 | 35／35 | 綠 | 4／4（另 1 題真實登入 skip） | 拋棄式庫、run-e2e.sh | 第四批後的出廠基準；guard-kit 自測 17／17（含 pre-commit 擋 .env、拋棄式庫名）、契約漂移 7 路由 6 端點無漂移；也用 studio-init 在空資料夾初始化一個新專案跑過同一套，數字相同；步 1 之後的第一列從這裡往上比 |
| 2026-11-01 | 範本 v1＋守衛（尚未 init） | 82／82（push 與 migrate 兩種模式） | 無 | 35／35 | 綠 | 4／4（另 1 題真實登入 skip） | 拋棄式庫、run-e2e.sh | 加入守衛測試後的基準；另有 guard-kit 自測 6／6、契約漂移 7 路由 6 端點無漂移、相依漏洞 high 以上 0 筆；|
| 2026-11-01 | 範本 v1（尚未 init） | 66／66（push 與 migrate 兩種模式） | 無 | 25／25 | 綠 | 4／4（另 1 題真實登入 skip） | 拋棄式庫、run-e2e.sh | 程式骨架基準，還沒有守衛測試 |

## 常用指令

| 要做什麼 | 指令 |
|---|---|
| 後端單檔 | `pnpm --filter backend run test src/routes/x.test.ts`（排程或 CI 也可以用 `TEST_FILES="…"` 指定） |
| 後端整套 | `pnpm --filter backend run test 2>&1 \| tail -30` |
| 後端整套＋疊 migration 建庫 | `pnpm --filter backend run test:migrate 2>&1 \| tail -30` |
| 前端單檔 | `pnpm --filter front run test src/pages/x/x.test.tsx` |
| 前端整套 | `pnpm --filter front run test 2>&1 \| tail -20` |
| 前端 lint | `pnpm --filter front run lint 2>&1 \| tail -20` |
| 型別檢查 | `pnpm typecheck 2>&1 \| tail -20` |
| 契約格式 | `pnpm openapi:lint 2>&1 \| tail -20` |
| 契約漂移 | `node scripts/check-contract-drift.mjs` |
| 整套 E2E | `pnpm e2e 2>&1 \| tail -30`（AUTH_MODE=mock，約幾分鐘） |
| 單條 E2E | `pnpm e2e tests/e2e/x.pw.ts` |
| 覆蓋率報告 | `pnpm --filter backend run test:coverage`、`pnpm --filter front run test:coverage`（只看哪個檔是 0，不看百分比；整檔零覆蓋會紅） |
| 只跑守衛 | `pnpm --filter backend run test src/guards`、`pnpm --filter front run test src/guards` |
| guard-kit 自測 | `pnpm --filter @studio/guard-kit run test` |
| 相依漏洞 | `pnpm audit --audit-level=high 2>&1 \| tail -5`（high 以上才擋，處理方式見 dev-guidelines 4.10） |

## 常踩的坑

- 接了 `| tail` 之後離開碼是 tail 的，判斷綠紅要看摘要裡的失敗數，不看離開碼。
- 給 pnpm script 傳檔名不要加 `--`。pnpm 會把 `--` 原樣傳給 vitest 與 Playwright，後面的檔名就不算過濾條件，結果整套都跑了，看起來還是綠的。跑完看「Test Files」數字對不對。
- 前端測試檔數比上次少卻沒紅，重跑一次；曾遇過只跑到一部分的檔。
- E2E 紅先看截圖確認畫面停在哪一頁，再讀錯誤訊息；E2E 的失敗常是相互汙染，不是各自的 bug。
- 台北 00:00 到 08:00 跟白天跑出不同結果，先懷疑測試自己用了本機時鐘。
