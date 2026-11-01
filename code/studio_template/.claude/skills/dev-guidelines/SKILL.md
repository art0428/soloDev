---
name: dev-guidelines
description: 本專案的開發做法與踩坑紀錄。動程式、改 schema、跑測試、提交、部署前先讀；使用者說「把這個經驗放入 skill」就是要在本檔第 7 節「經驗紀錄」加一條，並把做法改進寫回對應章節。
---

# 開發規範（做法與踩坑）

`CLAUDE.md` 是短規則，本檔是做法與細節，`docs/管理者工作室AI單人開發手冊.md` 是完整流程。三者衝突時以 `CLAUDE.md` 與使用者當下指示為準。

## 0. 本檔怎麼維護

- 使用者說「把這個經驗放入 skill」：在第 7 節**新增一條**（日期、發生什麼、根因、為什麼測試沒抓到、之後怎麼做），並把對應的做法改進寫回第 1 至 6 節的正確位置。不刪舊條目，過時的在開頭標「已由 ○○ 取代」。
- 只放「做法與教訓」。程式結構放 `README.md`，版本狀態放 `deploy/部署說明.md` 現況表，決定放 `docs/decisions.md`，進度放 `docs/PROGRESS.md`。
- 第 7 節範本附帶的六條是教材：前五條是前一個專案的真實事故（細節改寫成通用說法），第六條來自建這份範本的過程。本專案自己的經驗往下加。

## 1. 開工前

- **開發庫不碰**。測試一律走 `backend/scripts/run-tests.sh` 的拋棄式庫；瀏覽器驗收一律 `bash scripts/verify-env.sh start`（它建拋棄式庫、在另一組埠起前後端、seed 一家示範公司與兩個帳號，登入網址印在最後一行），用完 `bash scripts/verify-env.sh stop`。開發用的埠上不按任何會寫入的東西。
- **看有沒有開發伺服器在跑**：`lsof -nP -iTCP -sTCP:LISTEN | grep node`。同一棵工作樹上的 watch 會即時吃到每一次存檔，半成品會直接跑在使用者眼前；要改 schema 或大改，先講一聲，或用 `scripts/iso-copy.sh` 匯出到隔離副本做。
- **確認分支**：`git branch --show-current`。新切片開 `claude/<切片名>`，不直接在 main 改。commit 後看訊息裡的 `[分支名]` 是不是自己的。
- **看測試基準**：`docs/test-baseline.md` 最近一列。判斷「有沒有掉測試」是跟最近一次實跑比。
- **看進度板**：`docs/PROGRESS.md`。要改 `schema.prisma` 的切片一次只准一個，先登記再動工。
- 不用 `pnpm --filter <套件> exec` 或 `npm --prefix <dir> exec` 跑測試工具：它們不切換目錄，曾經從專案最上層誤跑測試把開發庫清光。要跑什麼一律用 package.json 裡定義好的 script。

## 2. 契約優先

- **任何 API 改動先改 `api/openapi.yaml` 再改程式**：新端點、新欄位、新 4xx 代碼、描述。改完 `pnpm openapi:lint`（基準：零錯誤；既有警告數不能變多）與 `pnpm openapi:gen` 重新產生 `packages/api-client`。
- 每支 API 的 description 要寫清楚**誰能打**、什麼情況回 403、什麼情況回 422。QA 審查員靠這段對帳。
- OAS 3.0.3 寫法：`nullable: true` 必須有 `type`；引用 schema 又要 nullable，用 `type: object` 加 `allOf`，不能用 `type: 'null'`。
- 不要用 `allOf: [{$ref: 大 schema}]` 包一個只收幾個欄位的請求體，那等於承諾一堆其實忽略的欄位；逐欄展開。
- pre-commit 改到 `backend/src`、`openapi.yaml`、`schema.prisma` 會跑 `scripts/check-contract-drift.mjs`：每支後端路由都要被測試呼叫過、且在契約裡，否則 commit 失敗。不要為了過檢查而把路由寫進契約卻不寫測試。
- 契約模糊測試（schemathesis）加新端點時，新出現的路徑參數要同步加進 `tests/contract/st-prepare-data.ts` 的參數表，給個固定值讓端點穩定回 404 即可；否則它會用「Too many generated examples are filtered out」這種看起來無關的錯誤擋下來。

