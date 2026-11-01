import type { FastifyInstance } from 'fastify'

/** GET /health：不查資料庫、不需登入。煙霧測試與 Cloud Run 探測用。 */
export async function healthRoutes(app: FastifyInstance) {
  app.get('/health', async () => ({
    ok: true,
    authMode: app.env.AUTH_MODE,
    businessTz: app.env.BUSINESS_TZ,
    version: app.env.APP_VERSION ?? null,
  }))
}
