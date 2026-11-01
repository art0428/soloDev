/**
 * schemathesis 的路徑參數表：每個路徑參數給一個固定值，讓端點穩定回 404（不需要真資料）。
 * 新端點有新的路徑參數就補一行；漏了會在 schemathesis 的 health check 階段被擋下。
 * run-schemathesis.sh 會把這份輸出成 --set-path 參數。
 */
export const PATH_PARAMS: Record<string, string> = {
  // 例：customerId: 'no-customer',
}

if (process.argv[1]?.endsWith('st-prepare-data.ts')) {
  for (const [k, v] of Object.entries(PATH_PARAMS)) console.log(`--set-path ${k}=${v}`)
}
