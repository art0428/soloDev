/**
 * 環境變數：一個地方讀、一個地方驗。程式其他地方只拿 Env 物件，不直接碰 process.env。
 * 缺什麼啟動就失敗並列出缺哪些，不會跑到一半才爆。
 */
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'),
  PORT: z.coerce.number().int().positive().default(4200),
  LOG_LEVEL: z.string().default('info'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL 必填'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET 至少 32 字元'),
  SESSION_TTL_HOURS: z.coerce.number().positive().default(12),
  AUTH_MODE: z.enum(['mcc', 'mock']).default('mcc'),
  API_URL: z.string().url().default('http://127.0.0.1:4200'),
  FRONT_URL: z.string().url().default('http://127.0.0.1:4100'),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  BUSINESS_TZ: z.string().default('Asia/Taipei'),
  /** 部署時填 git tag（例：prod/v3），/health 會回；本機不填 */
  APP_VERSION: z.string().optional(),
  MCC_ISSUER: z.string().url().default('https://members.managers.center'),
  MCC_CLIENT_ID: z.string().default(''),
  MCC_CLIENT_SECRET: z.string().default(''),
  MCC_GROUP_JWT: z.string().default(''),
  MCC_SERVICE_CODE: z.string().default(''),
  MCC_REDIRECT_URI: z.string().default(''),
})

export type Env = z.infer<typeof schema>

export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const r = schema.safeParse(source)
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`)
    throw new Error(`環境變數不完整或格式錯，請照 backend/.env.example 補齊：\n${lines.join('\n')}`)
  }
  const env = r.data
  if (env.AUTH_MODE === 'mock' && env.NODE_ENV === 'production') {
    throw new Error('AUTH_MODE=mock 只准本機與測試，正式環境不准啟動。')
  }
  if (env.NODE_ENV === 'production') {
    // 正式環境不准吃預設值：API_URL、FRONT_URL 的預設是 127.0.0.1，漏設會讓登入後被導回本機網址，而且啟動時不會報錯。
    for (const key of ['API_URL', 'FRONT_URL'] as const) {
      if (!source[key]) throw new Error(`正式環境一定要設 ${key}，不可以用預設值。`)
      if (!env[key].startsWith('https://')) throw new Error(`正式環境的 ${key} 要用 https://，現在是 ${env[key]}。`)
    }
  }
  if (env.AUTH_MODE === 'mcc' && (!env.MCC_CLIENT_ID || !env.MCC_CLIENT_SECRET)) {
    throw new Error('AUTH_MODE=mcc 需要 MCC_CLIENT_ID 與 MCC_CLIENT_SECRET。')
  }
  if (!env.MCC_REDIRECT_URI) env.MCC_REDIRECT_URI = `${env.API_URL}/auth/callback`
  return env
}

/** Cookie 是否只走 HTTPS：正式一律 true；本機 http 要 false 才送得出去 */
export const cookieSecure = (env: Env) => env.NODE_ENV === 'production' || env.COOKIE_SAME_SITE === 'none'
