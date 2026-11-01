/**
 * 組出 Fastify app（不 listen）。測試用 app.inject() 直接打，不開真的伺服器。
 * 新路由檔在這裡掛；每支路由都要在 api/openapi.yaml 裡、也要被測試呼叫過（契約漂移檢查會擋）。
 */
import Fastify, { type FastifyError, type FastifyInstance } from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import { authPlugin } from './auth/guard.js'
import { authRoutes } from './auth/routes.js'
import { AppError, errorBody } from './lib/errors.js'
import type { Env } from './lib/env.js'
import { healthRoutes } from './routes/health.js'
import { internalTestRoutes } from './routes/internal-test.js'
import { meRoutes } from './routes/me.js'

export async function buildApp(opts: { env: Env; logger?: boolean }): Promise<FastifyInstance> {
  const { env } = opts
  const app = Fastify({
    logger: opts.logger === false ? false : { level: env.LOG_LEVEL },
    // Cloud Run 前面有一層負載平衡器：只信任直接連進來的那一跳（hop 0），client IP 才不會被 X-Forwarded-For 偽造。
    // 不給 true（全信）；本機沒有代理時 hop 0 就是瀏覽器本身，行為一樣正確。
    trustProxy: (_address, hop) => hop === 0,
  })

  app.decorate('env', env)

  await app.register(cors, {
    origin: [env.FRONT_URL],
    credentials: true,
  })
  await app.register(cookie, { secret: env.SESSION_SECRET })
  // 直接在根層掛（不用 register）：Fastify 的 register 會封裝，裡面加的 hook 與 decorate 只作用在那一層，
  // 其他路由就拿不到 request.user。要用 register 得包 fastify-plugin，這裡選簡單的做法。
  await authPlugin(app)

  app.setErrorHandler((err: FastifyError | AppError, req, reply) => {
    if (err instanceof AppError) {
      return reply.code(err.status).send(errorBody(err.code, err.message, err.details))
    }
    const fe = err as FastifyError
    if (fe.validation) {
      const details = fe.validation.map((v) => ({
        field: String(v.instancePath || v.params?.missingProperty || '').replace(/^\//, ''),
        message: v.message ?? '格式錯誤',
      }))
      return reply.code(422).send(errorBody('VALIDATION_FAILED', '資料驗證失敗，請檢查標示的欄位。', details))
    }
    if (typeof fe.statusCode === 'number' && fe.statusCode >= 400 && fe.statusCode < 500) {
      // Fastify 自己丟的 4xx（壞 JSON、body 太大、不支援的 content-type）
      return reply.code(fe.statusCode).send(errorBody('BAD_REQUEST', '請求格式錯，請重新整理後再試一次。'))
    }
    req.log.error({ err }, '未處理的錯誤')
    return reply.code(500).send(errorBody('INTERNAL', '發生錯誤，請再試一次。'))
  })

  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send(errorBody('NOT_FOUND', '找不到這個路徑。'))
  })

  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(meRoutes)
  if (env.AUTH_MODE === 'mock') await app.register(internalTestRoutes)

  return app
}
