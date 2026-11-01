/**
 * 側欄選單：照原型「功能清單與優先順序」排，roles 寫哪些角色看得到（空陣列＝登入就看得到）。
 * 步 1 把原型的功能清單填進來，每一項先是空頁（pages/_template/Page）；步 3 逐切片換成真的頁。
 * 這裡的 label 要跟 docs/ui-terms.md 與原型同字。
 */
export type MenuItem = { path: string; label: string; roles: string[] }

export const MENU: MenuItem[] = [
  { path: '/', label: '首頁', roles: [] },
  // 範例：{ path: '/customers', label: '客戶管理', roles: ['member'] },
  { path: '/admin', label: '系統管理', roles: ['admin'] },
]

export const visibleMenu = (userRoles: readonly string[]): MenuItem[] =>
  MENU.filter((m) => m.roles.length === 0 || m.roles.some((r) => userRoles.includes(r)))
