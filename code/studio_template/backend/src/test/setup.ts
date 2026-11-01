/**
 * 每個測試檔載入前跑一次。
 * 保險絲：DATABASE_URL 一定要指向拋棄式測試庫（<代號>_<用途>_test_<行程號>_<秒數>），否則整個測試拒絕啟動。
 * 這一條擋的是「從錯的目錄直接跑 vitest、把開發庫清光」：測試一開頭就會清資料表，連到開發庫就全沒了。
 */
const url = process.env.DATABASE_URL ?? ''
const dbName = url.split('/').pop()?.split('?')[0] ?? ''
if (!/^[a-z0-9_]+_test_\d+_\d+$/i.test(dbName)) {
  throw new Error(
    `測試拒絕執行：DATABASE_URL 指向「${dbName || '(空)'}」，不是拋棄式測試庫。請用 bash scripts/run-tests.sh 跑測試，不要直接 vitest。`,
  )
}
process.env.TZ = 'UTC'
