import { useAuth } from '../../lib/auth'
import { showInstant } from '../../lib/datetime'

/** 首頁：步 1 只放歡迎與基本資料，步 3 再換成原型的首頁。 */
export function HomePage() {
  const { state } = useAuth()
  if (state.status !== 'user') return null
  const me = state.me
  return (
    <section>
      <div className="h1-row">
        <h1>首頁</h1>
      </div>
      <p>你好，{me.name}。</p>
      <dl className="kv">
        <dt>角色</dt>
        <dd>{me.roles.join('、')}</dd>
        <dt>上次登入</dt>
        <dd>{showInstant(me.lastLoginAtInstant) || '這是第一次'}</dd>
      </dl>
    </section>
  )
}
