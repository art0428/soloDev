/**
 * MCC 登入（OIDC 授權碼流程）的後端這一半，BFF 模式：Token 只在後端，瀏覽器只拿到 sid Cookie。
 * 端點從 issuer 的 /.well-known/openid-configuration 取得。MCC 沒有 userinfo 端點，使用者資料直接讀 id_token。
 * 只用 Node 內建的 fetch；測試用 MSW 假扮 MCC，假服務要跟真的一樣嚴格。
 */
import type { Env } from '../lib/env.js'

type ProviderMetadata = { authorization_endpoint: string; token_endpoint: string; end_session_endpoint?: string }

const metadataByIssuer = new Map<string, Promise<ProviderMetadata>>()
const issuerBase = (env: Env) => env.MCC_ISSUER.replace(/\/+$/, '')

/** 取 MCC 的端點設定。同一個 issuer 只抓一次；抓失敗不留快取，下一個請求再試。 */
export function loadDiscovery(env: Env): Promise<ProviderMetadata> {
  const cached = metadataByIssuer.get(env.MCC_ISSUER)
  if (cached) return cached
  const loading = fetch(`${issuerBase(env)}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(5_000) })
    .then(async (res) => {
      if (!res.ok) throw new Error(`讀不到 MCC 的端點設定（HTTP ${res.status}）`)
      return (await res.json()) as ProviderMetadata
    })
  metadataByIssuer.set(env.MCC_ISSUER, loading)
  loading.catch(() => metadataByIssuer.delete(env.MCC_ISSUER))
  return loading
}

/** 測試換 issuer 或換假服務時清掉快取。 */
export function clearDiscoveryCache(): void {
  metadataByIssuer.clear()
}

/**
 * 讀 JWT 中間那一段的 claims。不驗簽：id_token 是後端自己透過 TLS 向 token 端點拿的（OIDC Core 3.1.3.7 允許）。
 * 不要拿這支去讀瀏覽器送來的 token。
 */
export function readJwtClaims(jwt: string): Record<string, unknown> {
  const payload = jwt.split('.')[1]
  if (!payload) throw new Error('JWT 格式不對')
  const parsed: unknown = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error('JWT 的內容不是物件')
  return parsed as Record<string, unknown>
}

/** 組「導去 MCC 登入」的網址。state 防偽造請求、nonce 防 id_token 重放，都由呼叫端產生並放進簽章 Cookie。 */
export async function buildAuthorizeUrl(env: Env, state: string, nonce: string): Promise<string> {
  const { authorization_endpoint } = await loadDiscovery(env)
  const url = new URL(authorization_endpoint)
  const params: Record<string, string> = {
    response_type: 'code',
    client_id: env.MCC_CLIENT_ID,
    redirect_uri: env.MCC_REDIRECT_URI,
    // offline_access 才拿得到 refresh_token：access_token 壽命短，複驗會員前要先續期，不然會被當成撤銷
    scope: 'openid profile email offline_access',
    // 使用者主動按登入就讓他能換帳號；MCC 還不支援時會忽略這個參數
    prompt: 'select_account',
    state,
    nonce,
  }
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

export type TokenSet = { access_token: string; id_token: string; refresh_token?: string; expires_in?: number }
type TokenReply = Partial<TokenSet> & { error?: string }

/** 對 token 端點送表單（client 憑證一律由這裡帶）。回 HTTP 狀態與解開的 JSON，解不開就是 null。 */
async function postToTokenEndpoint(env: Env, fields: Record<string, string>, timeoutMs: number) {
  const { token_endpoint } = await loadDiscovery(env)
  const res = await fetch(token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...fields, client_id: env.MCC_CLIENT_ID, client_secret: env.MCC_CLIENT_SECRET }),
    signal: AbortSignal.timeout(timeoutMs),
  })
  const json = (await res.json().catch(() => null)) as TokenReply | null
  return { ok: res.ok, status: res.status, json }
}

/** 用授權碼換 token。授權碼只能用一次、幾分鐘就過期。錯誤訊息只帶錯誤碼，不帶回應內容（可能有敏感資料）。 */
export async function exchangeCode(env: Env, code: string): Promise<TokenSet> {
  const { ok, status, json } = await postToTokenEndpoint(
    env,
    { grant_type: 'authorization_code', code, redirect_uri: env.MCC_REDIRECT_URI },
    10_000,
  )
  if (!ok) throw new Error(`用授權碼換 token 失敗：HTTP ${status}${json?.error ? `（${json.error}）` : ''}`)
  if (!json?.access_token || !json.id_token) throw new Error('token 端點的回應少了 access_token 或 id_token')
  return { access_token: json.access_token, id_token: json.id_token, refresh_token: json.refresh_token, expires_in: json.expires_in }
}

export type RefreshResult =
  | { status: 'ok'; accessToken: string; refreshToken?: string }
  | { status: 'invalid' }
  | { status: 'error' }

/**
 * 用 refresh_token 換新的 access_token。
 * invalid＝這次登入真的結束了（400、401、invalid_grant）；error＝MCC 那邊暫時有狀況（5xx、逾時、斷線），照舊放行。
 */
export async function refreshTokens(env: Env, refreshToken: string): Promise<RefreshResult> {
  if (!refreshToken) return { status: 'invalid' }
  let reply: Awaited<ReturnType<typeof postToTokenEndpoint>>
  try {
    reply = await postToTokenEndpoint(env, { grant_type: 'refresh_token', refresh_token: refreshToken }, 5_000)
  } catch {
    return { status: 'error' }
  }
  if (reply.ok && reply.json?.access_token) {
    return { status: 'ok', accessToken: reply.json.access_token, refreshToken: reply.json.refresh_token }
  }
  const rejected = reply.status === 400 || reply.status === 401 || /invalid_(grant|token)/i.test(reply.json?.error ?? '')
  return { status: rejected ? 'invalid' : 'error' }
}

/** access_token 該不該續期：已經過期，或 skewSec 秒內就會過期。讀不到 exp 就回 false，交給 MCC 判斷。 */
export function accessTokenNeedsRefresh(token: string, skewSec = 30, now: Date = new Date()): boolean {
  let exp: unknown
  try {
    exp = readJwtClaims(token).exp
  } catch {
    return false
  }
  return typeof exp === 'number' && (exp - skewSec) * 1000 <= now.getTime()
}

export type MccProfile = { sub: string; name: string; email: string | null; avatarUrl: string | null; nonce: string | null }

/** 從 id_token 的 claims 取本站要的欄位。sub 是會員唯一 ID（帳號主鍵），沒有就整個登入失敗。 */
export function profileFromIdToken(claims: Record<string, unknown>): MccProfile {
  const text = (key: string): string | null => {
    const value = claims[key]
    return typeof value === 'string' && value !== '' ? value : null
  }
  const sub = text('sub')
  if (!sub) throw new Error('id_token 裡沒有 sub')
  const email = text('email')
  return {
    sub,
    name: text('name') ?? text('display_name') ?? email?.split('@')[0] ?? '未命名',
    email,
    avatarUrl: text('picture') ?? text('avatar_url'),
    nonce: text('nonce'),
  }
}
