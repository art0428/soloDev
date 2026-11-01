import { fileURLToPath } from 'node:url'

/** 專案根目錄（backend/src/guards → 三層上去） */
export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const BACKEND_SRC = fileURLToPath(new URL('../', import.meta.url))
export const FRONT_SRC = fileURLToPath(new URL('../../../front/src/', import.meta.url))
export const E2E_DIR = fileURLToPath(new URL('../../../tests/e2e/', import.meta.url))
export const CONTRACT_DIR = fileURLToPath(new URL('../../../tests/contract/', import.meta.url))
export const BACKEND_SCRIPTS = fileURLToPath(new URL('../../scripts/', import.meta.url))
export const BACKEND_PRISMA = fileURLToPath(new URL('../../prisma/', import.meta.url))

export const IS_TEST_FILE = /\.test\.tsx?$|[\\/]test[\\/]|[\\/]guards[\\/]/
export const GUARDS_DIR = /[\\/]guards[\\/]/