## 3. 資料庫與 migration

改 `backend/prisma/schema.prisma` 的完整流程，一步都不能省：

1. 改 schema，寫 migration：`prisma/migrations/<YYYYMMDDHHMM00>_<snake_case>/migration.sql`。依主題拆、**全部 nullable 或帶預設、免回填可上線**。索引用 Prisma 命名慣例 `"Table_colA_colB_idx"`。
2. **會刪東西的（DROP TABLE、DROP COLUMN、改型別、清資料）另開一個 migration 檔**，檔頭註解寫「破壞性：先部署程式、確認穩定，再跑本 migration；回退語句：…」。
3. `pnpm --filter backend run prisma:generate`。注意：generate 會讓正在跑的開發伺服器立刻吃到新程式、資料庫卻還沒新欄位，整片 500。所以第 1 節說要先講一聲。
4. 跑 `pnpm --filter backend run test:migrate`（用疊 migration 的方式建拋棄式庫，確認 migration 與 schema 一致）。
5. 只新增的 migration：對開發庫 `prisma migrate deploy`，重啟後端，打 `/health` 與一支登入後端點煙霧測試。破壞性的：`prisma migrate status` 唯讀查出 pending，回報時寫明、等使用者決定。
6. 回報時寫明：migration 檔名、是否破壞性、開發庫有沒有套、要不要回填。

為什麼：`run-tests.sh` 每次建一個隨機名稱的拋棄式庫，跑完就丟，從頭到尾不碰開發庫。所以測試全綠只證明「程式與 migration 彼此一致」，不證明「你的環境有跟上」。後端啟動時 `lib/migration-check.ts` 會印落後提醒，但那是最後一道，不是流程的一部分。

- **回填腳本**：`backend/scripts/backfill-<主題>.ts`，照 `backfill-TEMPLATE.ts` 寫。慣例：不帶參數＝試跑只報數字、`--write` 才寫；冪等（只填 NULL、重跑不覆寫）；無來源留 NULL 不硬塞；時區相關的要 `--stamp-tz=<IANA>` 明確宣告，不可依賴環境 TZ。正式機部署後手動跑，結果記到部署說明現況表「backfill 已跑」。
- Json 欄位清空用 `Prisma.DbNull`，不能給 `null`。
- seed（`prisma/seed.ts`）只放示範世界的資料，不放任何真實資料。

## 4. 測試

### 4.1 三層

照 `CLAUDE.md` 第 5 節：改動中只跑相關檔 → 併回 main 前動到的那一端跑完整 → 三端全套＋整套 E2E 留給夜間守衛。開發對話寫好或改好 E2E 後記進 `docs/PROGRESS.md`「待夜間跑的 E2E」。

### 4.2 後端

- 用 Vitest 加 Fastify 的 `app.inject()`，不開真的伺服器，每個測試檔自己建 app。
- 只跑幾個檔：`pnpm --filter backend run test src/routes/x.test.ts`（檔名直接接在後面，不加 `--`）。每次都建一個拋棄式庫，名字是 `<專案名>_unit_test_<行程號>_<秒數>`，跑完刪掉；本機 PostgreSQL 上看到這種名字的殘留庫，看前綴就知道是哪個專案留下的。
- 每個端點至少 200、401、403、422、404 各一題；**失敗路徑先寫**。
- 外部服務（MCC、Email、第三方 API）用 MSW 假扮。**假服務要像真的，不要比真的寬鬆**：對方會拒絕的輸入假服務也要拒絕、對方的欄位編碼規則照抄，不要用自己的編碼器測自己的解碼器。曾因假的金流服務比真的寬鬆兩次，上線才發現。
- 守衛測試（掃原始碼擋寫法）寫完一定要做兩件事：塞一行違規進去確認它會紅；加「掃到的檔案數大於 N」的斷言防止路徑寫錯掃到空目錄。
- 修 bug 的重現測試要在修復前先紅過；寫完拿掉修復再跑一次，不紅等於沒寫。
- 固定 mock 會蓋掉整合 bug：把解析函式 mock 成固定物件，「按下去畫面變成什麼」就測不到。能用真實函式就用真實函式，只 mock 網路邊界。

