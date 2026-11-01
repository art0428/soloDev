#!/usr/bin/env bash
# 步 0 第 3 點：把範本變成你的專案。可以重複跑，已經做過的步驟會略過。
#   bash scripts/init.sh <專案代號> [--title "顯示名稱"]
#
#   專案代號：英文小寫、數字、連字號，例 shop-order。會用在套件名、資料庫名、Cloud Run 服務名、映像倉庫名。
#   顯示名稱：畫面標題與文件標題，可以是中文，例 --title "門市訂貨系統"。沒給就用專案代號。
#
# 做的事：
#   1. 檢查 docs/prototype/index_v1.html 在不在（不在就停，什麼都不改）
#   2. 把專案名填進 CLAUDE.md、README.md、api/openapi.yaml、package.json、deploy/ 的文件
#   3. 沒有 .env 就從 .env.example 複製；SESSION_SECRET 空白就產生一組；DATABASE_URL 還是範例就填本機預設
#   4. 檢查 backend/.env 該有的變數（只印名稱，不印值）
#   5. pnpm install、重新產生 api-client
#   6. 設定 git hooks（pre-commit）
#   7. 提醒還沒做的事：真實資料禁字清單、CLAUDE.md 專案資訊、建開發庫、夜間守衛排程
#
# 不做的事：不建資料庫、不寫入任何資料庫、不 commit、不 push、不碰任何密鑰的值。
set -euo pipefail
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

say()  { echo "$*"; }
ok()   { echo "  ✓ $*"; }
warn() { echo "  ※ $*"; }
die()  { echo "✖ $*" >&2; exit 1; }

# ── 參數 ───────────────────────────────────────────────
SLUG=""; TITLE=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --title) TITLE="${2:-}"; shift 2 ;;
    --title=*) TITLE="${1#--title=}"; shift ;;
    -h|--help) sed -n '2,19p' "$0"; exit 0 ;;
    -*) die "不認得的選項 $1（只有 --title）" ;;
    *) [[ -z "$SLUG" ]] || die "只能給一個專案代號"; SLUG="$1"; shift ;;
  esac
done
[[ -n "$SLUG" ]] || die '用法：bash scripts/init.sh <專案代號> [--title "顯示名稱"]，例：bash scripts/init.sh shop-order --title "門市訂貨系統"'
if ! [[ "$SLUG" =~ ^[a-z][a-z0-9-]{1,38}[a-z0-9]$ ]]; then
  die "專案代號「$SLUG」不行：要英文小寫開頭，只用小寫、數字、連字號，3 到 40 字，結尾不能是連字號。中文名稱請用 --title。"
fi
TITLE="${TITLE:-$SLUG}"
DB_NAME="${SLUG//-/_}_dev"
export SLUG TITLE DB_NAME

command -v node >/dev/null || die "找不到 node。請先安裝 Node $(cat .node-version)。"
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
WANT_MAJOR="$(cut -d. -f1 .node-version)"
[[ "$NODE_MAJOR" == "$WANT_MAJOR" ]] || warn "目前 Node 是 $NODE_MAJOR，專案要 $WANT_MAJOR（.node-version）。守衛測試會有一題紅，建議換版本後再繼續。"

# ── 1. 原型 ────────────────────────────────────────────
say "▶ 1/7 原型"
if [[ ! -f docs/prototype/index_v1.html ]]; then
  die "找不到 docs/prototype/index_v1.html。先把你在瀏覽器點過、沒有待決問題的原型存到這個位置（手冊第 4 章），再重跑。這次什麼都沒改。"
fi
ok "docs/prototype/index_v1.html"

