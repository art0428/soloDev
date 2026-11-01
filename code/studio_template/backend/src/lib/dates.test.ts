/**
 * 時間函式一律凍結時鐘、斷言確切值（dev-guidelines 4.7「測試怎麼寫才抓得到」），只驗格式抓不到時區錯誤。
 * 一定要驗：台北跨日（UTC 16:00 前後）、跨月跨年、午夜、日光節約時間交界。
 * 測試環境的 TZ 是 UTC（run-tests.sh 與 vitest.config.ts 釘的），業務時區是 Asia/Taipei，兩者刻意不同。
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  BUSINESS_TZ, businessDayOf, businessToday, dayRange, daysBetween, formatStamp, shiftDays, shiftMonths,
  timeZoneLabel, wallClockToInstant,
} from './dates.js'

describe('businessDayOf、businessToday：業務日期看 BUSINESS_TZ，不看機器時鐘', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('UTC 3/31 15:59:59 在台北還是 3/31；16:00:00 就是 4/1（跨日也跨月）', () => {
    expect(businessDayOf(new Date('2026-03-31T15:59:59Z'), 'Asia/Taipei')).toBe('2026-03-31')
    expect(businessDayOf(new Date('2026-03-31T16:00:00Z'), 'Asia/Taipei')).toBe('2026-04-01')
  })

  it('同一個時刻在三個時區是三種結果', () => {
    const newYearEve = new Date('2026-12-31T20:00:00Z')
    expect(businessDayOf(newYearEve, 'Asia/Taipei')).toBe('2027-01-01')
    expect(businessDayOf(newYearEve, 'America/Los_Angeles')).toBe('2026-12-31')
    expect(businessDayOf(newYearEve, 'UTC')).toBe('2026-12-31')
  })

  it('凍結時鐘在 UTC 11/01 17:00（台北 11/02 凌晨 1 點），今天要是台北的 11/02', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-01T17:00:00Z'))
    expect(BUSINESS_TZ).toBe('Asia/Taipei')
    expect(businessToday()).toBe('2026-11-02')
    expect(businessToday('UTC')).toBe('2026-11-01')
  })
})

describe('formatStamp：午夜寫 00:00，不寫 24:00', () => {
  it('UTC 16:00 是台北隔天 00:00，UTC 15:59 是當天 23:59', () => {
    expect(formatStamp(new Date('2026-11-01T16:00:00Z'), 'Asia/Taipei')).toBe('2026-11-02 00:00')
    expect(formatStamp(new Date('2026-11-01T15:59:00Z'), 'Asia/Taipei')).toBe('2026-11-01 23:59')
  })
})

describe('日曆日期的加減在日期上做', () => {
  it('shiftDays 跨月、跨年、閏年、往回', () => {
    expect(shiftDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(shiftDays('2026-12-31', 2)).toBe('2027-01-02')
    expect(shiftDays('2028-02-28', 1)).toBe('2028-02-29')
    expect(shiftDays('2026-03-01', -2)).toBe('2026-02-27')
  })

  it('shiftMonths 目標月份沒有那一天就取月底', () => {
    expect(shiftMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(shiftMonths('2026-11-30', 3)).toBe('2027-02-28')
    expect(shiftMonths('2026-03-15', -1)).toBe('2026-02-15')
  })

  it('daysBetween 算日曆天，可以是負的', () => {
    expect(daysBetween('2026-11-01', '2026-11-01')).toBe(0)
    expect(daysBetween('2026-11-01', '2026-12-01')).toBe(30)
    expect(daysBetween('2026-12-01', '2026-11-01')).toBe(-30)
  })

  it('格式不對直接丟錯，不默默算錯', () => {
    expect(() => shiftDays('2026/11/01', 1)).toThrow('YYYY-MM-DD')
    expect(() => daysBetween('2026-11-1', '2026-11-02')).toThrow()
  })
})

describe('牆上時間與資料庫查詢範圍', () => {
  it('台北 08:30 是 UTC 00:30', () => {
    expect(wallClockToInstant('2026-11-01T08:30:00.000', 'Asia/Taipei').toISOString()).toBe('2026-11-01T00:30:00.000Z')
  })

  it('dayRange 是半開區間：台北 11/01 從 UTC 10/31 16:00 到 11/01 16:00（不含）', () => {
    const { start, next } = dayRange('2026-11-01', 'Asia/Taipei')
    expect(start.toISOString()).toBe('2026-10-31T16:00:00.000Z')
    expect(next.toISOString()).toBe('2026-11-01T16:00:00.000Z')
  })

  it('日光節約時間：洛杉磯 2026-03-08 只有 23 小時，前後兩天的零點偏移不同', () => {
    expect(dayRange('2026-03-07', 'America/Los_Angeles').start.toISOString()).toBe('2026-03-07T08:00:00.000Z')
    const { start, next } = dayRange('2026-03-08', 'America/Los_Angeles')
    expect(start.toISOString()).toBe('2026-03-08T08:00:00.000Z')
    expect(next.toISOString()).toBe('2026-03-09T07:00:00.000Z')
    expect((next.getTime() - start.getTime()) / 3_600_000).toBe(23)
  })

  it('不是牆上時間的字串直接丟錯', () => {
    expect(() => wallClockToInstant('明天早上', 'Asia/Taipei')).toThrow()
  })
})

describe('timeZoneLabel', () => {
  it('台北有中文名加偏移', () => {
    expect(timeZoneLabel('Asia/Taipei', new Date('2026-11-01T00:00:00Z'))).toBe('台北時間 GMT+8')
  })
  it('沒有中文名的時區用 IANA 名稱開頭', () => {
    expect(timeZoneLabel('Europe/London', new Date('2026-07-01T00:00:00Z'))).toBe('Europe/London GMT+1')
  })
})