### 4.3 破壞性變更三件事

1. 補一條「舊資料」測試：用 prisma 直接寫出不符合新規則的資料，再打既有的讀取與存檔端點。**不准改建資料樣板來符合新規則**，那會把「舊資料」這個案例從測試裡刪掉，測試從「沒抓到」變成「主動掩蓋」。
2. 明確決定既有資料怎麼辦，三選一寫進 commit 訊息與 `docs/decisions.md`：寫回填腳本；只在往前走的動作（送出、核准）上檢查，存草稿不擋；接受人工補但畫面要指出是哪一欄。
3. 回報時說明影響面：有多少既有資料不符合、使用者會在哪個畫面看到。

E2E 是唯一跨越前後端接縫的測試，破壞性變更一定要有一條 E2E 蓋到「開啟既有資料 → 存檔」這條路，不是只有「新建 → 送出」。

### 4.4 前端

- 每個畫面一條掛載煙霧測試：空資料 → 有資料渲染一輪，含 null → 有值的轉換。範本 `front/src/pages/_template/Page.test.tsx`。
- 互動測試（點了接鍵盤、焦點、Tab、打字進框）一律用 `@testing-library/user-event`。`fireEvent` 只對指定元素送一個事件、不會移動焦點，「點過一列鍵盤就失效」這種 bug 它看不到。單純「點了會呼叫」的仍可用 `fireEvent`。
- user-event 模擬不了中文輸入法選字；那部分在 verify-env 的瀏覽器裡用真鍵盤實測。
- 前端 hooks 放在條件 return 之後會整頁崩潰，ESLint `react-hooks/rules-of-hooks` 加掛載測試是雙保險，兩個都不能拿掉。

### 4.5 E2E

- Playwright，預設 `AUTH_MODE=mock`；上線前跑一次 `tests/e2e/login-real.pw.ts` 真實 MCC 登入（預設 skip）。
- `pnpm e2e` 由 `tests/e2e/run-e2e.sh` 呼叫 `scripts/lib/stack.sh`，起一組拋棄式環境（拋棄式庫、前台 4120／後端 4220，`TZ=UTC`），跑完自動收掉並刪庫。埠跟開發用（4100／4200）與驗收環境（4110／4210）都不同，三組可以同時開著。
- **一個測試檔一個 seed 帳號**（`tests/e2e/seed-user.ts`）。共用帳號會互相汙染：A 檔改了帳號的資料或設定，B 檔登入看到的畫面就不是它預期的那一頁，錯誤訊息還指向 B 檔自己。
- `beforeAll` 建資料要**冪等**（已存在就沿用）。測試失敗後 worker 會重啟並重跑 `beforeAll`，不冪等就連環爆。
- 定位器的 `hasText: undefined` 會被整個丟掉變成命中全部，錯誤看起來像定位器寫錯、其實是資料沒拿到。用 `hasText` 前先斷言那個值存在。
- E2E 紅先看截圖確認畫面停在哪一頁，再讀錯誤訊息。
- E2E 跑的途中不要改那份程式；開發伺服器熱更新會讓無關的題目逾時變紅。

### 4.6 處理中四件事

任何會呼叫後端的按鈕一律做滿：

