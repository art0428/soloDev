import { createApi } from '@studio/api-client'

/** 後端網址：留空＝同一個 origin（開發用 vite 代理；正式用負載平衡器導路徑） */
export const API_URL = (import.meta.env.VITE_API_URL ?? '').replace(/\/$/, '')

/** fetch 要絕對網址（Node 的 fetch 不接受相對路徑，測試在 jsdom 裡也是走 Node 的 fetch） */
const resolvedBase = API_URL || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1')

/** 全前台唯一的 API 呼叫器。不要在別處 fetch。 */
export const api = createApi(resolvedBase)

/** 登入入口（會離開 SPA 導向後端，再被導去 MCC 或直接導回） */
export const loginUrl = (mockAs?: string) =>
  `${API_URL}/auth/login${mockAs ? `?as=${encodeURIComponent(mockAs)}` : ''}`
