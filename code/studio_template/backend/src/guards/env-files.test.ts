/**
 * 守衛：環境變數名單只有一份事實（backend/src/lib/env.ts 的 schema），其他地方都要跟它對得上：
 *   backend/.env.example（本機）、deploy/env/.env.prod.example（正式）、deploy/Dockerfile.backend 的 ENV、
 *   front/.env.example 與正式清單的 [build] 段、deploy/部署說明.md 的 --set-secrets。
 * 少一個的後果：本機能跑、正式機漏設，啟動時才爆，或更糟，吃到預設值默默跑錯。
 */
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { ROOT } from './_paths.js'

const read = (p: string) => readFileSync(`${ROOT}${p}`, 'utf8')

/** env.ts 的 z.object({ ... }) 裡每一行開頭的大寫鍵 */
export function schemaKeys(envTs: string): string[] {
  const block = /z\.object\(\{([\s\S]*?)\n\}\)/.exec(envTs)?.[1] ?? ''
  return [...block.matchAll(/^\s+([A-Z][A-Z0-9_]*):/gm)].map((m) => m[1] ?? '')
}

/** .env 範本的鍵（註解行不算）；遇到「# [段名]」就換段 */
export function envFileKeys(text: string): { all: string[]; sections: Record<string, string[]> } {
  const sections: Record<string, string[]> = {}
  const all: string[] = []
  let cur: string[] | null = null
  for (const line of text.split('\n')) {
    const sec = /^#\s*\[(\w+)\]\s*$/.exec(line)?.[1]
    if (sec) { cur = sections[sec] = []; continue }
    const key = /^([A-Z][A-Z0-9_]*)=/.exec(line)?.[1]
    if (!key) continue
    all.push(key)
    cur?.push(key)
  }
  return { all, sections }
}

export const dockerfileEnvKeys = (text: string) => [...text.matchAll(/^ENV\s+([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1] ?? '')

const minus = (a: readonly string[], b: readonly string[]) => a.filter((x) => !b.includes(x))

/** 只在正式機用、本機不必有的鍵 */
const PROD_ONLY = ['APP_VERSION']

const schema = schemaKeys(read('backend/src/lib/env.ts'))
const local = envFileKeys(read('backend/.env.example')).all
const prod = envFileKeys(read('deploy/env/.env.prod.example'))
const docker = dockerfileEnvKeys(read('deploy/Dockerfile.backend'))
const front = envFileKeys(read('front/.env.example')).all
const section = (name: string) => prod.sections[name] ?? []

describe('守衛：環境變數名單一致', () => {
  it('讀得到 schema 與三段正式清單', () => {
    expect(schema.length).toBeGreaterThan(15)
    expect(Object.keys(prod.sections).sort()).toEqual(['build', 'env', 'secret'])
  })
  it('本機範本：schema 的鍵都在（正式專用的除外），也沒有 schema 不認得的鍵', () => {
    expect(minus(schema, [...local, ...PROD_ONLY]), 'backend/.env.example 少了這些').toEqual([])
    expect(minus(local, schema), 'backend/.env.example 多了 env.ts 不認得的').toEqual([])
  })
  it('正式清單加上 Dockerfile 的 ENV 涵蓋 schema 每一個鍵，而且不重複設', () => {
    const backendProd = [...section('env'), ...section('secret')]
    expect(minus(schema, [...backendProd, ...docker]), '正式機會漏設這些').toEqual([])
    expect(minus(backendProd, schema), '正式清單多了 env.ts 不認得的').toEqual([])
    expect(backendProd.filter((k) => docker.includes(k)), 'Dockerfile 已設，正式清單不要再設').toEqual([])
  })
  it('前台：本機範本與正式清單 [build] 段一樣，而且都是 VITE_ 開頭', () => {
    expect([...section('build')].sort()).toEqual([...front].sort())
    expect(front.every((k) => k.startsWith('VITE_'))).toBe(true)
  })
  it('密鑰只在 [secret] 段，部署說明的 --set-secrets 每一個都有掛', () => {
    const secretLike = schema.filter((k) => /SECRET|JWT|DATABASE_URL|PASSWORD|TOKEN/.test(k))
    expect([...section('secret')].sort()).toEqual(secretLike.sort())
    const doc = read('deploy/部署說明.md')
    const setSecrets = /--set-secrets\s+"([^"]+)"/.exec(doc)?.[1] ?? ''
    for (const k of section('secret')) expect(setSecrets, `部署說明的 --set-secrets 漏了 ${k}`).toContain(`${k}=${k}:latest`)
  })
  it('塞一個違規會紅：schema 多一個鍵、範本沒跟上', () => {
    const fakeSchema = schemaKeys(`const schema = z.object({\n  A_KEY: z.string(),\n  NEW_KEY: z.string(),\n})`)
    expect(fakeSchema).toEqual(['A_KEY', 'NEW_KEY'])
    expect(minus(fakeSchema, envFileKeys('A_KEY=\n# NEW_KEY=\n').all)).toEqual(['NEW_KEY'])
    expect(envFileKeys('# [env]\nX=\n# [secret]\nY=\n').sections).toEqual({ env: ['X'], secret: ['Y'] })
    expect(dockerfileEnvKeys('ENV NODE_ENV=production\nENV PORT=8080\n')).toEqual(['NODE_ENV', 'PORT'])
  })
})
