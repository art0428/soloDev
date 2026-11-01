# 拍板紀錄

每個決定一行、一個編號，由 AI 在討論結束時寫、由你（需求帽）確認。之後 commit 訊息、測試名稱、PROGRESS.md、切片原型都引用這個編號。三個月後你一定忘記為什麼這樣做，這張表是唯一的證據。

規則：
- 編號只增不減、不重用。改變心意就寫一條新的，在「影響」欄註明「取代 D 幾」，舊的那一行不刪、在前面加 ~~刪除線~~。
- 「決定」欄寫完整句子，寫「什麼情況下怎麼做」，不寫「討論過了」。
- 「來源」欄寫這個決定從哪裡來：原型哪一頁、哪次驗收、哪個事故。
- 破壞性變更（新增必填、選填改必填、驗證變嚴、權限收緊、schema 改型別）必須先有一條拍板紀錄寫明「既有資料怎麼辦」，才可以開切片五步的 A。

| 編號 | 日期 | 決定 | 影響 | 來源 |
|---|---|---|---|---|
| D1 | 2026-11-01 | 登入一律走 MCC，不自建帳號密碼；第一次登入自動建檔，角色預設為「一般成員」，管理員由第一個登入的人擔任 | backend/src/auth/、users／roles 資料表 | 手冊第 2 章技術架構 |
| D2 | 2026-11-01 | 事件時刻存 UTC 並依觀看者時區顯示；業務日期用 BUSINESS_TZ 算成純日期字串；兩種函式只放 lib/dates.ts 與 lib/datetime.ts | 所有時間欄位、測試 TZ 釘 UTC | 手冊第 7 章 B、dev-guidelines 第 7 節第一條教材 |
| D3 | 2026-11-01 | 示範資料一律虛構：示範世界寫在 packages/demo-world/src/index.ts（前後端共用），要避開的真實名字寫在同目錄 forbidden.ts，守衛測試掃原始碼擋這些字 | 原型測試資料、seed、E2E、使用說明 | 手冊第 4 章 |
| D4 | 2026-11-01 | 相依漏洞 high 以上 CI 就擋。修補版只在新主版本的間接相依，用根目錄 package.json 的 pnpm.overrides 指定修補版（目前 undici、@faker-js/faker、deepmerge-ts、tinypool）；直接相依 zod 從 3 升到 4（只有 env.ts 用到）。React、Prisma、Vitest 等直接相依的主版本升級另案處理 | package.json、backend/package.json、check.yml 的 audit 步驟 | 範本建置時 pnpm audit 找到 6 個 high、2 個 critical |
| D5 | 2026-11-01 | `deploy/cloudbuild.yaml` 只建後端映像並推到 Artifact Registry，不跑 migration、不部署。映像 tag 一律 vN 遞增不覆蓋，同號已存在第一步就失敗。部署照 `deploy/部署說明.md` 一步一步做，每步取得使用者當次允許 | deploy/cloudbuild.yaml、部署說明 3.2、release-checklist | 部署順序有「備份 → 只新增的 migration → 後端 → 前台」與「破壞性 migration 反過來」兩種，塞進一支 build 等於拿掉檢查點 |
| D6 | <日期> | <你的第一個業務決定> | | 原型 index_v1 的 <哪一頁> |
