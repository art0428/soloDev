/**
 * 掛載煙霧測試範本（CLAUDE.md 第 5 節：每個畫面一條）。
 * 把畫面從「空資料」到「有資料」完整渲染一輪，含 null → 有值的轉換；hook 放錯位置、拿 undefined 的欄位這裡就會紅。
 * 複製到自己的頁面後：改 render 的元件、用 MSW 給空清單再給有資料的清單、斷言兩種狀態都畫得出來。
 */
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { Page } from './Page'

describe('空頁範本', () => {
  it('掛載得起來、標題與空狀態文字都在', () => {
    render(
      <MemoryRouter>
        <Page title="客戶管理" />
      </MemoryRouter>,
    )
    expect(screen.getByRole('heading', { level: 1, name: '客戶管理' })).toBeInTheDocument()
    expect(screen.getByText('這一頁還沒有內容。')).toBeInTheDocument()
  })
})
