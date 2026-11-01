import { describe, expect, it } from 'vitest'
import { loadEnv } from './env.js'

const base = {
  DATABASE_URL: 'postgresql://localhost:5432/x_test_1_1', // guard: allow（假連線字串，只驗格式，不會連）
  SESSION_SECRET: 'test-session-secret-at-least-32-characters-long',
}

describe('loadEnv', () => {
  it('缺 SESSION_SECRET 或太短就擋', () => {
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/)
    expect(() => loadEnv({ DATABASE_URL: base.DATABASE_URL })).toThrow(/SESSION_SECRET/)
  })
  it('正式環境不准 mock', () => {
    expect(() => loadEnv({ ...base, NODE_ENV: 'production', AUTH_MODE: 'mock' })).toThrow(/mock/)
  })
  describe('正式環境的網址', () => {
    const prod = { ...base, NODE_ENV: 'production', AUTH_MODE: 'mcc', MCC_CLIENT_ID: 'cid', MCC_CLIENT_SECRET: 'sec' }
    it('沒設 API_URL 或 FRONT_URL 就擋，不吃 127.0.0.1 的預設值', () => {
      expect(() => loadEnv({ ...prod, FRONT_URL: 'https://app.example.test' })).toThrow(/API_URL/)
      expect(() => loadEnv({ ...prod, API_URL: 'https://api.example.test' })).toThrow(/FRONT_URL/)
    })
    it('不是 https 就擋', () => {
      expect(() => loadEnv({ ...prod, API_URL: 'http://api.example.test', FRONT_URL: 'https://app.example.test' })).toThrow(/API_URL 要用 https/)
      expect(() => loadEnv({ ...prod, API_URL: 'https://api.example.test', FRONT_URL: 'http://app.example.test' })).toThrow(/FRONT_URL 要用 https/)
    })
    it('兩個都是 https 就過，redirect uri 跟著 API_URL', () => {
      const e = loadEnv({ ...prod, API_URL: 'https://api.example.test', FRONT_URL: 'https://app.example.test' })
      expect(e.MCC_REDIRECT_URI).toBe('https://api.example.test/auth/callback')
    })
    it('開發環境照舊可以用預設值', () => {
      expect(loadEnv({ ...base, AUTH_MODE: 'mock' }).FRONT_URL).toBe('http://127.0.0.1:4100') // guard: allow（驗預設值本身）
    })
  })
  it('mcc 模式要有 client id 與 secret', () => {
    expect(() => loadEnv({ ...base, AUTH_MODE: 'mcc' })).toThrow(/MCC_CLIENT_ID/)
  })
  it('redirect uri 沒給就用 API_URL + /auth/callback', () => {
    const e = loadEnv({ ...base, AUTH_MODE: 'mock', API_URL: 'https://api.example.test' })
    expect(e.MCC_REDIRECT_URI).toBe('https://api.example.test/auth/callback')
  })
  it('PORT 字串轉數字、預設值到位', () => {
    const e = loadEnv({ ...base, AUTH_MODE: 'mock', PORT: '4321' })
    expect(e.PORT).toBe(4321)
    expect(e.BUSINESS_TZ).toBe('Asia/Taipei')
    expect(e.COOKIE_SAME_SITE).toBe('lax')
  })
})
