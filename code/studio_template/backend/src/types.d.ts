import type { Env } from './lib/env.js'
import type { AuthUser } from './auth/guard.js'

declare module 'fastify' {
  interface FastifyInstance {
    env: Env
  }
  interface FastifyRequest {
    /** 由 auth plugin 的 onRequest 解出；沒登入是 null */
    user: AuthUser | null
    /** 本次請求的 Session token（登出要用）；沒登入是 null */
    sessionToken: string | null
  }
}
