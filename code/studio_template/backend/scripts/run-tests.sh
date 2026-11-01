#!/usr/bin/env bash
# 後端測試。每次都建一個隨機名稱的拋棄式資料庫，跑完刪掉，從頭到尾不碰開發庫。
#
#   pnpm --filter backend run test                                       全部；schema 用 prisma db push 建（快，日常用）
#   pnpm --filter backend run test src/routes/me.test.ts                 只跑這幾個檔（檔名直接接在後面，不加 --）
#   TEST_FILES="src/routes/me.test.ts" pnpm --filter backend run test    同上，給排程或 CI 用環境變數指定
#   pnpm --filter backend run test:migrate     schema 改用 migrate deploy 疊出來，再查漂移（改 schema 後、併回前必跑）
#   pnpm --filter backend run test:coverage    加覆蓋率報告（只出報告，不設門檻）
#
# 連哪台 PostgreSQL 見 scripts/lib/disposable-db.sh 的檔頭。
set -euo pipefail
BACKEND="$(cd "$(dirname "$0")/.." && pwd)"
cd "$BACKEND"
source "$BACKEND/../scripts/lib/disposable-db.sh"

mode="${SCHEMA_MODE:-push}"
case "$mode" in
  push | migrate) ;;
  *) echo "SCHEMA_MODE 只能是 push 或 migrate，收到「$mode」" >&2; exit 1 ;;
esac

# 先做型別檢查：幾秒就完、用不到資料庫；型別錯了就不必建庫
echo "▶ 型別檢查"
pnpm exec tsc --noEmit

tmpdb_init "$BACKEND" unit
trap tmpdb_drop EXIT
# TZ 刻意釘成 UTC，跟業務時區 Asia/Taipei 不同，「拿機器時鐘算業務日期」的錯才會紅
export TZ=UTC NODE_ENV=test
tmpdb_create

if [[ "$mode" == migrate ]]; then
  echo "▶ 用 migration 疊出 schema（跟正式機同一條路）"
  pnpm exec prisma migrate deploy
  echo "▶ 查漂移：migration 疊出來的庫和 schema.prisma 一不一樣"
  drift=(migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma)
  if ! pnpm exec prisma "${drift[@]}" --exit-code >/dev/null 2>&1; then
    echo "✖ schema 漂移：schema.prisma 改了卻沒有對應的 migration，正式機部署後會少東西。少的 SQL："
    pnpm exec prisma "${drift[@]}" --script || true
    exit 1
  fi
  echo "  ✓ 沒有漂移"
else
  echo "▶ 用 db push 建 schema"
  pnpm exec prisma db push --skip-generate --accept-data-loss >/dev/null
fi

vitest_args=(run)
if [[ "${COVERAGE:-}" == 1 ]]; then vitest_args+=(--coverage); fi
# TEST_FILES 故意不加引號展開：空白分隔的幾個檔名要拆成幾個參數
if [[ -n "${TEST_FILES:-}" ]]; then
  # shellcheck disable=SC2206
  vitest_args+=(${TEST_FILES})
fi
# 接在指令後面的檔名或 vitest 參數（例：src/routes/me.test.ts、-t "401"）
vitest_args+=("$@")
echo "▶ 跑測試"
pnpm exec vitest "${vitest_args[@]}"