1. **處理中反灰、擋重入**。
2. **顯示會轉的 `<Spinner />`**（`front/src/components/Spinner.tsx`，CSS 圓環、顏色走 `currentColor`）。不要用圖示字型裡靜止的「loading」字符、不要自己寫 `animation: spin`，全站只有 Spinner 這一個轉圈。守衛測試 `front/src/guards/busy-state.test.ts` 會擋（第 4.9 節）。
3. **文字換成「…中」**：儲存中…／送出中…／載入中…／處理中…。只換圖示不換文字不算。
4. **成功才關視窗，失敗留在原地**。API 包裝函式成功回真值、失敗回 `undefined` 並由它負責顯示錯誤；呼叫端一律寫 `if (await save(x)) close()`，不可寫 `await save(x); close()`。

沒有自己 busy 狀態的用 `<BusyButton busyLabel="儲存中…" onClick={…}>儲存</BusyButton>`，它自己管 busy、擋重入、換文字、卸載後不 setState。

兩個例外：只有圖示沒有文字的小按鈕，轉圈本身就是回饋，不必加文字；即時樂觀更新的控制項（開關、色系選擇），點下去畫面當場就變，那個變化就是回饋，不加轉圈，失敗由錯誤提示負責。判準是「使用者不必等後端就看得到結果」。

骨架屏：只用在大清單的第一次載入，清單是空的而且正在載入才畫，慢過 300 毫秒才出現，換頁與篩選時保留舊資料不畫骨架。其他地方用 `<Spinner />` 或「載入中…」。

### 4.7 時間與時區

系統裡有兩種時間，處理方式相反。動到任何時間欄位前先問「這是哪一種」。

| | 事件時刻 | 業務日期 |
|---|---|---|
| 是什麼 | 時間軸上的一個點 | 帳面上的日曆日 |
| 例子 | 建立時間、送出時間、登入時間 | 單號日期、報價日、到期日、每月歸零、逾期判斷、統計分組 |
| 存哪裡 | Prisma `DateTime`（UTC） | 純字串 `YYYY-MM-DD` |
| 誰決定顯示 | 觀看者所在時區（瀏覽器自己知道） | `BUSINESS_TZ`，全世界同一個值 |
| API 欄位名 | `xxxAtInstant`（ISO 8601） | `xxxDate` |
| 前端怎麼寫 | `showInstant(x.createdAtInstant)` | 原樣顯示，不換算 |

第三種是例外：第三方合約時間（例如金流 API 規定的台北牆鐘時間）。那是對方 API 規定的，不跟 `BUSINESS_TZ` 走，集中在那個第三方的 lib 檔裡，不混進 `dates.ts`。

**只有一套實作**：後端 `backend/src/lib/dates.ts`，前端 `front/src/lib/datetime.ts`。不准在別處再寫第二份；要新函式就往這兩個檔加並補測試。「N 天」一律是日曆天，不是「滿 24 小時算一天」。

九條鐵則：

