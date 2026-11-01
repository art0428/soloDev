import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../../', import.meta.url))
export const FRONT_SRC = fileURLToPath(new URL('../', import.meta.url))
export const IS_TEST_FILE = /\.test\.tsx?$|[\\/]test[\\/]|[\\/]guards[\\/]/
export const GUARDS_DIR = /[\\/]guards[\\/]/
