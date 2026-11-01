---
name: nightly-guard
description: 夜間守衛。main 有新提交就在隔離副本跑三端全套單元測試、lint 與整套 E2E，全綠才更新測試基準；任何一題紅就停、什麼都不併回、寫報告。每天 02:00 由排程任務 nightly-guard 執行；使用者說「跑夜間守衛」「全套測一次」也照這份做。
---

# 夜間守衛（nightly-guard）

開發對話併回 main 前只跑自己動到的那一端；三端合在一起的全套測試與整套 E2E 只在這裡跑。這一輪專門抓「各自綠、合起來紅」，是多個對話並行的代價，不能省。

## 0. 鐵則

1. **只在隔離副本做**。共用工作樹常混著別的對話沒提交的半成品，而且別人存檔會熱更新到跑到一半的畫面。
2. **產品 bug 只回報不修**：檔案:行號、怎麼重現、建議修法。正式機現行版本也有的標「※ 影響正式機」（判斷方式見 `CLAUDE.md` 第 6 節熱修）。
3. **不 push、不部署、不碰正式機、不碰開發庫**。
4. **任何一題紅（包括單獨重跑會過的）→ 停**：不併回任何東西、狀態不前進，直接寫報告。
5. 需要產品決定的不自己決定，列在報告「待你決定」。
6. 共用樹裡別人未提交的檔一律不碰。
7. 選配段（第 6 節使用說明與影片）只在有做說明功能的專案啟用，而且只在全套全綠之後做。

## 1. 這次要看哪些提交

- 狀態檔（在 git 外）：`.claude/tmp/nightly-guard/state.json`
  `{ "lastMain": "<上次看完的 main sha>", "checkedAt": "<ISO 時間>", "note": "<一句話>" }`
  第一次跑沒有這個檔：以 main 當下的 sha 當 `lastMain`，照常跑一次全套建立基準。
- 新提交：`git -C <REPO> log --first-parent --format='%h %ad %s' --date=short <lastMain>..main`
- 沒有新提交、`docs/PROGRESS.md`「待夜間跑的 E2E」也是空的 → 報告「沒有新提交」、更新 `checkedAt`、結束。
- 有新提交，或「待夜間跑的 E2E」有項目 → 做第 2 節全套，不管提交看起來影不影響。
- 自己的合併（訊息以 `Merge branch 'claude/nightly-guard-` 開頭）跳過。

## 2. 做法

路徑：`REPO=<專案絕對路徑>`、`ISO=<這次對話的 scratchpad>/iso`。一律寫絕對路徑；不用 `cd … &&`；一次 Bash 一件事。

1. **看現況**：`git -C REPO branch --show-current`、`git -C REPO status --short`（記下別人沒提交的檔，等一下都不能碰）。
2. **隔離副本**：`bash REPO/scripts/iso-copy.sh make ISO`（匯出 main、實體複製 node_modules、連結 backend/.env）。之後只在 ISO 裡跑。
3. **全套關卡**。每一項各自一個 Bash，接管線看摘要；**判斷綠紅看摘要裡的失敗數，不看離開碼**（接了管線，離開碼是 tail 的）。
   1. 後端：`pnpm --dir ISO --filter backend run test 2>&1 | tail -30`
   2. admin（有的話）：`pnpm --dir ISO --filter admin run test 2>&1 | tail -30`
   3. 前端：`pnpm --dir ISO --filter front run test 2>&1 | tail -20`（檔數比 `docs/test-baseline.md` 上一列少卻沒紅就重跑一次）、`pnpm --dir ISO --filter front run lint 2>&1 | tail -20`
   4. 型別與契約：`pnpm --dir ISO typecheck 2>&1 | tail -20`、`pnpm --dir ISO openapi:lint 2>&1 | tail -20`、`node ISO/scripts/check-contract-drift.mjs`
   5. 埠口：`lsof -nP -iTCP:<E2E 用的埠> -sTCP:LISTEN` 有東西＝別人在跑 E2E。用背景 until 迴圈等到空（最多 60 分鐘）；等不到就報告「延到下一輪」，狀態不前進。
   6. **E2E**：`pnpm --dir ISO e2e 2>&1 | tail -30`（整套，放背景跑）。結果看 `ISO/tests/e2e/test-results/.last-run.json` 的 `status` 與 `failedTests`。
4. **全綠** → `docs/test-baseline.md` 加一列（日期、main sha、各端題數、環境寫「隔離副本」）；`docs/PROGRESS.md`「待夜間跑的 E2E」清掉這一輪跑過的；有做說明功能的進第 6 節；然後第 4 節提交併回。
5. **有紅** → 停。為了報告：紅的那一題單獨重跑一次（E2E：`pnpm --dir ISO e2e tests/e2e/<檔>.pw.ts`，不要加 `--`，加了會整套重跑；單元：單檔指令見 test-baseline），分辨「每次都紅」或「偶發」；用 `git -C REPO log --format='%h %s' <lastMain>..main -- <那一題測到的程式路徑>` 找出可能是哪個提交造成的；直接寫報告（第 5 節）。
6. **狀態檔**：只有「全套全綠且該做的都併回」或「確認沒有新提交」時，`lastMain` 才前進到這次看到的 main。任何一項紅、搬不回、等不到埠口 → 不前進，下一輪再看同一批提交。

