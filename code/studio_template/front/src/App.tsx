import { Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './lib/auth'
import { MENU } from './lib/menu'
import { AppShell } from './components/AppShell'
import { RequireAuth } from './components/RequireAuth'
import { NotFound } from './components/States'
import { LoginPage } from './pages/login/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { AdminPage } from './pages/admin/AdminPage'
import { Page } from './pages/_template/Page'

/**
 * 路由表。每個選單項目（lib/menu.ts）對應一條路由；步 1 先讓每一項點得進空頁，步 3 再逐切片填內容。
 * 需要角色的頁用 RequireAuth 的 roles 包起來：沒登入導去 /login，登入了但角色不對顯示 403。
 */
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<HomePage />} />
          {MENU.filter((m) => m.path !== '/' && m.path !== '/admin').map((m) => (
            <Route key={m.path} path={m.path} element={<Page title={m.label} />} />
          ))}
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['admin']}>
                <AdminPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
