#!/usr/bin/env bash
# 建齊手冊第 3 章的資料夾（冪等，可以重複跑）。空資料夾放 .gitkeep，git 才會追蹤。
#   bash scripts/scaffold.sh
# 不建 admin/：後台是選配，前台上線後才做（手冊第 6 章「後台」）。
set -euo pipefail
cd "$(dirname "$0")/.."

dirs=(
  docs/prototype/slices
  docs/requirements
  api
  front/src/pages
  front/src/components
  front/src/lib
  backend/src/auth
  backend/src/routes
  backend/src/controllers
  backend/src/services
  backend/src/repositories
  backend/src/lib
  backend/prisma/migrations
  backend/scripts
  packages/api-client/src
  packages/demo-world/src
  tests/contract
  tests/e2e
  tests/security
  deploy/env
  scripts/git-hooks
  scripts/lib
  .github/workflows
  .claude/skills
  .claude/agents
)

made=0
for d in "${dirs[@]}"; do
  if [[ ! -d "$d" ]]; then mkdir -p "$d"; made=$((made + 1)); fi
  if [[ -z "$(ls -A "$d" 2>/dev/null)" ]]; then touch "$d/.gitkeep"; fi
done

# 部署前備份正式庫的位置（已在 .gitignore，不進版控，所以不放 .gitkeep）
mkdir -p gcp/db/backup

echo "✓ 資料夾建齊（這次新建 $made 個）："
for d in "${dirs[@]}"; do echo "  $d"; done