# ── 2. 專案名 ──────────────────────────────────────────
say "▶ 2/7 填專案名：代號 $SLUG、顯示名稱 $TITLE"
node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
const { SLUG, TITLE } = process.env
const edits = [
  // 顯示名稱
  ['CLAUDE.md', [[/^# <專案名> · Claude 工作規範$/m, `# ${TITLE} · Claude 工作規範`], [/^\| 專案名 \| <專案名> \|$/m, `| 專案名 | ${TITLE} |`]]],
  ['README.md', [[/^# <專案名>$/m, `# ${TITLE}`]]],
  ['api/openapi.yaml', [[/^(\s+title:) <專案名> API$/m, `$1 ${TITLE} API`]]],
  // 專案代號（服務名、映像倉庫名、資料庫名都用它）
  ['deploy/部署說明.md', [[/<專案名>/g, SLUG]]],
  ['deploy/cloudbuild.yaml', [[/<專案名>/g, SLUG]]],
]
for (const [file, rules] of edits) {
  if (!existsSync(file)) { console.log(`  ※ 沒有 ${file}，略過`); continue }
  const before = readFileSync(file, 'utf8')
  let after = before
  for (const [re, to] of rules) after = after.replace(re, to)
  if (after !== before) { writeFileSync(file, after); console.log(`  ✓ ${file}`) }
  else console.log(`  ・ ${file} 已經填過`)
}
const pkg = JSON.parse(readFileSync('package.json', 'utf8'))
if (pkg.name === 'studio-template') {
  pkg.name = SLUG
  pkg.description = TITLE
  writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n')
  console.log('  ✓ package.json')
} else if (pkg.name === SLUG) console.log('  ・ package.json 已經填過')
else console.log(`  ※ package.json 的名稱已經是 ${pkg.name}，不改。`)
NODE

# ── 3. .env ────────────────────────────────────────────
say "▶ 3/7 .env"
for side in backend front; do
  if [[ -f "$side/.env" ]]; then ok "$side/.env 已存在，不覆蓋"
  else cp "$side/.env.example" "$side/.env"; ok "$side/.env 從 .env.example 複製"
  fi
done
node --input-type=module - <<'NODE'
import { readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { userInfo } from 'node:os'
const { DB_NAME, TITLE } = process.env
const get = (t, k) => (new RegExp(`^${k}=(.*)$`, 'm').exec(t)?.[1] ?? '').trim()
const set = (t, k, v) => t.replace(new RegExp(`^${k}=.*$`, 'm'), () => `${k}=${v}`)

let b = readFileSync('backend/.env', 'utf8')
const b0 = b
if (!get(b, 'SESSION_SECRET')) { b = set(b, 'SESSION_SECRET', randomBytes(48).toString('base64')); console.log('  ✓ SESSION_SECRET 產生了一組（值不顯示）') }
else console.log('  ・ SESSION_SECRET 已有值')
if (get(b, 'DATABASE_URL').includes('<')) {
  b = set(b, 'DATABASE_URL', `postgresql://${userInfo().username}@localhost:5432/${DB_NAME}?schema=public`)
  console.log(`  ✓ DATABASE_URL 填了本機預設（作業系統帳號、免密碼、資料庫 ${DB_NAME}）；你的 PostgreSQL 要密碼的話自己改`)
} else console.log('  ・ DATABASE_URL 已有值')
if (b !== b0) writeFileSync('backend/.env', b)

let f = readFileSync('front/.env', 'utf8')
if (get(f, 'VITE_APP_NAME') === '專案名') { writeFileSync('front/.env', set(f, 'VITE_APP_NAME', TITLE)); console.log('  ✓ front/.env 的 VITE_APP_NAME') }
NODE

# ── 4. 檢查 backend/.env ───────────────────────────────
say "▶ 4/7 檢查 backend/.env（只印名稱）"
node --input-type=module - <<'NODE'
import { readFileSync } from 'node:fs'
const keys = (t) => [...t.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1])
const env = readFileSync('backend/.env', 'utf8')
const val = (k) => (new RegExp(`^${k}=(.*)$`, 'm').exec(env)?.[1] ?? '').trim()
const missingKeys = keys(readFileSync('backend/.env.example', 'utf8')).filter((k) => !keys(env).includes(k))
if (missingKeys.length) console.log(`  ※ backend/.env 少了這些變數（.env.example 後來新增的）：${missingKeys.join('、')}`)
const problems = []
if (!val('DATABASE_URL') || val('DATABASE_URL').includes('<')) problems.push('DATABASE_URL 還沒填')
if (val('SESSION_SECRET').length < 32) problems.push('SESSION_SECRET 不到 32 字元')
const mode = val('AUTH_MODE')
if (!['mock', 'mcc'].includes(mode)) problems.push('AUTH_MODE 要是 mock 或 mcc')
if (mode === 'mcc') {
  for (const k of ['MCC_CLIENT_ID', 'MCC_CLIENT_SECRET']) if (!val(k)) problems.push(`${k} 還沒填（AUTH_MODE=mcc 必填）`)
  for (const k of ['MCC_GROUP_JWT', 'MCC_SERVICE_CODE']) if (!val(k)) console.log(`  ※ ${k} 還沒填：沒有它，被 MCC 撤銷的會員可以一直用到 Session 過期`)
}
if (problems.length) for (const p of problems) console.log(`  ✕ ${p}`)
else console.log(`  ✓ 必填的都有值（AUTH_MODE=${mode}）`)
if (mode === 'mock') console.log('  ※ 現在是 mock 假登入。第 5 章的準備檢查要用測試 Group 的憑證真實登入：拿到 MCC_* 後自己填進 backend/.env，把 AUTH_MODE 改成 mcc，不要貼進對話。')
NODE

# ── 5. 安裝 ────────────────────────────────────────────
say "▶ 5/7 pnpm install"
if command -v pnpm >/dev/null; then PNPM=(pnpm)
else export COREPACK_ENABLE_DOWNLOAD_PROMPT=0; PNPM=(corepack pnpm); warn "找不到 pnpm，這次先用 corepack pnpm 安裝。之後要先執行 corepack enable，pnpm 指令才能用。"
fi
# 成功只印一行，失敗印最後 30 行
run_quiet() {
  local out
  if ! out=$("$@" 2>&1); then echo "$out" | tail -30; die "$* 失敗（上面是最後 30 行）"; fi
  echo "$out" | grep -E '^Done in|→' | sed 's/^/  /' || true
}
run_quiet "${PNPM[@]}" install
# 直接叫 api-client 的 gen（根目錄的 openapi:gen 裡面又呼叫 pnpm，沒有 pnpm 指令時會失敗）
run_quiet "${PNPM[@]}" --filter @studio/api-client run gen
ok "相依裝好、api-client 依契約重新產生"

# ── 6. git hooks ───────────────────────────────────────
say "▶ 6/7 git hooks"
chmod +x scripts/*.sh scripts/lib/*.sh scripts/*.mjs scripts/git-hooks/* backend/scripts/*.sh tests/e2e/*.sh tests/contract/*.sh 2>/dev/null || true
if git rev-parse --is-inside-work-tree >/dev/null 2>&1 && [[ "$(git rev-parse --show-toplevel)" == "$ROOT" ]]; then
  git config core.hooksPath scripts/git-hooks
  ok "pre-commit 已啟用（core.hooksPath=scripts/git-hooks）"
else
  warn "這裡還不是 git repo 的根目錄。先 git init -b main 再重跑一次，pre-commit 才會生效。"
fi

# ── 7. 還沒做的事 ──────────────────────────────────────
say "▶ 7/7 還沒做的事"
if node -e 'const t=require("fs").readFileSync("packages/demo-world/src/forbidden.ts","utf8");process.exit(/^\s*["\x27][^"\x27]+["\x27],?\s*$/m.test(t)?0:1)'; then
  ok "真實資料禁字清單有內容"
else
  warn "真實資料禁字清單是空的：把你公司、你客戶、會用到的真實品牌名字寫進 packages/demo-world/src/forbidden.ts，守衛測試才擋得到。"
fi
for item in "一句話說明" "業務時區 BUSINESS_TZ" "正式網址"; do
  if grep -Eq "^\| ${item} \| <" CLAUDE.md; then warn "CLAUDE.md 專案資訊「${item}」還沒填"; fi
done

echo
echo "完成。接下來："
echo
if [[ "${PNPM[0]}" == corepack ]]; then
  echo "0. 先執行 corepack enable，讓 pnpm 指令可以用。根目錄的 pnpm dev、pnpm test 裡面會再呼叫 pnpm，"
  echo "   只用 corepack pnpm 會在那一層失敗。"
fi
cat <<EOF
1. 建本機開發庫（init.sh 不碰資料庫，這三行自己跑）：
     createdb ${DB_NAME}
     pnpm --filter backend run prisma:migrate
     pnpm --filter backend run prisma:seed
2. pnpm dev，打開 http://127.0.0.1:4100 按「以許經理（管理員）登入」。
3. 換成測試 Group 憑證真實登入成功，就是手冊第 5 章的準備檢查通過。
4. 把這次的變更 commit：git add -A && git commit -m "chore: init.sh 填入專案名 ${SLUG}"
5. 建夜間守衛排程（排程綁你的帳號，所以範本沒辦法替你建）。在 Claude Code 說：
     建立排程任務 nightly-guard，每天 02:00 執行：照 .claude/skills/nightly-guard/SKILL.md 跑夜間守衛。
6. 開新對話貼步 1 的 Prompt：
     讀 CLAUDE.md 與 docs/prototype/index_v1.html 的系統說明、功能清單與角色。
     依手冊步 1，接上登入、使用者資料、前台選單與依角色顯示，不寫業務邏輯。
     做完貼 pnpm test、pnpm build 的結果與真實登入後的畫面截圖。
EOF
