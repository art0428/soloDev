#!/usr/bin/env bash
# 整套 E2E：起一組拋棄式的資料庫＋後端（mock 登入）＋前台 → 跑 Playwright → 整組清掉。從頭到尾不碰開發庫。
#   bash tests/e2e/run-e2e.sh                全部
#   bash tests/e2e/run-e2e.sh login.pw.ts    只跑某檔（參數原樣交給 playwright）
# 埠：前台 4120、後端 4220（開發 4100／4200、驗收 4110／4210 都避開），可用 E2E_WEB_PORT、E2E_API_PORT 改。
# 跑的途中不要改程式：vite 熱更新會讓不相干的題目逾時變紅。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
source "$ROOT/scripts/lib/stack.sh"

trap stack_down EXIT
trap 'exit 130' INT TERM

export TZ=UTC
STACK_NODE_ENV=test
STACK_LOG_LEVEL=warn
STACK_APP_NAME='E2E 專案'
stack_up e2e "${E2E_WEB_PORT:-4120}" "${E2E_API_PORT:-4220}" "$ROOT/.claude/tmp/e2e"

echo "▶ Playwright"
cd "$ROOT/tests/e2e"
E2E_WEB_URL="$STACK_WEB" E2E_API_URL="$STACK_API" pnpm exec playwright test "$@"
