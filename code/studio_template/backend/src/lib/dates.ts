/**
 * 後端唯一的日期與時間工具（dev-guidelines 4.7）。別處不准自己算時區；要新函式就加在這裡並補測試。
 *
 * 系統裡的兩種時間：
 *  ・事件時刻（建立、送出、登入）：時間軸上的一個點。存 Prisma DateTime（UTC），API 回 ISO 8601、欄位名 xxxAtInstant，
 *    由前端依觀看者時區顯示。後端不把它格式化成字串存起來。
 *  ・業務日期（單號、報價日、到期日、統計分組）：帳面上的日曆日。用 BUSINESS_TZ 算成 YYYY-MM-DD 純字串，誰看都一樣。
 *
 * 不用機器時鐘的 getHours() 這類函式做業務判斷（那是執行機器的時區）；不用固定 +8（有日光節約時間的地區一年錯兩次），
 * 時區一律寫 IANA 名稱，例 Asia/Taipei。
 */

/** 業務時區，從環境變數讀，沒設就是台北。每支函式都收 tz 參數，日後改成讀各公司的設定也不用改呼叫端。 */
export const BUSINESS_TZ: string = process.env.BUSINESS_TZ || 'Asia/Taipei'

const DAY_MS = 24 * 60 * 60 * 1000
const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

type WallClock = { y: number; mo: number; d: number; h: number; mi: number; s: number }

/** 某個時刻在 tz 的牆上時間。hourCycle 用 h23，午夜才會是 0 點而不是 24 點。 */
function wallClockOf(instant: Date, tz: string): WallClock {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(instant)
  const num = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? Number.NaN)
  return { y: num('year'), mo: num('month'), d: num('day'), h: num('hour'), mi: num('minute'), s: num('second') }
}

const two = (n: number) => n.toString().padStart(2, '0')

/** 年月日寫成 YYYY-MM-DD。月可以超出 1–12、日可以超出當月，交給 Date.UTC 進位。 */
function dayString(y: number, mo: number, d: number): string {
  const t = new Date(Date.UTC(y, mo - 1, d))
  return [t.getUTCFullYear(), two(t.getUTCMonth() + 1), two(t.getUTCDate())].join('-')
}

function parseDay(day: string): { y: number; mo: number; d: number } {
  const m = DAY_PATTERN.exec(day)
  if (m === null) throw new Error(`日期要是 YYYY-MM-DD，收到「${day}」`)
  return { y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) }
}

/** 某個時刻落在 tz 的哪一個日曆日。 */
export function businessDayOf(instant: Date, tz: string = BUSINESS_TZ): string {
  const w = wallClockOf(instant, tz)
  return dayString(w.y, w.mo, w.d)
}

/** 業務上的「今天」。測試要今天也用這支（凍結時鐘），不要自己 new Date().getDate()。 */
export function businessToday(tz: string = BUSINESS_TZ, now: Date = new Date()): string {
  return businessDayOf(now, tz)
}

/** 某個時刻在 tz 的「YYYY-MM-DD HH:mm」。只給凍結的文件與 log 用，不存進資料庫。 */
export function formatStamp(instant: Date, tz: string = BUSINESS_TZ): string {
  const w = wallClockOf(instant, tz)
  return `${dayString(w.y, w.mo, w.d)} ${two(w.h)}:${two(w.mi)}`
}

const ZONE_NAMES: Readonly<Record<string, string>> = { 'Asia/Taipei': '台北時間' }

/** 給人看的時區標示，例「台北時間 GMT+8」。凍結的文件（PDF、Email）一定要標時區。 */
export function timeZoneLabel(tz: string = BUSINESS_TZ, at: Date = new Date()): string {
  const name = ZONE_NAMES[tz] ?? tz
  let offset: string | undefined
  try {
    offset = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
      .formatToParts(at)
      .find((part) => part.type === 'timeZoneName')?.value
  } catch {
    offset = undefined
  }
  return offset ? `${name} ${offset}` : name
}

/** 日曆日期加減 N 天。在日期上算、不經過時刻，日光節約時間影響不到。 */
export function shiftDays(day: string, n: number): string {
  const { y, mo, d } = parseDay(day)
  return dayString(y, mo, d + n)
}

/** 日曆日期加減 N 個月。目標月份沒有那一天就取月底（1/31 加一個月是 2/28）。 */
export function shiftMonths(day: string, n: number): string {
  const { y, mo, d } = parseDay(day)
  const daysInTarget = new Date(Date.UTC(y, mo + n, 0)).getUTCDate()
  return dayString(y, mo + n, Math.min(d, daysInTarget))
}

/** 兩個日曆日期差幾天（to − from）。「N 天」一律是日曆天，不是滿 24 小時。 */
export function daysBetween(from: string, to: string): number {
  const midnight = (day: string) => {
    const { y, mo, d } = parseDay(day)
    return Date.UTC(y, mo - 1, d)
  }
  return Math.round((midnight(to) - midnight(from)) / DAY_MS)
}

/**
 * 把 tz 的牆上時間換成真實時刻。local 寫成 '2026-11-01T08:30:00.000'，不帶時區標記；不要自己寫 new Date(local + '+08:00')。
 * 做法：先把牆上時間當成 UTC 猜一次，看猜到的時刻在 tz 顯示成幾點，差多少修多少。修兩輪，日光節約時間交界也對。
 */
export function wallClockToInstant(local: string, tz: string = BUSINESS_TZ): Date {
  const wanted = Date.parse(`${local}Z`)
  if (Number.isNaN(wanted)) throw new Error(`時間要是 YYYY-MM-DDTHH:mm:ss.sss，收到「${local}」`)
  const shownAs = (t: number) => {
    const w = wallClockOf(new Date(t), tz)
    return Date.UTC(w.y, w.mo - 1, w.d, w.h, w.mi, w.s) + new Date(t).getUTCMilliseconds()
  }
  let guess = wanted
  for (let round = 0; round < 2; round++) guess += wanted - shownAs(guess)
  return new Date(guess)
}

/**
 * 業務日期當天在資料庫裡的時間範圍，半開區間：`createdAt >= start AND createdAt < next`。
 * 用下一天的零點當上限，不用 23:59:59.999，毫秒精度不同的資料庫也不會漏。
 */
export function dayRange(day: string, tz: string = BUSINESS_TZ): { start: Date; next: Date } {
  return {
    start: wallClockToInstant(`${day}T00:00:00.000`, tz),
    next: wallClockToInstant(`${shiftDays(day, 1)}T00:00:00.000`, tz),
  }
}
