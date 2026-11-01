#!/usr/bin/env bash
# 契約模糊測試：拿亂資料打每支端點，看回應是否仍符合契約。
#   bash tests/contract/run-schemathesis.sh <API 網址> [<sid cookie 值>]
# 對拋棄式環境跑（verify-env 或 run-e2e 起的那組），不對開發環境或正式機跑。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
API="${1:?用法：run-schemathesis.sh <API 網址> [<sid>]}"
SID="${2:-}"
if ! command -v schemathesis >/dev/null 2>&1; then
  echo "✖ 找不到 schemathesis。安裝：pipx install schemathesis（或 uv tool install schemathesis）"; exit 1
fi
PARAMS=$(cd "$ROOT/tests/contract" && node --import tsx st-prepare-data.ts 2>/dev/null || true)
HEADER=()
if [[ -n "$SID" ]]; then HEADER=(-H "Cookie: sid=$SID"); fi
# shellcheck disable=SC2086
schemathesis run "$ROOT/api/openapi.yaml" --url "$API" --checks all --exclude-path-regex '^/auth/callback' ${PARAMS} "${HEADER[@]+"${HEADER[@]}"}"
