/**
 * 守衛測試（掃原始碼擋某種寫法）的共用工具。
 *
 * 每支守衛都要做到三件事（CLAUDE.md 第 5 節）：
 *   1. 掃真的程式樹 → 零違規。
 *   2. 「掃到的檔案數 > N」的防空轉斷言：路徑寫錯掃到空目錄時要紅，不能默默全綠。
 *   3. 塞一行違規進去 → 會紅（用 findViolations 對一段假程式碼驗）。
 *
 * 同一行有 `guard: allow` 這個字樣就放行（寫在註解裡），用在真的例外；每一處例外都要能說出為什麼。
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

export const ALLOW_MARKER = 'guard: allow'

const SKIP_DIRS = new Set(['node_modules', 'dist', 'coverage', '.git', 'test-results', 'playwright-report'])

/** 遞迴列出目錄下符合副檔名的檔案（絕對路徑）。 */
export function listFiles(root: string, opts: { exts: string[]; exclude?: RegExp[] } = { exts: ['.ts', '.tsx'] }): string[] {
  const out: string[] = []
  const walk = (dir: string) => {
    let names: string[]
    try { names = readdirSync(dir) } catch { return }
    for (const n of names) {
      const p = join(dir, n)
      let st
      try { st = statSync(p) } catch { continue }
      if (st.isDirectory()) {
        if (!SKIP_DIRS.has(n)) walk(p)
        continue
      }
      if (!opts.exts.some((e) => n.endsWith(e))) continue
      const rel = relative(root, p)
      if (opts.exclude?.some((re) => re.test(rel) || re.test(p))) continue
      out.push(p)
    }
  }
  walk(root)
  return out.sort()
}

export type SourceFile = { path: string; text: string }

export const readFiles = (paths: string[]): SourceFile[] => paths.map((p) => ({ path: p, text: readFileSync(p, 'utf8') }))

/**
 * 去掉註解（/* *\/ 區塊、// 行尾、JSX 的 {/* *\/}），保留行數不變，違規行號才對得上。
 * `//` 只在前面不是 `:` 時才當註解（避免把 http:// 切掉）。
 */
export function stripComments(src: string): string {
  let out = ''
  let i = 0
  let quote: string | null = null
  while (i < src.length) {
    const c = src[i]!
    const next = src[i + 1]
    if (quote) {
      out += c
      if (c === '\\') { out += next ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i++
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; out += c; i++; continue }
    if (c === '/' && next === '*') {
      const end = src.indexOf('*/', i + 2)
      const stop = end === -1 ? src.length : end + 2
      out += src.slice(i, stop).replace(/[^\n]/g, ' ')
      i = stop
      continue
    }
    if (c === '/' && next === '/' && src[i - 1] !== ':') {
      const end = src.indexOf('\n', i)
      const stop = end === -1 ? src.length : end
      out += ' '.repeat(stop - i)
      i = stop
      continue
    }
    out += c
    i++
  }
  return out
}

export type Violation = { path: string; line: number; rule: string; text: string }

export type Rule = { name: string; re: RegExp; /** 只掃這些檔（相對路徑或絕對路徑的 regex） */ only?: RegExp }

/** 逐行找違規；同一行含 ALLOW_MARKER（看原文，不看去註解後的）就放行。 */
export function findViolations(files: SourceFile[], rules: Rule[], opts: { stripComments?: boolean } = {}): Violation[] {
  const out: Violation[] = []
  for (const f of files) {
    const rawLines = f.text.split('\n')
    const lines = (opts.stripComments === false ? f.text : stripComments(f.text)).split('\n')
    lines.forEach((line, idx) => {
      if (rawLines[idx]?.includes(ALLOW_MARKER)) return
      for (const r of rules) {
        if (r.only && !r.only.test(f.path)) continue
        const re = new RegExp(r.re.source, r.re.flags.replace('g', ''))
        if (re.test(line)) out.push({ path: f.path, line: idx + 1, rule: r.name, text: line.trim() })
      }
    })
  }
  return out
}

export const formatViolations = (vs: Violation[], root?: string): string =>
  vs.map((v) => `${root ? relative(root, v.path) : v.path}:${v.line}  [${v.rule}]  ${v.text}`).join('\n')

const CJK = /[㐀-鿿豈-﫿]/

/**
 * 抓出含中文的「字串」：單引號、雙引號、樣板字串、JSX 文字節點。只看這些就不會誤掃識別字與英文常數。
 * 回傳每一段的行號與內容（去註解後）。
 */
export function cjkStrings(src: string): { line: number; text: string }[] {
  const s = stripComments(src)
  const out: { line: number; text: string }[] = []
  const lineOf = (pos: number) => s.slice(0, pos).split('\n').length
  const strRe = /(['"`])((?:\\.|(?!\1)[^\\\n])*)\1/g
  let m: RegExpExecArray | null
  while ((m = strRe.exec(s))) if (CJK.test(m[2]!)) out.push({ line: lineOf(m.index), text: m[2]! })
  // JSX 文字：> 與 < 之間、不含 { } 的片段
  const jsxRe = />([^<>{}]*[㐀-鿿豈-﫿][^<>{}]*)</g
  while ((m = jsxRe.exec(s))) out.push({ line: lineOf(m.index), text: m[1]!.trim() })
  return out
}

/**
 * 讀 docs/ui-terms.md，取出所有表格「不要用」欄的中文詞。
 * 解析規則：以「、」分開；去掉全形括號裡的補充；去掉結尾的「…」；只留至少兩個中文字的詞；「—」「無」不算。
 */
export function parseForbiddenTerms(md: string): string[] {
  const terms = new Set<string>()
  const lines = md.split('\n')
  let col = -1
  for (const line of lines) {
    if (!line.trim().startsWith('|')) { col = -1; continue }
    const cells = line.split('|').slice(1, -1).map((c) => c.trim())
    if (col === -1) {
      col = cells.findIndex((c) => c === '不要用')
      continue
    }
    if (cells.every((c) => /^-+$/.test(c))) continue
    const cell = cells[col]
    if (!cell) continue
    for (let t of cell.split(/[、，,]/)) {
      t = t.replace(/（[^）]*）/g, '').replace(/\([^)]*\)/g, '').replace(/…+$/, '').replace(/~~/g, '').trim()
      if (!t || t === '—' || t === '無') continue
      const cjkCount = (t.match(/[㐀-鿿豈-﫿]/g) ?? []).length
      if (cjkCount < 2) continue
      terms.add(t)
    }
  }
  return [...terms].sort()
}

/** 在含中文的字串裡找詞表的詞。marker 行放行。 */
export function findForbiddenTerms(files: SourceFile[], terms: string[]): Violation[] {
  const out: Violation[] = []
  for (const f of files) {
    const rawLines = f.text.split('\n')
    for (const s of cjkStrings(f.text)) {
      if (rawLines[s.line - 1]?.includes(ALLOW_MARKER)) continue
      for (const t of terms) if (s.text.includes(t)) out.push({ path: f.path, line: s.line, rule: `ui-terms:${t}`, text: s.text })
    }
  }
  return out
}
