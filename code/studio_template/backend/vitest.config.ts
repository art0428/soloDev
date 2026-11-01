import { defineConfig } from 'vitest/config'

// 測試環境 TZ 釘成 UTC（dev-guidelines 4.7 鐵則 8）：刻意不等於業務時區，
// 「用機器時鐘算業務日期」的 bug 才會現形。scripts/run-tests.sh 也釘了，這裡是雙保險。
process.env.TZ = 'UTC'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    // 所有測試檔共用同一個拋棄式測試庫，檔與檔之間不能並行
    fileParallelism: false,
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**'],
      exclude: ['src/**/*.test.ts', 'src/test/**', 'src/guards/**', 'src/types.d.ts', 'src/server.ts'],
      reporter: ['text'],
      // 不設全域百分比門檻：覆蓋率是找「整個檔案沒測到」的健檢報告，不是要衝的數字（手冊 10.5）。
      // 唯一門檻：每個檔案都要被測試碰到（perFile 行數 >= 1%），新增的檔案不得零覆蓋。
      thresholds: { perFile: true, lines: 1, statements: 1, functions: 0, branches: 0 },
    },
  },
})
