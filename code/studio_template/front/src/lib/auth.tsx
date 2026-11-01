/**
 * 登入狀態：啟動時打一次 /api/me。loading → anon（401）或 user（200）。
 * 其他錯誤（網路斷、500）算 error，畫面顯示重試，不要誤判成「沒登入」把人踢去登入頁。
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Me } from '@studio/api-client'
import { api } from './api'

export type AuthState =
  | { status: 'loading' }
  | { status: 'anon' }
  | { status: 'error'; message: string }
  | { status: 'user'; me: Me }

type AuthContextValue = {
  state: AuthState
  reload: () => Promise<void>
  logout: () => Promise<boolean>
  hasRole: (...roles: string[]) => boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading' })

  const reload = useCallback(async () => {
    try {
      const { data, response } = await api.GET('/api/me')
      if (response.status === 401) return setState({ status: 'anon' })
      if (!data) return setState({ status: 'error', message: `伺服器回應 ${response.status}，請再試一次。` })
      setState({ status: 'user', me: data })
    } catch {
      setState({ status: 'error', message: '連不上伺服器，請確認網路後再試一次。' })
    }
  }, [])

  const logout = useCallback(async () => {
    const { response } = await api.POST('/auth/logout')
    if (!response.ok) return false
    setState({ status: 'anon' })
    return true
  }, [])

  useEffect(() => { void reload() }, [reload])

  const value = useMemo<AuthContextValue>(
    () => ({
      state,
      reload,
      logout,
      hasRole: (...roles) => state.status === 'user' && roles.some((r) => state.me.roles.includes(r)),
    }),
    [state, reload, logout],
  )
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const v = useContext(AuthContext)
  if (!v) throw new Error('useAuth 要在 AuthProvider 裡面用')
  return v
}
