/** oidc.ts 與 mcc-member.ts 裡不碰網路的函式：讀 JWT、判斷要不要續期、取個人資料、錯誤碼分層。 */
import { describe, expect, it } from 'vitest'
import { accessTokenNeedsRefresh, profileFromIdToken, readJwtClaims } from './oidc.js'
import { blamesOurSetup } from './mcc-member.js'

const jwtWith = (claims: object) => `h.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.s`

describe('readJwtClaims', () => {
  it('讀得出中文與 base64url 字元', () => {
    expect(readJwtClaims(jwtWith({ sub: 'm-1', name: '許經理', note: '??>>' }))).toEqual({ sub: 'm-1', name: '許經理', note: '??>>' })
  })
  it('不是三段、內容不是物件：丟錯', () => {
    expect(() => readJwtClaims('abc')).toThrow('JWT 格式不對')
    expect(() => readJwtClaims(jwtWith([1, 2]))).toThrow('不是物件')
  })
})

describe('accessTokenNeedsRefresh', () => {
  const now = new Date('2026-11-01T00:00:00Z')
  const nowSec = now.getTime() / 1000
  it('還有 10 分鐘：不用；剩 20 秒（在 30 秒緩衝內）：要；已經過期：要', () => {
    expect(accessTokenNeedsRefresh(jwtWith({ exp: nowSec + 600 }), 30, now)).toBe(false)
    expect(accessTokenNeedsRefresh(jwtWith({ exp: nowSec + 20 }), 30, now)).toBe(true)
    expect(accessTokenNeedsRefresh(jwtWith({ exp: nowSec - 1 }), 30, now)).toBe(true)
  })
  it('讀不到 exp 或不是 JWT：回 false 交給 MCC 判斷', () => {
    expect(accessTokenNeedsRefresh(jwtWith({ sub: 'x' }), 30, now)).toBe(false)
    expect(accessTokenNeedsRefresh('opaque-token', 30, now)).toBe(false)
  })
})

describe('profileFromIdToken', () => {
  it('名稱依序取 name、display_name、email 帳號，都沒有寫「未命名」', () => {
    expect(profileFromIdToken({ sub: 's', name: '蔡業務', email: 'tsai@demo.local' }).name).toBe('蔡業務')
    expect(profileFromIdToken({ sub: 's', display_name: '小蔡' }).name).toBe('小蔡')
    expect(profileFromIdToken({ sub: 's', email: 'tsai@demo.local' }).name).toBe('tsai')
    expect(profileFromIdToken({ sub: 's' }).name).toBe('未命名')
  })
  it('頭像取 picture，沒有再取 avatar_url；空字串當作沒有', () => {
    expect(profileFromIdToken({ sub: 's', picture: '', avatar_url: 'https://a.test/x.png' }).avatarUrl).toBe('https://a.test/x.png')
  })
  it('沒有 sub 就整個登入失敗', () => {
    expect(() => profileFromIdToken({ name: '沒有 sub' })).toThrow('sub')
    expect(() => profileFromIdToken({ sub: '' })).toThrow('sub')
  })
})

describe('blamesOurSetup：會員層的錯才踢人，我方設定層的錯降級放行', () => {
  it('群組、服務、JWT 類：是我方設定', () => {
    expect(blamesOurSetup({ error_code: 'GROUP_NOT_INITIATED' })).toBe(true)
    expect(blamesOurSetup({ error: 'FORBIDDEN', details: { reason: 'invalid_jwt_encoding' } })).toBe(true)
    expect(blamesOurSetup({ error_code: 'SERVICE_DISABLED' })).toBe(true)
  })
  it('提到會員本身：不是我方設定（交給狀態碼判斷撤銷）', () => {
    expect(blamesOurSetup({ error_code: 'MEMBER_REVOKED' })).toBe(false)
    expect(blamesOurSetup({ error_code: 'INVALID_ACCESS_TOKEN' })).toBe(false)
    expect(blamesOurSetup({ error_code: 'SUUID_MISMATCH' })).toBe(false)
  })
  it('沒有錯誤碼或回應解不開：不算我方設定', () => {
    expect(blamesOurSetup({ success: true })).toBe(false)
    expect(blamesOurSetup(null)).toBe(false)
  })
})
