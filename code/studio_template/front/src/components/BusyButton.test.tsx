import { StrictMode } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { BusyButton } from './BusyButton'

const deferred = () => {
  let resolve!: (v?: unknown) => void
  const promise = new Promise((r) => { resolve = r })
  return { promise, resolve }
}

describe('BusyButton：處理中四件事', () => {
  it('按下去反灰、文字換成 busyLabel、出現轉圈；完成後復原', async () => {
    const d = deferred()
    render(<BusyButton busyLabel="儲存中…" onClick={() => d.promise}>儲存</BusyButton>)
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: '儲存' })
    await user.click(btn)
    expect(btn).toBeDisabled()
    expect(btn).toHaveTextContent('儲存中…')
    expect(screen.getByRole('status', { name: '處理中' })).toBeInTheDocument()
    d.resolve()
    await waitFor(() => expect(btn).not.toBeDisabled())
    expect(btn).toHaveTextContent('儲存')
  })

  it('處理中再按不會重複觸發', async () => {
    const d = deferred()
    const onClick = vi.fn(() => d.promise)
    render(<BusyButton onClick={onClick}>送出</BusyButton>)
    const user = userEvent.setup()
    const btn = screen.getByRole('button')
    await user.click(btn)
    await user.click(btn)
    await user.click(btn)
    expect(onClick).toHaveBeenCalledTimes(1)
    d.resolve()
    await waitFor(() => expect(btn).not.toBeDisabled())
  })

  it('只有圖示沒文字的按鈕：忙碌時只換轉圈、不塞文字', async () => {
    const d = deferred()
    render(<BusyButton aria-label="刪除" icon={<span data-testid="icon">x</span>} onClick={() => d.promise} />)
    const user = userEvent.setup()
    const btn = screen.getByRole('button', { name: '刪除' })
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    await user.click(btn)
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument()
    expect(btn).not.toHaveTextContent('處理中')
    d.resolve()
    await waitFor(() => expect(screen.getByTestId('icon')).toBeInTheDocument())
  })

  it('動作丟錯：復原按鈕並叫 onError，不會卡在處理中', async () => {
    const onError = vi.fn()
    render(<BusyButton onClick={async () => { throw new Error('boom') }} onError={onError}>存</BusyButton>)
    const user = userEvent.setup()
    const btn = screen.getByRole('button')
    await user.click(btn)
    await waitFor(() => expect(btn).not.toBeDisabled())
    expect(onError).toHaveBeenCalledWith(expect.any(Error))
  })

  it('StrictMode（effect 跑兩次）下完成後仍會復原，不會永遠卡在「…中」', async () => {
    // 這題擋的是「自己記元件還掛著沒、卻沒在 effect 裡設回 true」的寫法：StrictMode 下旗標會停在 false，按鈕永遠卡在「…中」。
    const d = deferred()
    render(
      <StrictMode>
        <BusyButton busyLabel="儲存中…" onClick={() => d.promise}>儲存</BusyButton>
      </StrictMode>,
    )
    const user = userEvent.setup()
    const btn = screen.getByRole('button')
    await user.click(btn)
    expect(btn).toHaveTextContent('儲存中…')
    d.resolve()
    await waitFor(() => expect(btn).toHaveTextContent('儲存'))
    expect(btn).not.toBeDisabled()
  })
})