1. 後端不可把時刻格式化成字串存起來或回傳。那等於把當時那台機器的時區凍進資料裡。
2. 不可用 `new Date().getHours()`／`getDate()`／`getFullYear()`、也不可用 `new Date(年, 月, 日)` 做業務判斷，那取的是執行機器的時區。開發機時區等於業務時區時這類 bug 在本機永遠看不到。
3. 不可用固定偏移（`+8`、`8 * 3600 * 1000`）代替時區名稱。一律 IANA 名稱。
4. 日曆日期的加減在「日期」上做（`shiftDays`、`shiftMonths`），不在時刻上加毫秒。
5. 日曆日期轉資料庫查詢區間用 `dayRange`（半開區間：`>= start` 且 `< next`）。`new Date('2026-09-01T00:00:00')` 是用執行機器時區解讀，在容器上等於 UTC 午夜。
6. 凍結的文件（PDF、Email、匯出的 Excel）無法依觀看者變動，用 `BUSINESS_TZ` 呈現並標明時區。前端不可用 `slice(0, 10)` 切 ISO 字串當日期，那是 UTC 日。
7. `BUSINESS_TZ` 是 `dates.ts` 的常數，從環境變數讀；日後要多時區改成讀租戶設定，函式都已收 `tz` 參數。
8. 測試環境的 TZ 釘成 UTC（`run-tests.sh` 與 `vitest.config.ts` 都釘了），刻意不等於業務時區，別拿掉。機器日等於業務日時鐵則 2 的 bug 完全隱形。Dockerfile 的 `ENV TZ` 只是保險層，程式正確性不可依賴它。
9. 鐵則 2 對測試程式同樣有效。測試要「今天」用後端 `businessToday()`、前端 `businessToday(now, tz)`，不可自己 `new Date().getDate()`，那種測試只在台北 00:00 到 08:00 紅。守衛 `backend/src/guards/tz-hygiene.test.ts` 連測試檔、腳本、E2E 一起掃，擋這件事。

測試怎麼寫才抓得到：只驗格式抓不到時區錯誤。後端用 `vi.setSystemTime()` 凍結時鐘，斷言確切字串；前端時區函式一律傳入明確時區。一定要驗跨日邊界（UTC 16:00 前後等於台北跨日）、跨月邊界、午夜（必須 `00:00` 不是 `24:00`）。

改完時區相關程式，最後一關是機械式檢查，不是人看。前後端兩支 `tz-hygiene` 守衛（第 4.9 節）每次跑測試都會自動掃；要在沒跑測試的情況下手動確認，用下面這組 grep：

```
grep -rnE "\.(getFullYear|getMonth|getDate|getHours)\(" backend/src backend/scripts front/src tests
grep -rnE "new Date\( *[0-9]{4} *,"                       backend/src backend/scripts front/src tests
grep -rnE "8 ?\* ?3600|28800000|\+08:00"                   backend/src backend/scripts front/src
grep -rn  "slice(0, *10)"                                  front/src
grep -rnE "toLocale(Date|Time)?String\("                   backend/src front/src | grep -v timeZone
```

全部要歸零（只剩註解與 `dates.ts`／`datetime.ts` 內部）。

### 4.8 覆蓋率

- 每支後端路由必須被測試呼叫過且在契約裡，pre-commit 硬擋。
- 行覆蓋率只出報告、不設全域門檻；用途是找「整個檔案沒有任何測試碰到」的盲區。唯一門檻：每個檔案的行覆蓋率至少 1%，也就是不准有整個檔案零覆蓋（兩端 `vitest.config.ts` 的 `thresholds.perFile`）。跑法：`pnpm --filter backend run test:coverage`、`pnpm --filter front run test:coverage`。
- 不要為了衝百分比寫沒有斷言的測試。

### 4.9 守衛測試清單

守衛測試是「掃原始碼、擋某種寫法」的測試，放在 `backend/src/guards/` 與 `front/src/guards/`，跟一般測試一起跑，下表共七種。掃描工具在 `packages/guard-kit`（列檔案、去註解、抓中文字串、讀 ui-terms 詞表）。

