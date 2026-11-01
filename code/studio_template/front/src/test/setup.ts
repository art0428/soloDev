import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { cleanup } from '@testing-library/react'
import { server } from './msw'

// 前端測試用 MSW 假扮後端；沒寫 handler 的請求直接報錯，不會默默回 fetch 失敗。
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => { server.resetHandlers(); cleanup() })
afterAll(() => server.close())
