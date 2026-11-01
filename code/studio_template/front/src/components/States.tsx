import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Spinner } from './Spinner'

/** 每個畫面都要處理的五種狀態：loading、空白、錯誤、401（RequireAuth 處理）、403。用這裡的元件，文字照 docs/ui-terms.md。 */

export function Loading({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <Spinner size={22} /> <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title = '目前沒有資料', hint, action }: { title?: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="state">
      <p className="state-title">{title}</p>
      {hint && <p className="state-hint">{hint}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ message = '發生錯誤，請再試一次。', onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          再試一次
        </button>
      )}
    </div>
  )
}

export function Forbidden() {
  return (
    <div className="state" role="alert">
      <p className="state-title">你沒有這個功能的使用權限。</p>
      <Link to="/" className="btn">返回首頁</Link>
    </div>
  )
}

export function NotFound() {
  return (
    <div className="state">
      <p className="state-title">找不到這一頁。</p>
      <Link to="/" className="btn">返回首頁</Link>
    </div>
  )
}
