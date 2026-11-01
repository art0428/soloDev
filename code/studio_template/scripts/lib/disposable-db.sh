#!/usr/bin/env bash
# 拋棄式資料庫：後端測試、驗收環境、E2E 每次都建一個隨機名稱的新庫，用完刪掉，永遠不碰開發庫。
# 先 source 這支，再照順序呼叫：
#   tmpdb_init <backend 目錄> <用途>   決定連哪台 PostgreSQL 與這次的庫名；export DATABASE_URL、TMPDB_NAME、TMPDB_SERVER
#   tmpdb_create                        建庫
#   tmpdb_drop                          刪庫（連帶踢掉還連著的連線）。沒建過、已經刪過都不會出錯，直接放進 trap
#
# 連哪台 PostgreSQL（先找到的算）：
#   1. 環境變數 DATABASE_ADMIN_URL，例 postgresql://帳號:密碼@localhost:5432/postgres（CI 用這個）
#   2. <backend 目錄>/.env 的 DATABASE_URL 所在的那台，改連它的 postgres 庫
#   3. postgresql://<作業系統帳號>@localhost:5432/postgres（Homebrew、Postgres.app 免密碼時的預設）
# 庫名一律是 <專案代號>_<用途>_test_<行程號>_<秒數>。後端 src/test/setup.ts 會再檢查一次，名字不對整個測試拒絕啟動。
# 專案代號取根目錄 package.json 的 name（init.sh 填的專案名），同一台 PostgreSQL 上有好幾個專案時，看庫名就知道殘留是誰的。
# 要指定就設 PROJECT_SLUG。

# 把連線字串裡的資料庫換成 $2，並清掉 ?schema= 這類參數（psql 不認得）。帳密、主機、埠照舊。
_tmpdb_point_to() {
  node -e '
    const [, raw, db] = process.argv
    const url = new URL(raw)
    url.pathname = "/" + db
    url.search = ""
    process.stdout.write(url.toString())
  ' "$1" "$2"
}

tmpdb_init() {
  local backend_dir="$1" purpose="${2:-tmp}" server="${DATABASE_ADMIN_URL:-}" dev_url slug
  if [[ -z "$server" && -f "$backend_dir/.env" ]]; then
    dev_url=$(grep -m1 '^DATABASE_URL=' "$backend_dir/.env" | cut -d= -f2- | tr -d "\"'" || true)
    if [[ -n "$dev_url" ]]; then server=$(_tmpdb_point_to "$dev_url" postgres); fi
  fi
  : "${server:=postgresql://${PGUSER:-$(id -un)}@localhost:5432/postgres}"
  # 去掉 @scope/、只留英數、最多 24 字（PostgreSQL 庫名上限 63 bytes）；取不到就用 app
  slug="${PROJECT_SLUG:-$(node -p 'const n = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).name || ""; n.replace(/^@[^/]+\//, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24) || "app"' "$backend_dir/../package.json")}"

  TMPDB_NAME="${slug}_${purpose}_test_$$_$(date +%s)"
  # 保險絲：名字不像拋棄式測試庫就停下來，寧可不跑，也不要動到別的庫
  if [[ "$TMPDB_NAME" == *[!a-z0-9_]* || ! "$TMPDB_NAME" =~ _test_[0-9]+_[0-9]+$ ]]; then
    echo "✖ 拒絕：這次的庫名「$TMPDB_NAME」不像拋棄式測試庫（<代號>_<用途>_test_<行程號>_<秒數>）" >&2
    exit 2
  fi
  TMPDB_SERVER="$server"
  DATABASE_URL="$(_tmpdb_point_to "$server" "$TMPDB_NAME")?schema=public"
  export TMPDB_NAME TMPDB_SERVER DATABASE_URL
}

tmpdb_create() {
  echo "▶ 拋棄式資料庫 $TMPDB_NAME"
  psql -q -v ON_ERROR_STOP=1 "$TMPDB_SERVER" -c "CREATE DATABASE \"$TMPDB_NAME\"" >/dev/null
}

tmpdb_drop() {
  [[ -n "${TMPDB_NAME:-}" ]] || return 0
  # PostgreSQL 13 起 WITH (FORCE) 會一併踢掉連線；更舊的版本先自己踢再刪
  if ! psql -q "$TMPDB_SERVER" -c "DROP DATABASE IF EXISTS \"$TMPDB_NAME\" WITH (FORCE)" >/dev/null 2>&1; then
    psql -q "$TMPDB_SERVER" -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$TMPDB_NAME'" >/dev/null 2>&1 || true
    psql -q "$TMPDB_SERVER" -c "DROP DATABASE IF EXISTS \"$TMPDB_NAME\"" >/dev/null 2>&1 || true
  fi
  echo "  ✓ 已刪拋棄式資料庫 $TMPDB_NAME"
  TMPDB_NAME=""
}
