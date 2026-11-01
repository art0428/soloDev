# 上線勾選清單

每批上線由部署對話複製這份到 `deploy/releases/<YYYY-MM-DD>_prod-vN.md` 逐條勾，勾完的檔隨 tag 一起 commit。沒勾完不算上線。

## 這一批

| 項目 | 值 |
|---|---|
| 目標版本 | prod/vN |
| 對應 commit | |
| 上一版 | prod/vN-1（commit ） |
| 日期 | |
| 使用者允許部署的訊息（引述一句） | |

## 這一批包含

| 切片或修正 | 合併 commit | migration（檔名／無） | 破壞性？ | 回填腳本 | 部署後要驗的功能 | 驗收等級 |
|---|---|---|---|---|---|---|
| | | | | | | |

## 部署前

- [ ] `git status --short` 無輸出（工作目錄乾淨且已 commit）
- [ ] 動到那一端的全套測試全綠（寫下各端題數）
- [ ] 夜間守衛最近一輪全綠（日期、main sha）
- [ ] 起 cloud-sql-proxy，`prisma migrate status` 臨場重查，列出每一支 pending（不可沿用舊盤點）
- [ ] 每支 pending 標「只新增」或「破壞性」；破壞性的檔頭有寫順序與回退語句
- [ ] `pg_dump` 備份到 `gcp/db/backup/`，檔名、大小、表數寫下來
- [ ] 回填腳本先不帶參數試跑，數字寫下來
- [ ] 把上面的清單貼給使用者，**取得這一次的允許**

## 部署中（照順序，每步做完貼結果再做下一步）

- [ ] 後端 build + push：`gcloud builds submit --config deploy/cloudbuild.yaml --substitutions=_TAG=vN .`，image tag `backend:vN`（遞增不覆蓋，重複會直接失敗）
- [ ] 只新增的 migration `migrate deploy`，然後 `migrate status` 顯示 up to date
- [ ] 部署後端，新 revision ready，`/health` 200
- [ ] 前台 build（燒 API 網址）並上傳，CDN 失效
- [ ] 後台部署（選配）
- [ ] 破壞性 migration（如果有）：後端穩定後再跑，跑前再問一次
- [ ] 回填腳本 `--write`（如果有），結果數字寫下來

## 部署後

- [ ] 煙霧測試 N/N 全過（時間）
- [ ] 登入後功能驗證：使用者登入，部署對話把「這一批包含」每一列的功能走一遍，截圖
- [ ] `git tag prod/vN <commit>`
- [ ] `deploy/部署說明.md` 第二章現況表每一格都更新（最後部署、revision、commit、tag、migration 高水位、backfill、備份、驗證、repo 領先未部署、站著的待辦）
- [ ] `docs/PROGRESS.md`「已上線版本」加一列
- [ ] 關掉 cloud-sql-proxy，`lsof -nP -iTCP:5433 -sTCP:LISTEN` 無輸出
- [ ] 回報使用者：版本、commit、tag、驗證結果、沒驗到的、代理已關

## 出事時

- [ ] 切流量回上一個 revision（指令在部署說明 3.5）
- [ ] 破壞性 migration 已執行的，先用檔頭回退語句加回欄位
- [ ] 現況表寫明回退到哪一版、原因
- [ ] 把原因加進 dev-guidelines 第 7 節
