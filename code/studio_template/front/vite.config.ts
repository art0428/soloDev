import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * 開發時把 /api、/auth、/health 代理到後端，前台與後端同一個 origin，Cookie 不必跨網域。
 * 正式部署若前台（CDN）與後端（Cloud Run）不同網域，就把 VITE_API_URL 設成後端網址，
 * 後端 COOKIE_SAME_SITE 改 none；比較省事的做法是負載平衡器把 /api 與 /auth 導到後端，維持同網域。
 */
const API_PROXY = process.env.API_PROXY_TARGET || 'http://127.0.0.1:4200'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: API_PROXY, changeOrigin: false },
      '/auth': { target: API_PROXY, changeOrigin: false },
      '/health': { target: API_PROXY, changeOrigin: false },
    },
  },
  preview: {
    host: '127.0.0.1',
    proxy: {
      '/api': { target: API_PROXY, changeOrigin: false },
      '/auth': { target: API_PROXY, changeOrigin: false },
      '/health': { target: API_PROXY, changeOrigin: false },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