| 守衛 | 檔案 | 擋什麼 |
|---|---|---|
| 真實資料 | 兩端 `demo-data.test.ts` | `packages/demo-world/src/forbidden.ts` 清單裡的字（含註解）。**清單預設是空的，開專案一定要填**，空清單等於沒擋任何名字 |
| 寫死埠號 | 後端 `hardcoded-ports.test.ts` | `localhost:4200` 這類寫法（後端、前台、E2E、契約測試一起掃，註解不算）。埠號只准出現在 `lib/env.ts`、`playwright.config.ts`、`seed-user.ts` |
| 靜止載入圖示 | 前台 `busy-state.test.ts` | 圖示字型的 loading 字符、`animate-spin`、自己寫的 `animation`、`styles.css` 裡 `spin-rot` 以外的 `@keyframes` |
| 時間寫法 | 兩端 `tz-hygiene.test.ts` | 本機時鐘（`getHours` 等）、`new Date(年, 月, 日)`、固定 `+8` 偏移、沒帶 `timeZone` 的 `toLocale…String`；前台另擋 `slice(0, 10)`。`dates.ts`／`datetime.ts` 也在掃描範圍內，它們只用 `Intl` 與 `getUTC…`，本來就不會命中 |
| 畫面用語 | 兩端 `ui-terms.test.ts` | `docs/ui-terms.md`「不要用」欄的詞出現在字串或 JSX 文字裡（測試檔不掃） |
| 環境變數名單 | 後端 `env-files.test.ts` | `lib/env.ts` 的 schema 是唯一名單：`backend/.env.example`、`deploy/env/.env.prod.example`（含 Dockerfile 的 `ENV`）、前台 `.env.example` 與正式清單 `[build]` 段、部署說明的 `--set-secrets`，有一處少了或多了就紅。密鑰只准放在正式清單的 `[secret]` 段 |
| Node 版本 | 後端 `node-version.test.ts` | `.node-version`、根目錄 `engines.node`、`check.yml`、`deploy/` 的 Dockerfile、目前執行的 Node 主版本不一致 |

規矩：

- 真的例外在那一行加註解 `guard: allow`，後面寫一句為什麼。不准為了過守衛改守衛的規則或掃描範圍；要改先問。
- 每支守衛三件事：掃真程式零違規、「掃到的檔案數大於 N」防空轉、一題塞違規的反例證明會紅。
- **反例題只證明「規則寫對」，證明不了「掃對地方、讀對清單」**。新增或改守衛之後，在 `scripts/iso-copy.sh` 匯出的副本裡對真程式塞一行違規，跑一次確認整樹掃描會紅，再丟掉副本。第 7 節有一條就是這樣抓到的。

### 4.10 pre-commit 與 CI

- **pre-commit**（`scripts/git-hooks/pre-commit`，`git config core.hooksPath scripts/git-hooks` 啟用）只跑改到那一端的快檢查：`.env` 進版控就擋；改到 `backend/src`、`openapi.yaml`、`schema.prisma` 跑契約漂移；改到契約加跑 `openapi:lint` 並提醒一起提交 `schema.d.ts`；改到 `front/src` 跑 ESLint；改 `schema.prisma` 沒附 migration 只提醒不擋。不要用 `--no-verify` 跳過。`.env` 那一關有自己的測試（`packages/guard-kit/src/pre-commit-env.test.ts`，開一個暫存 repo 直接跑 hook）：以前只要同一次提交裡有 `.env.example`，真的 `.env` 也會被放行。改 hook 之後跑 `pnpm --filter @studio/guard-kit run test`。
- **共用的腳本函式**放在 `scripts/lib/`：`disposable-db.sh`（`tmpdb_init` → `tmpdb_create` → `tmpdb_drop`，庫名不像拋棄式測試庫就拒絕執行）、`stack.sh`（`stack_up <用途> <前台埠> <後端埠> <log 資料夾>`、`stack_down`）。後端測試、驗收環境、E2E 都走這兩支，不要在別的腳本裡自己 `createdb`。庫名規則有測試（`packages/guard-kit/src/disposable-db-name.test.ts`）。
- **契約漂移**（`pnpm contract:drift`；要印對照表用 `node scripts/check-contract-drift.mjs --list`）：路由都在契約裡、契約都有路由、每支路由都被 `app.inject` 打過。`/internal/*` 放行；真的不進契約的路由在那一行加 `contract: skip`。
- **CI**（`.github/workflows/check.yml`）只檢查不部署：契約格式、`schema.d.ts` 與契約一致、型別、漂移、guard-kit 自測、前台 lint 與測試、後端 migrate 模式測試、前台 build、密鑰掃描（gitleaks）、相依漏洞（high 以上才擋）。E2E 不在 CI，留給夜間守衛。
- **相依漏洞擋下來時**：先試同主版本內升級；修補版只在新主版本、而且是間接相依的，在根目錄 `package.json` 的 `pnpm.overrides` 指定修補版，跑完三端測試與 E2E 確認沒壞，寫一行進 `docs/decisions.md`。不准調低 `--audit-level` 或拿掉這一步。直接相依要升主版本（React、Prisma、Vitest 這類）是破壞性變更，先問。

