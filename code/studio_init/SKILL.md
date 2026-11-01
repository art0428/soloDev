---
name: studio-init
description: 用「管理者工作室 AI 單人開發手冊 v1」的專案範本（studio-template v1）在目前資料夾建立新專案。使用者在資料夾裡說「初始化專案」「專案初始化」「開新專案」「建立新專案」「照手冊建專案」「init project」，或任何要在這裡建專案骨架的話，都用本 skill：複製範本（CLAUDE.md、手冊、dev-guidelines 與夜間守衛、守衛測試、能跑的前後台登入骨架、示範世界、部署文件與 Dockerfile）、建齊資料夾、git init 並首次提交、驗證關鍵檔案、印出下一步。只建骨架，不寫業務程式、不建資料庫、不碰任何密鑰。取代舊的 project-init（v6），兩個都裝時請移除 project-init。
---

# 專案初始化（管理者工作室範本 v1）

本 skill 只負責「把範本建出來」。建好之後，一切規則以新專案的 `CLAUDE.md` 與 `docs/管理者工作室AI單人開發手冊.md` 為準。

下面的 `<skill>` 指本 SKILL.md 所在的資料夾，範本快照在 `<skill>/assets/template/`（含 `.claude/`、`.github/`、`.gitignore` 這些隱藏檔）。「目標」指使用者說話時的工作目錄。

## 執行步驟（照順序，全部要做）

### 1. 確認目標資料夾

```bash
ls -A
git rev-parse --show-toplevel
```

可以直接繼續的情況：

- 空的；或只有 `.git`、`README.md`、`.DS_Store`、`docs/prototype/`（使用者先放好的原型）。
- `git rev-parse` 失敗（還不是 git repo），或印出來的就是目標本身。

其他情況**停下來問**，確認前不動任何檔案：

| 狀況 | 選項 |
|---|---|
| 已經有其他專案檔案 | A 還是在這裡建（同名檔一律不覆蓋）／B 改建到新的子資料夾（請使用者給英文資料夾名）／C 取消 |
| 目標在別的 git repo 裡面（`show-toplevel` 不是目標） | A 在這裡另開一個獨立的 repo（建議）／B 取消 |

### 2. 複製範本

```bash
cp -Rn "<skill>/assets/template/." .
```

`-n` 是同名檔一律略過、不覆蓋。複製完比對一下，把「因為已經存在而沒寫入」的檔記下來，收尾要回報。

把子 skill 的檔名改回來。打包限制是一個 skill 套件只能有一個 SKILL.md，所以範本裡的另外三個存成 `SKILL.md.tpl`：

```bash
find .claude/skills -name SKILL.md.tpl
```

對每一個 `<資料夾>/SKILL.md.tpl`：同資料夾沒有 `SKILL.md` 才 `mv` 成 `SKILL.md`；已經有就保留使用者的、`.tpl` 留著，收尾回報。範本裡有三個：`dev-guidelines`、`nightly-guard`、`mcc-integration`。

設定執行權限。skill 解壓縮時可能掉了權限；在首次提交前設好，git 記錄的權限才對，之後跑 init.sh 也不會讓工作目錄變髒：

```bash
chmod +x scripts/*.sh scripts/lib/*.sh scripts/*.mjs scripts/git-hooks/* backend/scripts/*.sh tests/e2e/*.sh tests/contract/*.sh
```

### 3. 建齊資料夾

```bash
bash scripts/scaffold.sh
```

冪等，可以重複跑。把輸出貼給使用者。

### 4. git 初始化與首次提交

1. 沒有 `.git` 才 `git init -b main`。
2. `git config user.name`、`git config user.email` 有一個是空的：**問使用者**要用的名字與 email，用 repo 範圍設定（`git config user.name "…"`，不加 `--global`，不要自己猜）。
3. `git add -A`
4. 確認沒有密鑰檔被加進去：`git diff --cached --name-only | grep -E '(^|/)\.env(\.[A-Za-z0-9_-]+)?$' | grep -v '\.example$'` 要沒有輸出（`.env.example` 這類範本可以）。有輸出就停下來，`git reset -q` 後回報，不提交。
5. `git commit -m "chore: init from studio-template v1"`
6. **提交之後**才 `git config core.hooksPath scripts/git-hooks`。pre-commit 會用 pnpm 跑 lint，相依要等 init.sh 裝好；先設會讓這次首次提交失敗。init.sh 也會再設一次。

已經是 git repo 而且有提交的：照樣在目前分支提交一次，收尾寫明分支名。不建 remote、不 push、不設分支保護。

### 5. 驗證關鍵檔案

逐一 `test -e`，缺任何一個就回報，並從 `<skill>/assets/template/` 再複製那一個檔，不要憑記憶自己寫內容。

