# <專案名> · Claude 工作規範

這個檔是給 AI 的短規則。做法與踩坑細節在 `.claude/skills/dev-guidelines/SKILL.md`，完整流程在 `docs/管理者工作室AI單人開發手冊.md`。程式架構與啟動方式見 `README.md`；部署一律照 `deploy/部署說明.md`，其「正式機現況表」與 git tag `prod/vN` 是正式機版本的唯一權威。

## 1. 專案資訊（開專案時填這四行）

| 項目 | 值 |
|---|---|
| 專案名 | <專案名> |
| 一句話說明 | <這是什麼系統、給誰用> |
| 業務時區 BUSINESS_TZ | <例：Asia/Taipei> |
| 正式網址 | <前台網址>（後端：<API 網址>） |

## 2. 開工先讀

1. `docs/PROGRESS.md`：現在有哪些切片在做、哪些待驗收、哪些修正擋上線。
2. `docs/DEVLOG.md` 最新 3 筆：上一次對話做到哪。
3. `.claude/skills/dev-guidelines/SKILL.md`：做法與踩坑。
4. 動到登入、權限、Session：再讀 `.claude/skills/mcc-integration/SKILL.md`。
5. 動到畫面文字：再讀 `docs/ui-terms.md`。

開工先 `git branch --show-current`；`git status` 看到不是自己的檔，當作不存在，不碰。

## 3. 文件優先序

本檔與使用者當下的指示 ＞ `dev-guidelines` ＞ 手冊。三者衝突時照這個順序，並把衝突點寫進回報。

## 4. 資料庫鐵則

- **開發庫不准清除、還原、重建**，也不准跑任何會刪資料的指令。
- 測試一律走 `backend/scripts/run-tests.sh` 的拋棄式測試庫（每次隨機名稱、跑完刪掉）。
- 瀏覽器驗收一律用 `bash scripts/verify-env.sh start` 起一組拋棄式環境（拋棄式庫＋另一組埠的前後端＋示範公司與兩個帳號），用完 `bash scripts/verify-env.sh stop`。不在開發用的埠上按任何會寫入的東西。
- 改了 `backend/prisma/schema.prisma`：**只新增欄位或資料表、全部 nullable 或帶預設**的 migration 可以直接對開發庫 `prisma migrate deploy`，套完重啟後端並煙霧測試。**會刪東西的 migration（DROP TABLE、DROP COLUMN、刪除或清空資料）一律不准套到開發庫**，用 `npx prisma migrate status` 唯讀查出 pending 的，回報時寫明、由使用者決定。不確定算不算刪除，就當作會刪除。
- 不要用 `pnpm --filter <套件> exec` 或 `npm --prefix <dir> exec` 跑測試工具，它不會切換目錄。要跑什麼一律用 package.json 裡定義好的 script。

## 5. 契約與測試

- **先改 `api/openapi.yaml` 再改程式**。新端點、新欄位、新錯誤碼都是。改完 `pnpm openapi:lint` 與 `pnpm openapi:gen`，前台只能用 `packages/api-client`，不手寫 fetch。
- **每個新行為都要有測試，失敗路徑優先**（401／403／404／422 先寫，200 最後）。修 bug 先補一個重現問題的測試，看它紅，再修。
- **守衛測試（掃原始碼擋某種寫法的）寫完要塞一行違規進去確認它會紅**，並有「掃到的檔案數大於 N」的防空轉斷言。
- **破壞性變更三件事**（新增必填、選填改必填、驗證變嚴、權限收緊、schema 改型別）：(1) 補一條「舊資料」測試，用 prisma 直接寫出不符合新規則的資料，不准改建資料樣板來符合新規則；(2) 決定既有資料怎麼辦，三選一寫進 commit 訊息：寫回填腳本、只在往前走的動作上檢查、接受人工補但畫面要指出是哪一欄；(3) 回報時說明影響面。
- **測試分三層**：(1) 改動中只跑跟這次改動相關的測試檔；(2) 併回 main 前，動到的那一端跑完整（後端整套、前端整套＋lint、admin 有動才跑、契約有改才跑 openapi:lint），沒動到的那一端不跑；(3) 三端全套＋整套 E2E 留給每天凌晨的夜間守衛。E2E 檔照樣寫或改，寫好記進 `docs/PROGRESS.md`「待夜間跑的 E2E」。
- **前台每個畫面一條掛載煙霧測試**（空資料 → 有資料渲染一輪）；互動測試（點了接鍵盤、焦點、打字）用 `@testing-library/user-event`，不用 `fireEvent`。
- **處理中四件事**：任何會呼叫後端的按鈕一律做滿：反灰擋重入、顯示會轉的 `<Spinner />`、文字換成「儲存中…」這類、成功才關視窗失敗留在原地。沒有自己 busy 狀態的用 `<BusyButton>`。例外只有兩種：只有圖示沒有文字的小按鈕可省文字；點下去畫面當場就變的樂觀更新控制項可省轉圈。
- **兩種時間的三個不可**：事件時刻存 UTC、API 回 ISO 8601（欄位名 `xxxAtInstant`）、前端依觀看者時區顯示；業務日期（單號、報價日、到期、統計分組）用 `BUSINESS_TZ` 算成 `YYYY-MM-DD` 純字串。後端**不可**把時刻格式化成字串存起來、**不可**用 `new Date().getHours()` 這類本機時鐘做業務判斷、**不可**用固定 `+8` 代替時區名稱。時間函式只准放 `backend/src/lib/dates.ts` 與 `front/src/lib/datetime.ts`。時區測試要凍結時鐘斷言確切值，只驗格式抓不到。
- 畫面上的名詞照 `docs/ui-terms.md`，同一件事全站同一個名字；新名詞先加進詞彙表再用。規則說明寫完整句子。
- 示範資料一律虛構、通俗（照 `packages/demo-world/src/index.ts` 的示範世界），不可用真實公司、真實品牌或使用者自己公司的資料。要避開的真實名字寫進同目錄的 `forbidden.ts`，守衛測試會擋。
- 守衛測試（`backend/src/guards/`、`front/src/guards/`）擋下來時改程式，不改守衛；真的例外在那一行加 `guard: allow` 並寫原因。清單與規矩在 `dev-guidelines` 第 4.9 節。
- 前端 hooks 順序由 ESLint `react-hooks/rules-of-hooks` 把關，pre-commit 改到 `front/src` 會自動跑；要加其他規則先問。