## 5. 提交、合併、部署

- 全綠才 commit。commit 訊息中文、寫清楚做了什麼與為什麼、引用 D 編號；結尾附當下系統提示給的 `Co-Authored-By` 那一行。
- 分支完成後 `git merge --no-ff` 回 main。**push 與部署一律等使用者指示**。
- 合併後：`docs/PROGRESS.md` 標待驗收與等級、`docs/DEVLOG.md` 加一筆、`deploy/部署說明.md` 現況表「repo 領先未部署」欄加上這次的項目（有 migration 的寫檔名、要跑回填的寫腳本名）。
- 修到「正式機現行版本也有」的 bug：`git merge-base --is-ancestor <bug 引入 commit> <最新 prod tag>` 為真就是正式機也中，回報第一段必寫「※ 此修復影響正式機，建議評估熱修上線」。
- 正式機操作只在部署對話做，照 `deploy/部署說明.md` 與 `deploy/release-checklist.md`。

## 6. 回報格式

- 先講結果，再講驗證方式與環境狀態：哪個環境的綠（拋棄式庫、verify-env、隔離副本）、開發庫有沒有 migrate、開發伺服器有沒有重啟、哪些沒驗到。
- 測試數字用表格（哪一端、幾題、幾過），不能只寫「全綠」。
- 刪改了任何測試單獨列一段標「※ 刪改了測試」。
- 每個專有名詞第一次出現時用一句話解釋。
- 有事要使用者決定的，用「背景一句話 → 2 至 3 個選項 → 建議 → 影響範圍」格式列在最後。

## 7. 經驗紀錄

範本附帶的前五條是前一個專案的真實事故（細節改寫成通用說法），第六條來自建這份範本的過程，都當教材。本專案的往下加，新的在下面。

- **【教材】正式機所有時間慢 8 小時（把時刻格式化成字串存起來）**：後端用本機時鐘把事件時刻格式化成 `YYYY-MM-DD HH:mm` 字串存進資料庫。正式機容器的時區是 UTC，於是每一筆時間都比台北慢 8 小時：使用者晚上 10 點操作，畫面寫下午 2 點。更隱蔽的是「今天」也走本機時鐘，台北 00:00 到 08:00 之間建的資料，日期會偏一天。**為什麼測試沒抓到**：幾百題後端測試全綠，因為日期的測試只驗格式（`\d{4}-\d{2}-\d{2}`），在 UTC 下照樣通過。**根因**：把「時刻」當「字串」存，等於把執行環境的時區凍進資料；開發機與正式機時區不同，本機永遠看不出來。**之後**：第 4.7 節定為全站唯一做法；時間函式集中兩個檔；測試 TZ 釘成 UTC；凍結時鐘驗確切值。

- **【教材】本機登入 500（migration 沒套到開發庫）**：新增 migration 並 `prisma generate` 後，正在跑的開發伺服器熱重載成新程式，`/api/me` 查新欄位而開發庫沒有那一欄，整站 500。測試照樣全綠，因為測試庫是拋棄式隨機庫。**根因**：把「測試庫全綠」當成「環境沒問題」。**之後**：第 3 節流程第 3 至 5 步；後端啟動時印 migration 落後提醒（`backend/src/lib/migration-check.ts`）；改 schema 的對話先講一聲或在隔離副本做。同型事故：正式機「先部署程式、migration 晚點補」，中間那段時間整站 500，於是有了 `CLAUDE.md` 第 7 節「臨場重查 pending migration」。

