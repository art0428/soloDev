/** 時區函式一律傳明確的時區、斷言確切值，並驗跨日邊界。測試環境的 TZ 是 UTC。 */
import { describe, expect, it } from 'vitest'
import {
  businessToday, configureBusinessTz, currentBusinessTz, daysBetween, shiftDays, showBusinessDate, showInstant, showInstantDay,
} from './datetime'

describe('showInstant：事件時刻依觀看者時區顯示', () => {
  const lateNightUtc = '2026-11-01T16:30:00.000Z'

  it('同一個時刻：台北是隔天 00:30、洛杉磯 08:30、UTC 原樣', () => {
    expect(showInstant(lateNightUtc, 'Asia/Taipei')).toBe('2026-11-02 00:30')
    // 洛杉磯 2026-11-01 09:00Z 結束夏令時間：16:30Z 已是 UTC-8；前一天同一時刻還是 UTC-7，所以是 09:30
    expect(showInstant(lateNightUtc, 'America/Los_Angeles')).toBe('2026-11-01 08:30')
    expect(showInstant('2026-10-31T16:30:00.000Z', 'America/Los_Angeles')).toBe('2026-10-31 09:30')
    expect(showInstant(lateNightUtc, 'UTC')).toBe('2026-11-01 16:30')
  })

  it('showInstantDay 是觀看者的日曆日，不是切字串得到的 UTC 日', () => {
    expect(showInstantDay(lateNightUtc, 'Asia/Taipei')).toBe('2026-11-02')
    expect(lateNightUtc.slice(0, 10)).toBe('2026-11-01') // guard: allow（刻意示範錯的切法會得到 UTC 日）
  })

  it('null、空字串、壞字串都回空字串，不丟錯', () => {
    expect(showInstant(null)).toBe('')
    expect(showInstant(undefined)).toBe('')
    expect(showInstant('')).toBe('')
    expect(showInstant('昨天', 'UTC')).toBe('')
    expect(showInstantDay('昨天', 'UTC')).toBe('')
  })
})

describe('businessToday：業務日期看業務時區，不看瀏覽器', () => {
  it('UTC 11/01 17:00 在台北已經是 11/02', () => {
    const now = new Date('2026-11-01T17:00:00Z')
    expect(businessToday(now, 'Asia/Taipei')).toBe('2026-11-02')
    expect(businessToday(now, 'UTC')).toBe('2026-11-01')
  })

  it('configureBusinessTz 之後預設跟著變；給空值不改', () => {
    const before = currentBusinessTz()
    configureBusinessTz('Asia/Tokyo')
    expect(businessToday(new Date('2026-11-01T15:30:00Z'))).toBe('2026-11-02')
    configureBusinessTz('')
    expect(currentBusinessTz()).toBe('Asia/Tokyo')
    configureBusinessTz(before)
  })
})

describe('日曆日期運算', () => {
  it('shiftDays 跨月、跨年', () => {
    expect(shiftDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31')
  })
  it('daysBetween', () => {
    expect(daysBetween('2026-11-01', '2026-11-08')).toBe(7)
    expect(daysBetween('2026-11-08', '2026-11-01')).toBe(-7)
  })
  it('showBusinessDate 的星期用日期本身算', () => {
    expect(showBusinessDate('2026-11-01')).toBe('11/01（週日）')
    expect(showBusinessDate('2026-11-07')).toBe('11/07（週六）')
  })
  it('格式錯直接丟錯', () => {
    expect(() => shiftDays('2026-1-1', 1)).toThrow('YYYY-MM-DD')
  })
})
