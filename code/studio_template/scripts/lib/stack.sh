#!/usr/bin/env bash
# 一組拋棄式的「資料庫＋後端（mock 登入）＋前台」，scripts/verify-env.sh 與 tests/e2e/run-e2e.sh 共用。
# 先 source 這支（它會再 source disposable-db.sh），然後：
#   stack_up <用途> <前台埠> <後端埠> <log 資料夾>   建庫、db push、灌示範世界、起後端與前台、等兩邊都就緒
#   stack_down                                     停兩個伺服器、刪庫；可以重複呼叫，直接放進 trap
# 呼叫前可以設：STACK_NODE_ENV（預設 development）、STACK_LOG_LEVEL（預設 info）、STACK_APP_NAME（畫面標題）。
# 起好之後可以用：STACK_WEB、STACK_API（網址）、STACK_LOGS（log 資料夾）、TMPDB_NAME（庫名）。
#
# 前台由 vite 把 /api、/auth、/health 代理到後端，瀏覽器只看到前台一個網址，所以 API_URL 與 FRONT_URL 都設成前台網址。
# 伺服器用 set -m 開在各自的行程群組，停的時候整組一起停，pnpm 底下的 tsx、vite 子行程才不會留下來占著埠。

STACK_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
source "$STACK_ROOT/scripts/lib/disposable-db.sh"
STACK_PIDS=()

_stack_wait() { # <網址> <名稱> <最多幾秒>
  local deadline=$((SECONDS + $3))
  until curl -sf -o /dev/null --max-time 2 "$1"; do
    if ((SECONDS >= deadline)); then
      echo "✖ $2 等了 $3 秒還沒好，log 在 $STACK_LOGS" >&2
      return 1
    fi
    sleep 1
  done
  echo "  ✓ $2 就緒：$1"
}

stack_up() {
  local purpose="$1" web_port="$2" api_port="$3" port
  STACK_LOGS="$4"
  STACK_WEB="http://127.0.0.1:$web_port"
  STACK_API="http://127.0.0.1:$api_port"
  for port in "$web_port" "$api_port"; do
    if lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "✖ 埠 $port 已經有人在用（上次沒關乾淨，或別的對話正在跑）。查：lsof -nP -iTCP:$port -sTCP:LISTEN" >&2
      return 1
    fi
  done
  mkdir -p "$STACK_LOGS"
  set -m

  tmpdb_init "$STACK_ROOT/backend" "$purpose"
  tmpdb_create
  echo "▶ 建 schema、灌示範世界"
  (cd "$STACK_ROOT/backend" && pnpm exec prisma db push --skip-generate --accept-data-loss >/dev/null)
  (cd "$STACK_ROOT/backend" && pnpm exec tsx prisma/seed.ts)

  echo "▶ 起後端 $STACK_API"
  (
    cd "$STACK_ROOT/backend"
    export NODE_ENV="${STACK_NODE_ENV:-development}" HOST=127.0.0.1 PORT="$api_port" LOG_LEVEL="${STACK_LOG_LEVEL:-info}"
    export AUTH_MODE=mock SESSION_SECRET="stack-$purpose-session-secret-0123456789abcdef"
    export API_URL="$STACK_WEB" FRONT_URL="$STACK_WEB" BUSINESS_TZ="${BUSINESS_TZ:-Asia/Taipei}"
    export MCC_CLIENT_ID= MCC_CLIENT_SECRET= MCC_GROUP_JWT= MCC_SERVICE_CODE= MCC_REDIRECT_URI=
    exec pnpm exec tsx src/server.ts
  ) >"$STACK_LOGS/backend.log" 2>&1 &
  STACK_PIDS+=($!)

  echo "▶ 起前台 $STACK_WEB"
  (
    cd "$STACK_ROOT/front"
    export API_PROXY_TARGET="$STACK_API" VITE_API_URL= VITE_APP_NAME="${STACK_APP_NAME:-$purpose}"
    exec pnpm exec vite --host 127.0.0.1 --port "$web_port" --strictPort
  ) >"$STACK_LOGS/front.log" 2>&1 &
  STACK_PIDS+=($!)

  _stack_wait "$STACK_API/health" 後端 60
  _stack_wait "$STACK_WEB/" 前台 90
}

stack_down() {
  local pid
  for pid in ${STACK_PIDS[@]+"${STACK_PIDS[@]}"}; do
    # 負的行程號＝整個行程群組
    kill -TERM -- "-$pid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
  done
  for pid in ${STACK_PIDS[@]+"${STACK_PIDS[@]}"}; do wait "$pid" 2>/dev/null || true; done
  STACK_PIDS=()
  tmpdb_drop
}
