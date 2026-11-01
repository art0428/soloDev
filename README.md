# soloDev：管理者工作室 AI 單人開發手冊與專案範本

一個人、一份前台原型、一組 Claude Code 對話，把一套完整的系統做出來並持續優化。

這個 repo 收錄三樣東西：**手冊**（流程與規則）、**專案範本**（能直接跑的前後端骨架與守衛）、**初始化 skill**（把範本一鍵建到新專案）。團隊成員只要做好一份原型 index.html，就能照手冊讓 Claude Code 開發出整套系統。

## 內容

| 路徑 | 是什麼 | 誰會用 |
|---|---|---|
| `report/管理者工作室AI單人開發手冊_v2.md` | 手冊 v1.1。每一步做什麼、怎樣算做完、給 AI 的話怎麼說 | 每個開發者，開工前先讀完 |
| `report/手冊配套文件與初始化程式清單_v2.md` | 手冊需要哪些配套檔案、每個檔案的用途與大綱 | 想了解範本為什麼長這樣的人 |
| `report/範本建置狀態_v4.md` | 範本四批建置的紀錄、驗證結果與已知限制 | 維護範本的人 |
| `code/studio_template/` | 專案範本 studio-template v1：CLAUDE.md、dev-guidelines、守衛測試、前後端登入骨架、示範世界、部署文件 | 由 skill 自動複製，一般不用手動碰 |
| `code/studio_init/` | studio-init skill 的 SKILL.md 與打包腳本 `build_skill.py` | 維護範本的人 |
| `skill/studio-init_v1.skill` | 打包好的 skill，裝進 Claude 後就能用「初始化專案」建專案 | 每個開發者，裝一次 |

## 團隊怎麼用（四步）

### 一、安裝 studio-init skill

下載 `skill/studio-init_v1.skill`，在 Claude 桌面版的 Skills 設定裡上傳；或解壓後把 `studio-init/` 資料夾放進 `~/.claude/skills/`。
※ 如果你之前裝過舊的 project-init，請先移除，兩個不要同時裝。

### 二、做好前台原型

照手冊第 4 章「原型怎麼做才夠用」做一份 `index_v1.html`：所有畫面、所有狀態（空的、載入中、錯誤）、所有欄位都要在原型裡。沒有原型不要開工，AI 會自己猜。
畫面風格照管理者工作室設計系統（https://art0428.github.io/webdesign/ ）選一套 S1 到 S7。

### 三、初始化專案

開一個空資料夾，把原型存成 `docs/prototype/index_v1.html`，在這個資料夾打開 Claude Code 說：

```
初始化專案
```

skill 會複製範本、建齊資料夾、git init 並首次提交，最後印出下一步。接著照範本 README 跑 `bash scripts/init.sh <專案代號> --title "顯示名稱"`，再 `pnpm dev` 就能在本機登入看到骨架。

### 四、照手冊開發

- 第一版：手冊第 6 章步 0 到步 6（骨架 → 契約 → 實作 → 測試 → 驗收 → 上線）。
- 之後每個新需求、每個 bug：第 7 章「切片五步」做一輪。
- 上線後：第 9 章正式機規則、第 10 章持續優化。

開發時的細部規則（AI 能動什麼、不能動什麼、怎麼驗證）都在新專案的 `CLAUDE.md` 與 `.claude/skills/dev-guidelines/SKILL.md`，Claude Code 開工會自動讀。

## 環境需求

| 項目 | 版本或說明 |
|---|---|
| Claude Code | 桌面版或 CLI 皆可 |
| Node.js | 22（範本的 `.node-version` 會鎖） |
| pnpm | 10（沒有時 init.sh 會改用 corepack） |
| PostgreSQL | 本機一個開發庫；正式用 Cloud SQL |
| MCC 帳號 | MCC 是管理者中心（members.managers.center）的登入平台。本機用 `AUTH_MODE=mock` 假登入即可，接真實登入時才需要測試 Group 的憑證 |
| 部署（選配） | Docker 與 GCP（Cloud Run、Cloud Storage、Secret Manager） |

## 技術架構（範本預設）

| 層 | 技術 |
|---|---|
| 前台 | React 18 + Vite + TypeScript + React Router |
| 後端 | Node 22 + Fastify 5 + TypeScript + Prisma 6 |
| 資料庫 | PostgreSQL |
| 契約 | OpenAPI 3（`api/openapi.yaml`）自動產生 `packages/api-client`，前台只能呼叫契約裡有的 API |
| 登入 | MCC OIDC，BFF 模式：瀏覽器只導向，Token 由後端換、存 httpOnly Cookie，前端不碰 Token |
| 測試 | Vitest 單元與契約測試、守衛測試、Playwright E2E、Schemathesis 契約模糊測試 |

## 版本對應

| 手冊 | 範本 | skill |
|---|---|---|
| v1.1（`report/管理者工作室AI單人開發手冊_v2.md`） | studio-template v1（`code/studio_template/`） | `skill/studio-init_v1.skill` |

三者一起改版：改手冊就重建範本、重新打包 skill，打相同版本號。

## 維護範本

1. 直接修改 `code/studio_template/` 裡的檔案（範本自己的 `docs/管理者工作室AI單人開發手冊.md` 是手冊副本，要跟 `report/` 的同步）。
2. 執行打包：

```
python3 code/studio_init/build_skill.py
```

腳本只用 Python 標準函式庫，會檢查不該進套件的東西（.env、node_modules、建置產物）、env 範例檔密鑰欄位必須是空的、關鍵檔案都在，通過才會寫出 `skill/studio-init_<版本>.skill`。

## 安全說明

- 這個 repo 不含任何密鑰。所有 `.env` 都只有 `.example`，密鑰欄位留空。
- 範本的示範資料（公司、人、客戶、電話、email）全是虛構的，開發時也必須維持虛構，守衛測試會擋真實資料。
- 正式機的密鑰放 Secret Manager，流程見範本的 `deploy/部署說明.md`。
