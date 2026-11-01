---
name: mcc-integration
description: MCC（members.managers.center）登入串接的做法，本專案用 BFF＋httpOnly Cookie。動到登入、登出、Session、Cookie、角色、權限、/api/me、/auth/*、member/check、MCC 環境變數或 CORS 之前先讀。
---

# MCC 登入串接（BFF＋httpOnly Cookie 版）

MCC 是管理者工作室的會員平台，所有產品都接。本專案用 **BFF**（Backend For Frontend，後端替前端處理登入）模式：瀏覽器只被導去 MCC 再導回來，Token 由後端換、存在後端，瀏覽器只拿到一個 httpOnly Cookie。前端程式完全碰不到 Token。

這是前一個專案資安稽核第一名弱點換來的選擇：舊做法把 Token 帶在網址上導回前端，導回網址一被竄改，Token 就送到別人手上。

權威來源（規格有疑問以官方為準）：
- 整合指南：https://members.managers.center/docs/integration-guide
- Swagger：https://members.managers.center/api-docs
- 錯誤碼總表：https://members.managers.center/docs/error-reference

## 1. 核心模型

- **Group**（組織，資料完全隔離）→ **Service**（應用，各有一組憑證）→ **Member**（會員）。
- MCC 代理 Google、LINE、Facebook、Apple、Microsoft、GitHub 六種登入，我們只對接 MCC。
- **會員唯一 ID 是 id_token 的 `sub`**（MCC 叫 member_suuid）。資料表 `User.mccSub` 存它，是帳號主鍵。同一個人用不同 email 的帳號登入，在 MCC 就是不同會員。
- 憑證只有兩套：開發與測試共用「測試 Group」，正式機用「正式 Group」。MCC 網址都一樣，切換只換環境變數的值。

## 2. 整條流程

```
瀏覽器                         後端（本專案）                                MCC
  │ 按「登入」                     │                                          │
  ├──GET /auth/login──────────────▶│ 產生 state、nonce，放進簽章 Cookie        │
  │                                │ oidc_state（path=/auth，10 分鐘）          │
  │◀──302 到 MCC authorize─────────┤                                          │
  ├──────────────────────────────────────────────────────────────────────────▶│ 使用者選帳號登入
  │◀──302 回 /auth/callback?code&state────────────────────────────────────────┤
  ├──GET /auth/callback───────────▶│ 比對 state → 用 code＋client_secret 換 token│
  │                                │ ─────────────────────────────────────────▶│
  │                                │ 解 id_token 取 sub、名稱、email、頭像，比對 nonce
  │                                │ 用 sub 找使用者，找不到就建（第一位是管理員，D1）
  │                                │ 建 Session：資料庫存 token 的 sha256，
  │                                │ MCC 的 access／refresh token 存在 Session 列上
  │◀──Set-Cookie: sid（httpOnly）＋ 302 到 FRONT_URL/
  │
  │ 之後每個請求自動帶 sid
  ├──GET /api/...─────────────────▶│ onRequest：查 Session（過期就刪）
  │                                │ 每 60 秒向 MCC 複驗一次（POST /member/check），
  │                                │ access_token 過期先用 refresh_token 續期
  │
  ├──POST /auth/logout────────────▶│ 通知 MCC（/member/logout，失敗不擋）→ 刪 Session → 清 Cookie → 204
```

## 3. 檔案地圖

| 檔案 | 做什麼 |
|---|---|
| `backend/src/auth/oidc.ts` | discovery、組授權網址、換 token、refresh、解 id_token、判斷 access_token 過期 |
| `backend/src/auth/routes.ts` | `/auth/login`、`/auth/callback`、`/auth/logout`；mock 模式的假登入也在這 |
| `backend/src/auth/session.ts` | 產生 token、存 sha256、查與刪 Session、Cookie 選項 |
| `backend/src/auth/guard.ts` | 每個請求解出 `request.user`、定期 member/check；`requireLogin`、`requireRole` |
| `backend/src/auth/mcc-member.ts` | `/member/check`、`/member/logout` |
| `backend/src/lib/env.ts` | MCC 變數的驗證；正式環境擋 mock、擋沒設或不是 https 的網址 |
| `front/src/lib/api.ts`、`front/src/lib/auth.tsx` | 前台唯一的 API 呼叫器（帶 Cookie）、登入狀態（打 `/api/me`） |
| `backend/src/auth/oidc.test.ts` | 用 MSW 假扮 MCC，驗整條流程與失敗路徑 |

## 4. 鐵則

1. **帳號主鍵一律 `sub`**。`findUnique({ where: { mccSub } })`，找不到才建。email、名稱、頭像每次登入更新，不拿來找人。
2. **密鑰只在後端**。`MCC_CLIENT_SECRET`、`MCC_GROUP_JWT` 只進 `backend/.env` 或 Secret Manager，不進前端、不進 git、不進 log、不貼進對話。
3. **Token 不進瀏覽器、不進網址**。瀏覽器只有 `sid` 這個隨機字串；MCC 的 Token 存在 Session 列上。
4. **不接受任意的導回網址**。登入完一律導回 `FRONT_URL/`。真的要回到原本那一頁，只接受站內相對路徑（`/` 開頭、不是 `//` 開頭），寫進 state Cookie，回來時再驗一次。這條要先問使用者。
5. **member/check 要分清楚「會員無效」與「我方設定出錯」**。會員層的錯（ACCESS_TOKEN、SUUID、MEMBER）才清 Session；群組層的錯（GROUP、SERVICE、JWT）或網路錯誤一律降級放行、記 log，不然 MCC 短暫故障或 Group JWT 到期會把所有人鎖在門外。
6. **refresh 只有回 invalid 才結束 Session**。400、401、`invalid_grant` 是 invalid；5xx 或逾時是 error，照舊放行。
7. **mock 模式只准本機與測試**。`AUTH_MODE=mock` 在 `NODE_ENV=production` 會拒絕啟動；`/internal/*` 測試端點只在 mock 模式掛上。
8. **redirect_uri 一字不差**。協定、網域、路徑都要和 MCC 白名單一樣，本機、正式各登記在自己的 Group。
9. **使用者主動按登入就帶 `prompt=select_account`**，讓他能換帳號。2026-09 時 MCC 還會忽略這個參數；帶著不會壞，MCC 支援後就自動生效。

## 5. 環境變數

| 變數 | 說明 | 放哪 |
|---|---|---|
| `AUTH_MODE` | `mcc` 真實登入；`mock` 假登入，只准本機與測試 | env |
| `MCC_ISSUER` | 一律 `https://members.managers.center` | env |
| `MCC_CLIENT_ID` | Service 的 suuid（UUID）。不能用人看得懂的名字，會撞 `ambiguous_client_id` | env |
| `MCC_CLIENT_SECRET` | 在 MCC 管理介面「重設 OAuth client_secret」取得，明文只顯示一次 | Secret |
| `MCC_GROUP_JWT` | 呼叫 `/member/check` 用的 Group Bearer。有到期日，寫進部署說明現況表「站著的待辦」 | Secret |
| `MCC_SERVICE_CODE` | 跟 Group JWT 成對，放在 `X-Service-Code` header | env |
| `MCC_REDIRECT_URI` | 留空＝`API_URL` + `/auth/callback` | env |
| `API_URL`、`FRONT_URL` | 後端與前台的對外網址；正式環境必填且要 https | env |
| `COOKIE_SAME_SITE` | 見第 6 節 | env |
| `SESSION_SECRET`、`SESSION_TTL_HOURS` | Cookie 簽章用的密鑰（至少 32 字元）、Session 幾小時過期 | Secret、env |

`MCC_GROUP_JWT` 沒設時，member/check 整組停用：被 MCC 撤銷的會員可以一直用到 Session 過期。本機可以不設，正式機一定要設。

## 6. Cookie 與跨網域

- `sid` 一律 `httpOnly`；正式環境一律 `Secure`（只走 HTTPS）。本機是 http，所以本機 `Secure` 關著，Cookie 才送得出去。
- **SameSite 看的是「網站」不是「網址」**。`app.example.com` 與 `api.example.com` 是同一個網站，用 `lax` 就好。兩邊是完全不同的網域（例 `xxx.web.app` 與 `xxx.run.app`）才要 `none`。
- `none` 等於第三方 Cookie，Safari 等瀏覽器會擋。**正式機請把前台和 API 放在同一個網域底下**，最好是同一個網址、由負載平衡器把 `/api`、`/auth` 導到後端，這時 `VITE_API_URL` 留空。
- CORS 只允許 `FRONT_URL`，並開 `credentials`。前台呼叫一律走 `packages/api-client`，它已經帶 `credentials: 'include'`。

## 7. mock 模式與測試

- 本機：`AUTH_MODE=mock`，登入是 `/auth/login?as=mock-admin`（或 `mock-member`），帳號來自示範世界的種子資料。
- 單元測試：`oidc.test.ts` 用 MSW 假扮 MCC。**假服務要像真的，不能比真的寬鬆**：MCC 會拒絕的輸入假服務也要拒絕、欄位格式照抄。
- E2E：預設 mock 模式。上線前要在測試環境跑一次 `tests/e2e/login-real.pw.ts` 走真實 MCC 登入，人在瀏覽器輸入帳密，AI 不代填。
- 必測的失敗路徑：state 不符、state Cookie 過期或沒簽章、code 換不到 token、id_token 沒有 sub、nonce 不符、refresh invalid 與 error、member/check revoked 與群組層錯誤、未登入 401、角色不符 403。

## 8. 整合除錯

- 授權網址暫時加 `response_mode=diag`，登入失敗時 MCC 會直接顯示完整的診斷頁。**上線前一定要拿掉**，正式環境 Token 不得出現在網址。
- 後端 log 不印 Token、不印 Cookie 值。要看流程就看 `reqId` 串起來的請求紀錄。

## 9. 常見錯誤

| 症狀 | 原因與處理 |
|---|---|
| `ambiguous_client_id` | `MCC_CLIENT_ID` 填了名字，要改成 Service 的 suuid |
| `client_secret not set` | 從沒重設過 secret，到 MCC 管理介面按「重設 OAuth client_secret」 |
| `redirect_uri not allowed` | 白名單不是一字不差，補上完整網址 |
| `code is invalid, used, or expired` | 授權碼只能用一次、5 分鐘過期，重新登入 |
| 回來時「登入狀態已失效」 | state Cookie 沒帶回來：本機用 `localhost` 登入卻用 `127.0.0.1` 回來（兩者 Cookie 不共用），或正式機前後端不同網站又沒用 `none` |
| 登入成功但 `/api/me` 一直 401 | `sid` 沒送到後端：跨網域、`Secure` 遇上 http、或前台自己寫 fetch 沒帶 credentials |
| 第一次登入 500「角色資料表沒有 admin／member」 | 新資料庫沒跑種子，`pnpm --filter backend run prisma:seed` |
| `group_contract_expired` | Group JWT 到期，到 MCC 重新產生，換 Secret Manager 新版本 |
| `refresh_token_reuse_detected` | refresh token 被重用，整條已撤銷，當資安事件處理 |
| `idp_not_configured` | 那個登入方式沒在 MCC 啟用 |

## 10. 要先問使用者的事

改 Session 期限、改 member/check 間隔、加導回原頁的參數、加新的登入方式、讓 mock 模式在別的環境開放、任何讓 Token 離開後端的改動。這些都是安全取捨，照 CLAUDE.md 第 8 節的格式問。
