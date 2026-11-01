/**
 * 示範世界（D3）。
 *
 * 規則：原型、seed、測試、E2E、使用說明、示範影片裡出現的公司、人、客戶、產品、電話、地址、統編，
 * 一律從這裡拿，不可用真實公司、真實品牌或你自己公司的任何資料（資安與法律考量）。
 * 要加新的示範資料就往這裡加；守衛測試會掃原始碼擋 forbidden.ts 的 REAL_DATA_FORBIDDEN 裡的字。
 *
 * 故事：「禾木文具」是一家批發文具與辦公用品的小公司，客戶有補習班和咖啡館。
 * 這個故事夠通俗，任何學生的系統（報價、訂單、庫存、客戶管理、預約）都能套。
 */

export const DEMO_COMPANY = {
  name: '禾木文具有限公司',
  shortName: '禾木文具',
  taxId: '00000000',
  phone: '02-0000-0000',
  address: '台北市示範區範例路 1 號',
  email: 'hello@demo.local',
} as const

/** 示範使用者。mccSub 是 mock 登入用的識別碼（/auth/login?as=<mccSub>）。 */
export const DEMO_USERS = {
  admin: {
    mccSub: 'mock-admin',
    name: '許經理',
    email: 'hsu.manager@demo.local',
    roles: ['admin', 'member'],
  },
  member: {
    mccSub: 'mock-member',
    name: '蔡業務',
    email: 'tsai.sales@demo.local',
    roles: ['member'],
  },
} as const

export type DemoUserKey = keyof typeof DEMO_USERS

export const DEMO_ROLES = [
  { code: 'admin', name: '管理員' },
  { code: 'member', name: '一般成員' },
] as const

export const DEMO_CUSTOMERS = [
  {
    name: '星河文理補習班',
    taxId: '11111111',
    phone: '02-1111-1111',
    address: '新北市示範區學府路 88 號',
    contacts: [
      { name: '周主任', title: '教務主任', phone: '0911-111-111', email: 'chou@xinghe.demo.local' },
      { name: '吳老師', title: '行政老師', phone: '0922-222-222', email: 'wu@xinghe.demo.local' },
    ],
  },
  {
    name: '青田咖啡館',
    taxId: '22222222',
    phone: '04-2222-2222',
    address: '台中市示範區巷弄街 5 號',
    contacts: [{ name: '何店長', title: '店長', phone: '0933-333-333', email: 'ho@qingtian.demo.local' }],
  },
] as const

export const DEMO_PRODUCTS = [
  { sku: 'PAPER-A4', name: 'A4 影印紙 500 張', unit: '包', price: 120 },
  { sku: 'PEN-05K', name: '中性筆 0.5mm 黑', unit: '支', price: 15 },
  { sku: 'FOLDER-A4', name: 'A4 透明資料夾', unit: '個', price: 8 },
  { sku: 'MARKER-B', name: '白板筆 藍', unit: '支', price: 25 },
] as const

/** 真實資料禁字清單放在 forbidden.ts（守衛自我檢查要排除它），這裡只轉出去。 */
export { REAL_DATA_FORBIDDEN } from './forbidden.js'
