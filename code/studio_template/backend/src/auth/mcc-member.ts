/**
 * MCC 會員 API：/member/check（這個會員現在還有效嗎）與 /member/logout（通知 MCC 登出）。
 * 要帶群組層的憑證（Group JWT、Service Code），加上這次登入的 access_token 與會員 suuid（＝id_token 的 sub）。
 * 沒設 MCC_GROUP_JWT（本機、測試）就整組停用，呼叫端看 memberApiEnabled 決定要不要呼叫。
 * 欄位與錯誤碼照 MCC 整合指南：https://members.managers.center/docs/integration-guide
 */
import type { Env } from '../lib/env.js'

export function memberApiEnabled(env: Env): boolean {
  return env.AUTH_MODE === 'mcc' && Boolean(env.MCC_GROUP_JWT)
}

/**
 * valid：還有效。revoked：MCC 明確說這個會員無效，要清 Session。
 * error：沒辦法判斷（網路，或我方群組層的設定出錯），降級放行並記 log；不然 MCC 短暫故障或 Group JWT 到期會把所有人鎖在門外。
 */
export type MemberStatus = 'valid' | 'revoked' | 'error'

type MccReply = { success?: boolean; error_code?: string; error?: string; details?: { reason?: string } }

async function callMemberApi(env: Env, path: '/member/check' | '/member/logout', accessToken: string, suuid: string) {
  const res = await fetch(`${env.MCC_ISSUER.replace(/\/+$/, '')}${path}`, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.MCC_GROUP_JWT}`,
      'x-service-code': env.MCC_SERVICE_CODE,
      'x-member-access-token': accessToken,
      'x-member-suuid': suuid,
      'content-type': 'application/json',
    },
    body: JSON.stringify({}),
    signal: AbortSignal.timeout(5_000),
  })
  const reply = (await res.json().catch(() => null)) as MccReply | null
  return { res, reply }
}

/** 錯誤碼提到會員本身（ACCESS_TOKEN、SUUID、MEMBER）算會員層；提到群組、服務、JWT 這類是我方設定的問題。 */
export function blamesOurSetup(reply: MccReply | null): boolean {
  const said = [reply?.error_code, reply?.error, reply?.details?.reason].filter(Boolean).join(' ').toUpperCase()
  if (/ACCESS_TOKEN|SUUID|MEMBER/.test(said)) return false
  return /GROUP|SERVICE|NOT_INITIATED|JWT|TOKEN|AUTH/.test(said)
}

export async function checkMember(env: Env, accessToken: string, suuid: string): Promise<MemberStatus> {
  if (!memberApiEnabled(env) || !accessToken || !suuid) return 'error'
  try {
    const { res, reply } = await callMemberApi(env, '/member/check', accessToken, suuid)
    if (blamesOurSetup(reply)) return 'error'
    if (res.status === 401 || res.status === 403) return 'revoked'
    if (!res.ok) return 'error'
    return reply?.success === false ? 'revoked' : 'valid'
  } catch {
    return 'error'
  }
}

/** 通知 MCC 這次登入結束。失敗不擋登出（本站的 Session 照樣刪），所以只回成功與否。 */
export async function logoutMember(env: Env, accessToken: string, suuid: string): Promise<boolean> {
  if (!memberApiEnabled(env) || !accessToken || !suuid) return false
  try {
    const { res } = await callMemberApi(env, '/member/logout', accessToken, suuid)
    return res.ok
  } catch {
    return false
  }
}