## 6. 提交與合併

- 分支名 `claude/<切片名>`，不直接在 main 改。
- 動到那一端的完整測試全綠，才 `git merge --no-ff` 回 main。別人先推進了 main 就重新合併，不 force。
- commit 訊息中文，寫清楚做了什麼與為什麼，引用拍板紀錄編號（例：「D12」）。
- **push 與部署一律等使用者指示。** AI 不自己 push、不自己部署。
- 合併後三件事：`docs/PROGRESS.md` 把該切片標「待驗收」並標驗收等級（親驗／AI 自驗即可）；`docs/DEVLOG.md` 加一筆；**修到的 bug 如果正式機現行版本也有**（用 `git merge-base --is-ancestor <bug 引入 commit> prod/vN` 判斷），回報第一段必寫「※ 此修復影響正式機，建議評估熱修上線」。
- 每個決定寫一行進 `docs/decisions.md`，給下一個 D 編號。

## 7. 正式機

- **只有部署對話碰正式機**；開發對話與夜間守衛不碰。
- **任何正式機狀態變更（部署、migration、改環境變數、寫資料）都要使用者當次允許**，唯讀查詢可以。
- 部署前：工作目錄乾淨且已 commit；**臨場重查 pending migration**（`prisma migrate status` 連正式庫），不可沿用舊盤點；備份正式庫到 `gcp/db/backup/`；列出這次要上的清單。
- 順序：備份 → 只新增的 migration → 部署後端 → 部署前端 → 煙霧測試 → 登入後功能驗證 → 打 tag `prod/vN` → 更新現況表 → 斷線。
- **破壞性 migration 順序相反**：先部署程式、確認穩定，再跑 migration；順序寫在 migration.sql 檔頭。
- 部署後：`deploy/部署說明.md` 現況表**當下更新、不拖**；關掉 cloud-sql-proxy 並確認埠無監聽，等使用者做決定時也先關。

## 8. 停下來問 vs 自行決定

**要問**：業務規則有兩種解讀、破壞性變更、刪除性操作、安全取捨、要加付費服務、要改 `tests/` 底下既有測試的斷言。固定格式：背景一句話 → 2 至 3 個選項 → 我建議哪個 → 影響範圍。問完等答案，不要先做。

**自行決定**：純技術選型（函式庫、檔案拆法、命名）、不影響行為的重構、文案錯字。決定寫進 `docs/DEVLOG.md` 一行。

## 9. 防造假

- 紅燈只准改實作，或回報「需求可能有疑義」；不准弱化斷言、加 skip、刪測試、改測試資料樣板來讓它過。
- 對 `tests/`、`*.test.ts`、`*.test.tsx`、`*.pw.ts` 的任何刪除或弱化，回報時單獨列一段並標「※ 刪改了測試」。
- 回報先講結果，再講驗證方式與環境狀態（哪個環境的綠、開發庫有沒有 migrate、哪些沒驗到）。測試數字用表格，不能只寫「全綠」。

## 10. 指令規範

- 不把輸出重導向到檔案（禁止 `>`、`>>`），要看摘要直接接管線，例如 `pnpm test 2>&1 | tail -40`。
- 一次 Bash 只做一件事，不用 `&&` 或 `;` 串接。
- 不用 `cd 目錄 && 指令`；在子套件跑指令用 `pnpm --filter <套件名> run <script>`。
- 新增、修改檔案一律用 Edit／Write 工具，不用 `cat >`、`echo >`、heredoc 寫檔。
- 不建立 git worktree；要隔離就用 `scripts/iso-copy.sh` 匯出到副本，副本一律用絕對路徑。
- 不索取、不貼、不印任何密鑰的值；`.env` 只能讀變數名稱是否齊全。
