import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config'

// TZ 釘 UTC：與後端一致，業務時區是 Asia/Taipei，兩者刻意不同（dev-guidelines 4.7 鐵則 8）
process.env.TZ = 'UTC'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      globals: false,
      setupFiles: ['src/test/setup.ts'],
      include: ['src/**/*.test.{ts,tsx}'],
      css: false,
      coverage: {
        provider: 'v8',
        include: ['src/**'],
        exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/guards/**', 'src/main.tsx', 'src/vite-env.d.ts'],
        reporter: ['text'],
        // 不設全域百分比門檻；唯一門檻是每個檔案都要被測試碰到（新增的檔案不得零覆蓋，手冊 10.5）
        thresholds: { perFile: true, lines: 1, statements: 1, functions: 0, branches: 0 },
      },
    },
  }),
)
