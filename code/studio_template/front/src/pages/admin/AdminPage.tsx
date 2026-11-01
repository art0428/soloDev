import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { EmptyState, ErrorState, Loading } from '../../components/States'

/**
 * 管理員頁的示範：打 /api/admin/ping，示範一個畫面怎麼處理 loading、錯誤、有資料。
 * 步 3 把它換成原型的系統管理頁。
 */
export function AdminPage() {
  const [state, setState] = useState<{ status: 'loading' } | { status: 'error'; message: string } | { status: 'ok' }>({ status: 'loading' })

  const load = () => {
    setState({ status: 'loading' })
    api.GET('/api/admin/ping').then(({ data, response }) => {
      if (data?.ok) setState({ status: 'ok' })
      else setState({ status: 'error', message: `伺服器回應 ${response.status}，請再試一次。` })
    }).catch(() => setState({ status: 'error', message: '連不上伺服器，請確認網路後再試一次。' }))
  }
  useEffect(load, [])

  return (
    <section>
      <div className="h1-row">
        <h1>系統管理</h1>
      </div>
      {state.status === 'loading' && <Loading />}
      {state.status === 'error' && <ErrorState message={state.message} onRetry={load} />}
      {state.status === 'ok' && <EmptyState title="管理員權限確認成功。" hint="這一頁還沒有功能，步 3 會照原型補上。" />}
    </section>
  )
}