- **【教材】舊資料存檔失敗（規則變嚴、既有資料沒跟上、測試樣板一改就把舊資料案例刪掉）**：把某個欄位改成必填，同一個 commit 把所有測試的建資料樣板都補上該欄位，三端全綠。但使用者打開規則變更前建立、沒有那個欄位的舊資料，一按存檔就被擋下。**根因**：測試資料永遠是照新規則現造的，樣板一改，「舊資料」這個案例就從測試裡消失。次因：E2E 只走「新建 → 送出」，「開啟既有資料 → 存檔」完全沒覆蓋，而 E2E 是唯一跨越前後端接縫的測試。**之後**：第 4.3 節「破壞性變更三件事」；補舊資料測試；補一條開啟既有資料存檔的 E2E。

- **【教材】「按儲存沒反應」加上全站沒有一個會動的忙碌指示**：使用者按儲存，視窗關了但資料沒變。兩層問題疊在一起：第一層，API 包裝把錯誤吃掉、只跳兩秒的提示，呼叫端普遍寫 `await save(); close()`，失敗照樣關視窗；第二層，大多數會打後端的按鈕按下去畫面沒有任何變化，有做的那些用的是圖示字型裡靜止的 loading 字符，根本不會轉。**根因**：沒有共用元件，每個畫面各自手寫忙碌狀態；「有換圖示」讓人以為已經處理過了。**之後**：第 4.6 節；`Spinner` 與 `BusyButton` 共用元件；API 包裝成功回真值；守衛測試掃原始碼擋靜止圖示與自己寫的動畫。**教訓**：視覺回饋要當功能驗收，真的在瀏覽器按下去看它動，單元測試證明不了。附帶一條：忙碌按鈕曾用 ref 記「元件還掛著沒」，effect 只寫清理沒設初值，在 React 嚴格模式（effect 跑兩次）下永遠卡在「儲存中…」，單元測試全綠因為沒套嚴格模式。範本的 `BusyButton` 因此乾脆不記這個旗標，並有一題用 `<StrictMode>` 包起來測。

- **【教材】補 E2E 時的連環失敗（E2E 相互汙染）**：新增一條 E2E 時沿用了別檔的帳號，同一個帳號被兩個檔各建了一份資料，登入後停在跟預期不同的頁面，原本那檔連帶紅；第一條失敗後 worker 重啟、重跑 `beforeAll` 又建一份，第二條也紅。**之後**：第 4.5 節三條慣例（一檔一帳號、`beforeAll` 冪等、`hasText` 前先斷言值存在）。**教訓**：E2E 的失敗常是相互汙染，不是各自的 bug；先看截圖確認畫面停在哪一頁，再讀錯誤訊息。

- **【教材】守衛反例全綠，一填清單就紅（清單跟被掃的檔放在同一處）**：真實資料守衛有一題「示範世界本身不含禁字」，掃 `packages/demo-world/src`；禁字清單當時也寫在同一個檔。範本的清單是空的，所以三題全綠、反例題也證明規則會抓。但只要開專案填進第一個公司名，清單本身就被當成違規，這題永遠紅。**為什麼測試沒抓到**：反例題用的是自己塞的假字串，從來沒有「清單有內容」的情境。**怎麼抓到的**：在副本對真程式塞違規跑整樹掃描。**之後**：清單搬到 `forbidden.ts`，自我檢查排除它，並加一題驗排除有效；第 4.9 節規定新增守衛要在副本做整樹塞違規。附帶一個坑：副本的 `node_modules` 若是連結回原專案，`@studio/*` 套件會讀到原專案那份，改副本裡的套件不會生效，要改原處或改用實體複製。

---

（本專案的經驗從這裡往下加：日期、發生什麼、根因、為什麼測試沒抓到、之後怎麼做）