<!-- key-files:start -->
- `CLAUDE.md`
- `README.md`
- `docs/管理者工作室AI單人開發手冊.md`
- `docs/decisions.md`
- `docs/PROGRESS.md`
- `docs/ui-terms.md`
- `docs/test-baseline.md`
- `.claude/skills/dev-guidelines/SKILL.md`
- `.claude/skills/nightly-guard/SKILL.md`
- `.claude/skills/mcc-integration/SKILL.md`
- `.claude/agents/qa-reviewer.md`
- `api/openapi.yaml`
- `packages/demo-world/src/forbidden.ts`
- `scripts/init.sh`
- `scripts/scaffold.sh`
- `scripts/verify-env.sh`
- `scripts/git-hooks/pre-commit`
- `backend/scripts/run-tests.sh`
- `.github/workflows/check.yml`
- `deploy/部署說明.md`
- `deploy/release-checklist.md`
- `deploy/Dockerfile.backend`
- `deploy/cloudbuild.yaml`
- `deploy/env/.env.prod.example`
- `.gcloudignore`
<!-- key-files:end -->

另外三件事也要成立：

- `find . -name 'SKILL.md.tpl' -not -path './node_modules/*'` 沒有輸出（使用者原本就有 SKILL.md 的除外）。
- `git status --short` 沒有輸出。
- `git config core.hooksPath` 印出 `scripts/git-hooks`。

### 6. 收尾輸出（照這個格式回報）

1. **頂層結構**：`ls -A` 整理成一層的樹。
2. **驗證結果**：關鍵檔案 N/N、首次提交的短碼與分支、pre-commit 已設定。
3. **沒有寫入的檔**：因為已經存在而略過的檔，沒有就寫「無」。`README.md` 被略過時，告訴使用者範本的說明在 `<skill>/assets/template/README.md`，要合併再說。
4. **接下來四件事**（照順序）：
   1. 把原型存成 `docs/prototype/index_v1.html`：手冊第 4 章那一版，在瀏覽器點過、沒有待決問題的。
   2. 執行 `bash scripts/init.sh <專案代號> --title "顯示名稱"`。代號用英文小寫與連字號（例 `shop-order`），會用在套件名、資料庫名、Cloud Run 服務名；顯示名稱可以是中文。它會填專案名、建 `.env`、裝相依、啟用 pre-commit，最後印出建開發庫的指令與下一步。
   3. 到 MCC 建 Group 與 Service，把測試 Group 的憑證**自己**填進 `backend/.env`、`AUTH_MODE` 改成 `mcc`，再跑一次 init.sh 檢查有沒有漏填。**不要把任何憑證貼進對話。**
   4. 開新對話，貼 init.sh 最後印出的步 1 Prompt。
5. **夜間守衛排程**：排程綁使用者自己的帳號，範本沒辦法替他建。要建的時候在 Claude Code 說：
   ```
   建立排程任務 nightly-guard，每天 02:00 執行：照 .claude/skills/nightly-guard/SKILL.md 跑夜間守衛。
   ```
6. **最後問一句**：要避開的真實名字（自己的公司、客戶、常用的真實品牌）要不要現在給？給了就照 `packages/demo-world/src/forbidden.ts` 檔頭的寫法一行一個寫進去，單獨提交「chore: 真實資料禁字清單」；不給就提醒之後自己填，清單空著時守衛測試等於沒在擋，init.sh 也會提醒。

## 禁止事項

- 不覆蓋、不刪除、不搬動任何既有檔案。
- 不自己跑 init.sh。它要原型先放好、要使用者決定代號；使用者明說要你跑才跑，代號不要自己編。
- 不寫業務程式、不填需求、不自動開始步 1。
- 不建資料庫、不跑 migration、不寫入任何資料庫。
- 不建 remote、不 push、不建排程。
- 不索取、不代填、不顯示任何密鑰的值；`.env` 只能看變數名稱齊不齊。

## 常見狀況

| 狀況 | 處理 |
|---|---|
| 找不到 `<skill>/assets/template/` | skill 安裝不完整。請使用者重新安裝 studio-init，不要憑記憶產生範本。 |
| `git commit` 說身分未設定 | 照步驟 4 第 2 點問使用者，repo 範圍設定。 |
| 首次提交時跑了 pre-commit 而失敗 | 目標原本就設了 `core.hooksPath` 或 `.git/hooks/pre-commit`。回報給使用者，問要不要這次先 `git -c core.hooksPath=/dev/null commit …` 提交。 |
| `chmod` 說某個萬用字元沒有對到檔案 | 範本少了那類腳本，照步驟 5 補檔後再跑一次。 |

## 維護

`assets/template/` 是快照。權威來源在 solo_dev 資料夾裡：範本是 `code/studio_template/`，本檔是 `code/studio_init/SKILL.md`。範本或手冊改版時：先改權威來源，大版號變了（v1 → v2）就把本檔與打包腳本的版本號一起改，然後在 solo_dev 資料夾執行 `python3 code/studio_init/build_skill.py` 重新打包，產出 `skill/studio-init_<版本>.skill`。打包腳本會把快照裡其他的 SKILL.md 存成 `SKILL.md.tpl`，並擋掉 `.env`、`node_modules`、測試產物與看起來像密鑰的值。
