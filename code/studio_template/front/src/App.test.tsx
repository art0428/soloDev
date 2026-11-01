/**
 * 整個 App 的掛載測試：沒登入 → 登入頁；管理員 → 外框、選單含系統管理；一般成員 → 沒有系統管理、直連 /admin 看到 403。
 * 互動（登出）用 user-event，照真人順序走。
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import App from './App'
import { adminMe, handlers, memberMe, server } from './test/msw'

const renderAt = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('App', () => {
  it('沒登入：導去登入頁，mock 模式顯示兩顆假登入按鈕', async () => {
    server.use(handlers.meAs(null), handlers.health('mock'))
    renderAt('/')
    expect(await screen.findByTestId('mock-login')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /許經理（管理員）登入/ })).toHaveAttribute('href', '/auth/login?as=mock-admin')
    expect(screen.getByRole('link', { name: /蔡業務（一般成員）登入/ })).toHaveAttribute('href', '/auth/login?as=mock-member')
  })

  it('沒登入：mcc 模式只有一顆登入', async () => {
    server.use(handlers.meAs(null), handlers.health('mcc'))
    renderAt('/')
    expect(await screen.findByRole('link', { name: '登入' })).toHaveAttribute('href', '/auth/login')
    expect(screen.queryByTestId('mock-login')).not.toBeInTheDocument()
  })

  it('管理員：看到名字、選單含系統管理、首頁顯示上次登入（依觀看者時區，測試是 UTC）', async () => {
    server.use(handlers.meAs(adminMe), handlers.health())
    renderAt('/')
    expect(await screen.findByTestId('me-name')).toHaveTextContent('許經理')
    expect(screen.getByRole('link', { name: '系統管理' })).toBeInTheDocument()
    expect(screen.getByText('2026-11-01 08:30')).toBeInTheDocument()
  })

  it('一般成員：選單沒有系統管理；直接打 /admin 看到 403 文字', async () => {
    server.use(handlers.meAs(memberMe), handlers.health())
    renderAt('/admin')
    expect(await screen.findByTestId('me-name')).toHaveTextContent('蔡業務')
    expect(screen.queryByRole('link', { name: '系統管理' })).not.toBeInTheDocument()
    expect(screen.getByText('你沒有這個功能的使用權限。')).toBeInTheDocument()
  })

  it('管理員進 /admin：loading → 權限確認成功', async () => {
    server.use(handlers.meAs(adminMe), handlers.health(), handlers.adminPing(true))
    renderAt('/admin')
    expect(await screen.findByText('管理員權限確認成功。')).toBeInTheDocument()
  })

  it('登出：按鈕變「登出中…」並反灰，成功後回登入頁', async () => {
    server.use(handlers.meAs(adminMe), handlers.health('mock'), handlers.logout())
    renderAt('/')
    const user = userEvent.setup()
    const btn = await screen.findByRole('button', { name: '登出' })
    await user.click(btn)
    await waitFor(() => expect(screen.getByTestId('mock-login')).toBeInTheDocument())
  })

  it('連不上伺服器：顯示錯誤與再試一次，不把人踢去登入頁', async () => {
    server.use(handlers.health())
    // 沒有 /api/me 的 handler，MSW 設定 onUnhandledRequest: error → fetch 丟錯 → error 狀態
    renderAt('/')
    expect(await screen.findByRole('alert')).toHaveTextContent('連不上伺服器')
    expect(screen.getByRole('button', { name: '再試一次' })).toBeInTheDocument()
    expect(screen.queryByTestId('mock-login')).not.toBeInTheDocument()
  })

  it('不存在的路徑（已登入）顯示找不到這一頁', async () => {
    server.use(handlers.meAs(adminMe), handlers.health())
    renderAt('/nope')
    expect(await screen.findByText('找不到這一頁。')).toBeInTheDocument()
  })
})
