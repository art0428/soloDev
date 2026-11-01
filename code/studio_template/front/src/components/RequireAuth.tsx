import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { ErrorState, Forbidden, Loading } from './States'

/**
 * 包住需要登入的區塊：loading 轉圈、沒登入導去 /login（記住原本要去哪）、
 * 連不上伺服器顯示錯誤與重試（不誤判成沒登入）、角色不對顯示 403。
 */
export function RequireAuth({ children, roles }: { children: ReactNode; roles?: string[] }) {
  const { state, reload, hasRole } = useAuth()
  const loc = useLocation()
  if (state.status === 'loading') return <Loading />
  if (state.status === 'error') return <ErrorState message={state.message} onRetry={() => void reload()} />
  if (state.status === 'anon') return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (roles && roles.length && !hasRole(...roles)) return <Forbidden />
  return <>{children}</>
}
