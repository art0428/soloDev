/**
 * 真實資料禁字清單：把你公司、你客戶、真實品牌的名字放進來，守衛測試會拿它掃原始碼（含註解）。
 *   backend/src/guards/demo-data.test.ts：掃 backend/src、prisma、scripts、tests/e2e、tests/contract
 *   front/src/guards/demo-data.test.ts：掃 front/src
 * 這份清單單獨放一個檔，因為「示範世界本身不含禁字」那題要掃 demo-world，清單自己必須排除在外。
 * 範本預設是空的；開專案時一定要填，空清單等於這兩支守衛沒有在擋任何真實名字。
 * 寫法：至少兩個字、寫最短但不會誤傷的那一段（例如公司叫「某某電機股份有限公司」，寫「某某電機」，不要只寫「某某」）。
 */
export const REAL_DATA_FORBIDDEN: readonly string[] = [
  // '你的公司名',
  // '真實客戶名',
]
