/**
 * 前台唯一的 API 呼叫入口。型別來自 schema.d.ts（由 api/openapi.yaml 產生，不手改）。
 *
 *   const api = createApi(import.meta.env.VITE_API_URL ?? '')
 *   const { data, error, response } = await api.GET('/api/me')
 *
 * 契約沒有的路徑在這裡會是型別錯誤，這就是「前台只能呼叫契約裡有的 API」的機制。
 * credentials: 'include' 讓瀏覽器帶 Session Cookie；跨網域部署時後端要開 CORS credentials 並把 Cookie 設成 SameSite=None。
 */
import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type Paths = paths
export type Schemas = components['schemas']
export type Me = Schemas['Me']
export type ApiError = Schemas['Error']
export type Health = Schemas['Health']

export function createApi(baseUrl: string) {
  return createClient<paths>({
    baseUrl,
    credentials: 'include',
    // 每次呼叫才取 globalThis.fetch：建立 client 時抓走的參照會繞過之後才接管的 MSW（測試）或 polyfill
    fetch: (input) => globalThis.fetch(input),
  })
}

export type Api = ReturnType<typeof createApi>

/** 從 openapi-fetch 的 error 取出契約的錯誤結構；不是契約格式（例如 502 的 HTML）就包成 UNKNOWN。 */
export function toApiError(error: unknown, status?: number): ApiError['error'] {
  const e = error as Partial<ApiError> | undefined
  if (e && typeof e === 'object' && e.error && typeof e.error.code === 'string') return e.error
  return { code: 'UNKNOWN', message: status ? `伺服器回應 ${status}，請再試一次。` : '發生錯誤，請再試一次。' }
}
