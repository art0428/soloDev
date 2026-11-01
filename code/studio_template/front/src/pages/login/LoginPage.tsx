import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { api, loginUrl } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { configureBusinessTz } from '../../lib/datetime'
import { DEMO_USERS } from '../../lib/demo-world'
import { Loading } from '../../components/States'

const APP_NAME = import.meta.env.VITE_APP_NAME || '專案名'

/**
 * 登入頁。按下去離開 SPA 導向後端 /auth/login：mcc 模式再被導去 MCC，mock 模式直接以種子使用者登入。
 * 後端是不是 mock 模式由 /health 的 authMode 決定，前台不用自己設。
 */
export function LoginPage() {
  const { state } = useAuth()
  const [authMode, setAuthMode] = useState<'mcc' | 'mock' | null>(null)

  useEffect(() => {
    let cancelled = false
    api.GET('/health').then(({ data }) => {
      if (cancelled || !data) return
      setAuthMode(data.authMode)
      configureBusinessTz(data.businessTz)
    }).catch(() => { if (!cancelled) setAuthMode('mcc') })
    return () => { cancelled = true }
  }, [])

  if (state.status === 'user') return <Navigate to="/" replace />
  if (state.status === 'loading') return <Loading />

  return (
    <div className="login">
      <h1>{APP_NAME}</h1>
      <p className="login-hint">請用公司會員中心的帳號登入。</p>
      {authMode === 'mock' ? (
        <div className="login-actions" data-testid="mock-login">
          <p className="login-dev">目前是本機假登入模式，正式環境不會出現這兩顆按鈕。</p>
          <a className="btn primary" href={loginUrl(DEMO_USERS.admin.mccSub)}>以{DEMO_USERS.admin.name}（管理員）登入</a>
          <a className="btn" href={loginUrl(DEMO_USERS.member.mccSub)}>以{DEMO_USERS.member.name}（一般成員）登入</a>
        </div>
      ) : (
        <div className="login-actions">
          <a className="btn primary" href={loginUrl()}>登入</a>
        </div>
      )}
    </div>
  )
}
