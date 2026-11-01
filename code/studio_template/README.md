# <專案名>

<一句話說明：這是什麼系統、給誰用>

流程照 `docs/管理者工作室AI單人開發手冊.md`；AI 的規則在 `CLAUDE.md`；做法與踩坑在 `.claude/skills/dev-guidelines/SKILL.md`。這份只講程式架構與怎麼啟動。

## 架構

| 層 | 技術 | 目錄 |
|---|---|---|
| 前台 | React 18 + Vite + TypeScript + React Router | `front/` |
| 後端 | Node 22 + Fastify 5 + TypeScript + Prisma 6 | `backend/` |
| 資料庫 | PostgreSQL | 本機自己的、正式 Cloud SQL |
| 契約 | OpenAPI 3（`api/openapi.yaml`）→ 自動產生 `packages/api-client` | 前台只能呼叫契約裡有的 API |
| 示範世界 | `packages/demo-world`（虛構公司、人、客戶、產品） | seed、測試、E2E、說明都只用這份 |
| 登入 | MCC OIDC，BFF 模式：瀏覽器只導向，Token 由後端換、存 httpOnly Cookie | `backend/src/auth/` |
| 後台（選配） | Fastify + EJS，前台上線後才做 | `admin/` |

請求路徑：瀏覽器 → 前台（開發時 vite 把 `/api`、`/auth`、`/health` 代理到後端）→ 後端 → PostgreSQL。前後端同一個 origin，Cookie 不必跨網域。

## 第一次啟動

1. 把原型存成 `docs/prototype/index_v1.html`（手冊第 4 章）。
2. `bash scripts/init.sh <專案代號> --title "顯示名稱"`：填專案名、從範本建 `backend/.env` 與 `front/.env`（`SESSION_SECRET` 自動產生、`DATABASE_URL` 填本機預設）、`pnpm install`、啟用 pre-commit。可以重複跑，做過的步驟會略過。需要 Node 22、pnpm 10。沒有 pnpm 時 init.sh 自己改用 `corepack pnpm` 安裝，最後會提示你先執行 `corepack enable`，之後的指令才能直接打 `pnpm`。
3. 照 init.sh 最後印出的三行建開發庫：`createdb <代號>_dev`（代號裡的連字號換成底線）、`pnpm --filter backend run prisma:migrate`、`pnpm --filter backend run prisma:seed`。
4. `pnpm dev`：前台 http://127.0.0.1:4100、後端 http://127.0.0.1:4200。
5. 打開前台按「以許經理（管理員）登入」（`AUTH_MODE=mock` 是本機假登入）。要真的連 MCC：把測試 Group 的 `MCC_*` 自己填進 `backend/.env`、`AUTH_MODE` 改成 `mcc`，再跑一次 init.sh 檢查有沒有漏填。

## 常用指令

| 要做什麼 | 指令 |
|---|---|
| 開發伺服器 | `pnpm dev` |
| 型別檢查（全部） | `pnpm typecheck` |
| 契約格式 | `pnpm openapi:lint` |
| 重新產生 api-client（改契約後） | `pnpm openapi:gen` |
| 後端測試（拋棄式庫） | `pnpm --filter backend run test`；單檔 `pnpm --filter backend run test src/routes/x.test.ts`；改 schema 後 `test:migrate` |
| 前台測試、lint | `pnpm --filter front run test`、`pnpm --filter front run lint` |
| 整套 E2E（拋棄式環境） | `pnpm e2e`（第一次先 `pnpm --filter e2e run install-browsers`） |
| 瀏覽器驗收環境 | `bash scripts/verify-env.sh start`，用完 `stop` |
| 隔離副本（夜間守衛、改 schema） | `bash scripts/iso-copy.sh make <絕對路徑>` |
| 部署後煙霧測試 | `bash backend/scripts/smoke-test.sh <API 網址> <前台網址> <這次的版本，例 prod/v3>` |

完整的測試指令與基準數字在 `docs/test-baseline.md`。

## 埠

| 用途 | 前台 | 後端 |
|---|---|---|
| 開發 | 4100 | 4200 |
| 驗收環境 verify-env | 4110 | 4210 |
| E2E | 4120 | 4220 |

## 環境變數

後端：`backend/.env.example` 每一個都有說明。前台只有 `VITE_API_URL`（留空＝同 origin）與 `VITE_APP_NAME`，都是建置期燒進去的。正式環境的變數對照在 `deploy/部署說明.md` 第五章。

## 目錄

```
api/openapi.yaml            契約（唯一事實來源）
packages/api-client/        由契約產生，不手改（src/schema.d.ts）
packages/demo-world/        示範世界
backend/src/auth/           登入、Session、守衛（requireLogin、requireRole）
backend/src/routes/         路由；每支都要在契約裡、也要被測試呼叫過
backend/src/lib/            env、errors、dates、prisma、migration-check、seed-demo
backend/prisma/             schema.prisma、migrations/、seed.ts
backend/scripts/            run-tests.sh、smoke-test.sh、backfill-TEMPLATE.ts
front/src/pages/<模組>/     畫面；pages/_template 是空頁與掛載測試的範本
front/src/components/       Spinner、BusyButton、States（Loading／空白／錯誤／403／404）、AppShell、RequireAuth
front/src/lib/              api、auth、menu、datetime、demo-world
tests/e2e/                  Playwright；run-e2e.sh 起拋棄式環境
tests/contract/             schemathesis 與路徑參數表
scripts/                    init.sh、scaffold.sh、verify-env.sh、iso-copy.sh、check-contract-drift.mjs、git-hooks/pre-commit
scripts/lib/                disposable-db.sh（拋棄式庫）、stack.sh（拋棄式庫＋一組前後端，verify-env 與 E2E 共用）
docs/                       手冊、拍板紀錄、進度板、詞彙表、測試基準
deploy/                     部署說明（含正式機現況表）、release-checklist、Dockerfile.backend、cloudbuild.yaml（只建映像）、env/.env.prod.example（正式機變數清單）
.claude/                    skills（dev-guidelines、nightly-guard）、agents（qa-reviewer）
```
