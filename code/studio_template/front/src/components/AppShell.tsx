import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { visibleMenu } from '../lib/menu'
import { BusyButton } from './BusyButton'

const APP_NAME = import.meta.env.VITE_APP_NAME || '專案名'

/**
 * 登入後的外框：側欄選單（依角色）、頂欄使用者名稱與登出。
 * 風格請照管理者工作室設計系統選一套（S1 到 S7），把 styles.css 的 token 換成那一套；元件不寫死顏色。
 */
export function AppShell() {
  const { state, logout } = useAuth()
  const nav = useNavigate()
  if (state.status !== 'user') return null
  const me = state.me
  const items = visibleMenu(me.roles)

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">{APP_NAME}</div>
        <nav aria-label="主選單">
          {items.map((m) => (
            <NavLink key={m.path} to={m.path} end={m.path === '/'} className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
              {m.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="main">
        <header className="topbar">
          <div className="me">
            {me.avatarUrl ? <img className="avatar" src={me.avatarUrl} alt="" /> : <span className="avatar avatar-text">{me.name.slice(0, 1)}</span>}
            <span data-testid="me-name">{me.name}</span>
            <span className="roles">{me.roles.join('、')}</span>
          </div>
          <BusyButton
            busyLabel="登出中…"
            onClick={async () => {
              if (await logout()) nav('/login', { replace: true })
            }}
          >
            登出
          </BusyButton>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
