import { useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { Spinner } from './Spinner'

type BusyButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick' | 'onError'> & {
  /** 按下去要做的事，可以是 async。成功才關視窗由呼叫端在這裡面自己判斷。 */
  onClick: () => unknown
  /** 處理中的文字，例如「儲存中…」。只有圖示沒有文字的按鈕不顯示。 */
  busyLabel?: string
  /** 動作丟出沒處理的錯誤時呼叫（沒給就印到 console）；要不要跳提示由呼叫端決定。 */
  onError?: (error: unknown) => void
  icon?: ReactNode
  children?: ReactNode
}

/**
 * 自己管「處理中」的按鈕，做滿處理中四件事的前三件：反灰擋重入、換成 <Spinner />、文字換成「…中」。
 * 第四件「成功才關視窗」寫在 onClick 裡：onClick={async () => { if (await save(form)) close() }}。
 *
 *   <BusyButton busyLabel="儲存中…" onClick={() => save(form)}>儲存</BusyButton>
 *   <BusyButton icon={<TrashIcon />} aria-label="刪除" onClick={() => remove(id)} />   只有圖示：忙碌時只換轉圈
 */
export function BusyButton({
  onClick, busyLabel = '處理中…', onError, icon, children, disabled, className = 'btn', ...buttonProps
}: BusyButtonProps) {
  const [busy, setBusy] = useState(false)
  // 用 ref 擋重入：連點兩下時，第二下可能比重新渲染（按鈕變反灰）還早到
  const running = useRef(false)

  async function run() {
    if (running.current) return
    running.current = true
    setBusy(true)
    try {
      await onClick()
    } catch (error) {
      // async 事件處理器丟的錯沒有人接：不接住的話畫面無聲，看起來像按了沒反應
      ;(onError ?? reportUnhandled)(error)
    } finally {
      running.current = false
      // React 18 起，元件卸載後 setState 什麼都不做，不需要自己記「還掛著沒」。
      // 自己記的話很容易在 StrictMode（effect 跑兩次）把旗標留在 false，按鈕就永遠卡在「…中」。
      setBusy(false)
    }
  }

  const hasText = children !== undefined && children !== null && children !== false
  return (
    <button
      type="button"
      {...buttonProps}
      className={className}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      onClick={() => void run()}
    >
      {busy ? <Spinner /> : icon}
      {hasText && (busy ? busyLabel : children)}
    </button>
  )
}

function reportUnhandled(error: unknown) {
  console.error('BusyButton：按鈕的動作丟出沒有處理的錯誤', error)
}
