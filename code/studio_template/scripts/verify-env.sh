#!/usr/bin/env bash
# 驗收環境：起一組拋棄式的「資料庫＋後端＋前台」給人（或 AI）在瀏覽器裡實際操作，關掉時整組清掉。
# 驗收不在開發用的 4100／4200 上做，那兩個連的是開發庫。
#
#   bash scripts/verify-env.sh start     起環境，前景執行到 stop 為止（AI 用背景執行）
#   bash scripts/verify-env.sh stop      關掉，資料庫一起刪
#   bash scripts/verify-env.sh status    有沒有在跑、登入網址
#
# 埠：前台 4110、後端 4210（開發 4100／4200、E2E 4120／4220 都避開），可用 VERIFY_WEB_PORT、VERIFY_API_PORT 改。
# 資料：示範世界的兩位使用者（許經理＝管理員、蔡業務＝一般成員），mock 登入。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_DIR="$ROOT/.claude/tmp/verify-env"
INFO="$RUN_DIR/state.env"

running_pid() { if [[ -f "$INFO" ]]; then sed -n 's/^PID=//p' "$INFO"; fi; }
is_running() {
  local pid
  pid="$(running_pid)"
  [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

case "${1:-start}" in
  status)
    if is_running; then cat "$INFO"; else echo "驗收環境沒有在跑"; fi
    exit 0
    ;;
  stop)
    if ! is_running; then
      rm -f "$INFO"
      echo "驗收環境沒有在跑"
      exit 0
    fi
    pid="$(running_pid)"
    kill -TERM "$pid"
    for _ in $(seq 30); do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
    echo "✓ 驗收環境已關閉"
    exit 0
    ;;
  start) ;;
  *)
    echo "用法：bash scripts/verify-env.sh start|stop|status" >&2
    exit 1
    ;;
esac

if is_running; then
  echo "✖ 驗收環境已經在跑：" >&2
  cat "$INFO" >&2
  exit 1
fi

source "$ROOT/scripts/lib/stack.sh"
finish() {
  trap - EXIT INT TERM
  echo "▶ 清理：停伺服器、刪資料庫"
  stack_down
  rm -f "$INFO"
}
trap finish EXIT
trap 'exit 0' INT TERM

STACK_APP_NAME="${VITE_APP_NAME:-驗收環境}"
stack_up verify "${VERIFY_WEB_PORT:-4110}" "${VERIFY_API_PORT:-4210}" "$RUN_DIR"

cat >"$INFO" <<INFO_END
PID=$$
DB=$TMPDB_NAME
WEB=$STACK_WEB
API=$STACK_API
ADMIN_LOGIN=$STACK_WEB/auth/login?as=mock-admin
MEMBER_LOGIN=$STACK_WEB/auth/login?as=mock-member
LOGS=$RUN_DIR
INFO_END

echo
echo "──── 驗收環境就緒（關閉：bash scripts/verify-env.sh stop）────"
echo "資料庫：$TMPDB_NAME（關閉時刪除）"
echo "管理員登入：$STACK_WEB/auth/login?as=mock-admin"
echo "一般成員登入：$STACK_WEB/auth/login?as=mock-member"

# 前景等著，直到 stop 送來 TERM（由上面的 trap 收尾）
while true; do sleep 2; done
