import type { CSSProperties } from 'react'

type SpinnerProps = { size?: number; className?: string; style?: CSSProperties }

/**
 * 全站唯一的「處理中」轉圈（dev-guidelines 4.6）。純 CSS 圓環（styles.css 的 .spin），顏色跟著 currentColor：
 * 放在主色按鈕上是白的、放在文字旁就是文字色。要表示忙碌一律用它；圖示字型裡的 loading 字符是靜止的，不要用。
 * size 是直徑（px），預設 15 配 14px 內文；24 以上圓環加粗一級。
 */
export function Spinner({ size = 15, className, style }: SpinnerProps) {
  const classes = ['spin', className].filter(Boolean).join(' ')
  const ring = size >= 24 ? 3 : 2
  return <span role="status" aria-label="處理中" className={classes} style={{ width: size, height: size, borderWidth: ring, ...style }} />
}