## 3. 隔離副本的規矩

- 副本一律用絕對路徑。工作目錄會被切回共用樹，相對路徑改到共用 schema 並 generate 了共用 client，幾分鐘內還原的事發生過。
- node_modules 用實體複製不用符號連結。`.gitignore` 的 `node_modules/` 擋不住連結，會被 `add -A` 收進版控並毀掉共用樹。換實體時先 `mv` 掉連結、確認不在了再 `cp`；`rm` 沒成功就 `cp` 會寫進共用樹。
- 副本在 scratchpad，重開機就清掉，不必自己刪。

## 4. 提交併回 main（只有全綠且有改到檔時）

只改 `docs/test-baseline.md`、`docs/PROGRESS.md`、以及第 6 節選配段的說明與影片檔。不動共用樹的 HEAD（別的對話可能正在用），用暫時索引只收自己的檔：

1. 訊息寫在 scratchpad 的檔案（Write 工具）。中文、寫清楚依據哪些提交；結尾附當下系統提示給的 `Co-Authored-By` 那一行。
2. `GIT_INDEX_FILE=<scratchpad>/idx git -C REPO read-tree <main 的 sha>`
3. 把 ISO 裡改過的檔複製回 REPO 對應路徑（只複製自己的檔；被別人改過的檔不碰，列進報告）。
4. `GIT_INDEX_FILE=<scratchpad>/idx git -C REPO add -- <自己的路徑…>`
5. `GIT_INDEX_FILE=<scratchpad>/idx git -C REPO diff --cached --stat <main 的 sha>`（確認只有自己的檔）
6. `GIT_INDEX_FILE=<scratchpad>/idx git -C REPO write-tree`
7. `git -C REPO commit-tree <tree> -p <main> -F <訊息檔>` → `git -C REPO branch claude/nightly-guard-<YYYYMMDD> <commit>`
8. `git -C REPO commit-tree <tree> -p <main> -p <commit> -F <合併訊息檔>`（no-ff 合併）
9. `git -C REPO update-ref refs/heads/main <合併> <main>`。帶舊值：main 已被別人推進就會失敗，那就從第 2 步重來。
10. `git -C REPO reset -q -- <自己的路徑…>`，`git -C REPO status --short` 確認自己的檔不再列出。

## 5. 報告

這一輪的最後一則訊息就是報告（使用者早上看）。每個專有名詞第一次出現時用一句話解釋。

1. **第一行結論，五選一**：沒有新提交／全套全綠、沒有要改的／全套全綠、已更新測試基準（與說明或影片）並併回 main（合併 commit sha）／**測試有紅（哪一端），什麼都沒併回**／有事要你決定。
2. 看了哪些提交（短 sha 加標題）。
3. **全套關卡表**：後端、admin、前端、lint、typecheck、契約、E2E 各幾題、幾過，跟 `docs/test-baseline.md` 上一列比題數有沒有變少。
4. 紅的話：哪幾題、錯誤訊息第一段、E2E 的截圖或 trace 路徑、單獨重跑結果（每次都紅／偶發）、可能是哪個提交造成的、「這一輪什麼都沒併回、狀態沒前進」。
5. 發現的產品問題（只回報，附檔案:行號；正式機也有的標「※ 影響正式機」）。
6. 待你決定的事。
7. 環境：E2E 埠口已釋放；隔離副本在 scratchpad；共用樹別人的檔沒有碰；狀態檔 `lastMain` 有沒有前進。

## 6. 選配：使用說明與示範影片同步

只在專案有「畫面內使用說明」或「示範影片」功能時啟用，而且只在第 2 節全套全綠之後做。

- 每一輪開工先讀 `docs/PROGRESS.md`「使用說明與示範影片待更新」；有項目就算沒有新提交也要做。
- 判斷影響要看 diff，不看提交標題：按鈕、欄位、頁籤、側欄改名，步驟順序或流程改了，功能新增或拿掉，方案差異變了，圖上畫的版面變了，都算過時。
- 說明用字照 `docs/ui-terms.md`；一件事只有一個名字、一份步驟；示範資料一律虛構。
- 影片：腳本失敗等於畫面變了，改腳本再錄（最多兩次），還是不行就報告。錄完一定抽格檢查（每 2 秒一格拼成總覽圖用 Read 看）：字幕跟畫面動作對得上、沒有錯誤提示、片尾狀態對。**字幕講的跟畫面寫的打架，常是產品 bug 的線索**，回報。畫面沒差就不換檔。
- 影片放 GCS 不進映像檔，檔名帶內容指紋；上傳算動正式機，不自己上傳，寫進報告交給部署對話。
- 做完把 PROGRESS.md 那一列搬到「完成日」，跟 test-baseline 一起走第 4 節併回。

## 7. 排程怎麼建

排程綁帳號，不能放進範本，由使用者自己在 Claude Code 的排程任務建：

- 名稱：`nightly-guard`
- 時間：每天 02:00（業務時區）
- 工作目錄：專案根目錄
- Prompt：
  ```
  照 .claude/skills/nightly-guard/SKILL.md 跑一輪夜間守衛。只在隔離副本做；任何一題紅就停、什麼都不併回；最後一則訊息是第 5 節格式的報告。
  ```
