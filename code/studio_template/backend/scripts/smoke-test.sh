#!/usr/bin/env bash
# 部署後煙霧測試：只做免登入、唯讀、不留痕跡的檢查，可以安全地對正式機跑。
#   bash scripts/smoke-test.sh <API 網址> [<前台網址>] [<這次的版本，例 prod/v3>]
# 正向（打對了會回什麼）與負向（守衛有沒有掉線）各幾項；任何一項紅就 exit 1。
# 帶了版本就比對 /health 的 version（部署時用 --update-env-vars APP_VERSION=prod/vN 設的），確認流量真的到新版。
# 需要登入才打得到的驗證留在單元測試，不要往這裡加。
# 對 AUTH_MODE=mock 的本機環境跑會有 3 項紅（authMode、/auth/login 沒帶 as、/internal 存在），那是正常的：這支是給正式機用的。
set -uo pipefail
API="${1:?用法：smoke-test.sh <API 網址> [<前台網址>] [<版本>]}"
FRONT="${2:-}"
WANT_VERSION="${3:-}"
API="${API%/}"
pass=0; fail=0

check() { # 描述 期望狀態碼 實際狀態碼 [額外條件 0/1]
  local desc="$1" want="$2" got="$3" extra="${4:-0}"
  if [[ "$got" == "$want" && "$extra" == "0" ]]; then echo "  ✓ $desc（$got）"; pass=$((pass+1))
  else echo "  ✕ $desc：期望 $want，實際 $got"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$@"; }

echo "▶ 煙霧測試 $API"
body=$(curl -s --max-time 10 "$API/health")
check "GET /health 200" 200 "$(code "$API/health")"
if echo "$body" | grep -q '"authMode":"mock"'; then echo "  ✕ /health 回 authMode=mock：正式機不可以是假登入"; fail=$((fail+1)); else echo "  ✓ authMode 不是 mock"; pass=$((pass+1)); fi
if [[ -n "$WANT_VERSION" ]]; then
  if echo "$body" | grep -q "\"version\":\"$WANT_VERSION\""; then echo "  ✓ /health 版本是 $WANT_VERSION"; pass=$((pass+1))
  else echo "  ✕ /health 版本不是 $WANT_VERSION：$body"; fail=$((fail+1)); fi
fi
check "GET /api/me 未登入 401" 401 "$(code "$API/api/me")"
check "GET /api/admin/ping 未登入 401" 401 "$(code "$API/api/admin/ping")"
check "GET /auth/login 導向 MCC 302" 302 "$(code "$API/auth/login")"
check "POST /auth/logout 未登入 204" 204 "$(code -X POST "$API/auth/logout")"
check "POST 壞 JSON 回 400（解析層守衛）" 400 "$(code -X POST -H 'content-type: application/json' --data '{bad' "$API/auth/logout")"
check "POST /internal/test/seed-user 不存在 404" 404 "$(code -X POST "$API/internal/test/seed-user")"
check "GET /nope 404" 404 "$(code "$API/nope")"
if [[ -n "$FRONT" ]]; then check "前台首頁 200" 200 "$(code "${FRONT%/}/")"; fi

echo "結果：$pass 過、$fail 紅"
[[ $fail -eq 0 ]]
