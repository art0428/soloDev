/**
 * 前台唯一的時間工具（dev-guidelines 4.7）。
 *  ・事件時刻（API 的 xxxAtInstant，ISO 8601）：依「觀看者所在時區」顯示，用 showInstant。
 *  ・業務日期（API 的 YYYY-MM-DD）：原樣顯示、不換算；要「今天」用 businessToday（業務時區），不要 new Date().getDate()。
 * 不要用 slice(0, 10) 切 ISO 字串當日期：切出來的是 UTC 日，台北晚上 8 點以後會差一天。
 */

/** 業務時區。登入頁從後端 /health 拿到後設定；拿不到就用預設，絕不退回瀏覽器時區。 */
let businessZone = 'Asia/Taipei'

export function configureBusinessTz(tz: string | null | undefined): void {
  if (tz) businessZone = tz
}

export const currentBusinessTz = (): string => businessZone

/** 觀看者的時區。測試一律明確傳 tz，不要依賴執行環境。 */
export function viewerTimeZone(): string {
  return new Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

const formatterCache = new Map<string, Intl.DateTimeFormat>()

/** 時刻在 tz 的日期「YYYY-MM-DD」與時間「HH:mm」。 */
function clockParts(instant: Date, tz: string): { date: string; time: string } {
  let formatter = formatterCache.get(tz)
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
    })
    formatterCache.set(tz, formatter)
  }
  const parts = formatter.formatToParts(instant)
  const field = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '00'
  return { date: `${field('year')}-${field('month')}-${field('day')}`, time: `${field('hour')}:${field('minute')}` }
}

function parseInstant(iso: string | null | undefined): Date | null {
  if (!iso) return null
  const instant = new Date(iso)
  return Number.isNaN(instant.getTime()) ? null : instant
}

/** 事件時刻 → 「2026-11-01 14:30」（觀看者時區）。null、空字串、壞字串都回空字串，不丟錯。 */
export function showInstant(iso: string | null | undefined, tz: string = viewerTimeZone()): string {
  const instant = parseInstant(iso)
  if (!instant) return ''
  const { date, time } = clockParts(instant, tz)
  return `${date} ${time}`
}

/** 事件時刻 → 只有日期「2026-11-01」（觀看者時區），清單欄位用。 */
export function showInstantDay(iso: string | null | undefined, tz: string = viewerTimeZone()): string {
  const instant = parseInstant(iso)
  return instant ? clockParts(instant, tz).date : ''
}

/** 業務上的今天（業務時區）。測試傳 now 與 tz。 */
export function businessToday(now: Date = new Date(), tz: string = businessZone): string {
  return clockParts(now, tz).date
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

/** 業務日期當作 UTC 午夜的 Date，只拿來做日曆運算。 */
function dayAsUtc(day: string): Date {
  const m = DAY_PATTERN.exec(day)
  if (!m) throw new Error(`日期要是 YYYY-MM-DD，收到「${day}」`)
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
}

const two = (n: number) => n.toString().padStart(2, '0')
const utcDayString = (t: Date) => `${t.getUTCFullYear()}-${two(t.getUTCMonth() + 1)}-${two(t.getUTCDate())}`

/** 業務日期加減天（在日期上算）。 */
export function shiftDays(day: string, n: number): string {
  return utcDayString(new Date(dayAsUtc(day).getTime() + n * DAY_MS))
}

/** 兩個業務日期差幾個日曆天（to − from）。 */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayAsUtc(to).getTime() - dayAsUtc(from).getTime()) / DAY_MS)
}

const WEEKDAYS = '日一二三四五六'

/** 業務日期 → 「11/01（週日）」。星期用日期本身算，不碰時區。 */
export function showBusinessDate(day: string): string {
  const t = dayAsUtc(day)
  return `${two(t.getUTCMonth() + 1)}/${two(t.getUTCDate())}（週${WEEKDAYS.charAt(t.getUTCDay())}）`
}
