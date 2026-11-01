#!/usr/bin/env bash
# 隔離副本：把某個版本（預設 main）整棵匯出到別的資料夾，給夜間守衛在那裡跑全套、給改 schema 的對話在那裡做。
# 為什麼要隔離：共用工作樹常混著別人沒提交的半成品；別人存檔會熱更新到正在跑的畫面。
#
#   bash scripts/iso-copy.sh make <絕對路徑> [版本=main]
#
# 規矩（dev-guidelines、nightly-guard 第 3 節）：
#   副本路徑一律絕對路徑、不可在 repo 裡面。
#   node_modules 用「實體複製」（cp -R，連結保留相對關係），不是把共用樹的 node_modules 連結進去。
#   backend/.env 複製一份（測試腳本要從它算 admin 連線）；副本不是 git repo，不會被 add 進版控。
#   副本裡改好的檔要搬回共用樹時，照 nightly-guard 第 4 節用暫時索引提交，只收自己的檔。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cmd="${1:-}"; dest="${2:-}"; rev="${3:-main}"

if [[ "$cmd" != "make" || -z "$dest" ]]; then echo "用法：bash scripts/iso-copy.sh make <絕對路徑> [版本=main]"; exit 1; fi
if [[ "$dest" != /* ]]; then echo "✖ 副本路徑要是絕對路徑：$dest"; exit 1; fi
if [[ "$dest" == "$ROOT" || "$dest" == "$ROOT"/* ]]; then echo "✖ 副本不能放在 repo 裡面（會被當成 repo 的檔案）"; exit 1; fi
if [[ -e "$dest" && -n "$(ls -A "$dest" 2>/dev/null)" ]]; then echo "✖ $dest 不是空的，換一個資料夾"; exit 1; fi

sha=$(git -C "$ROOT" rev-parse "$rev")
mkdir -p "$dest"
echo "▶ 匯出 $rev（${sha:0:7}）到 $dest …"
git -C "$ROOT" archive --format=tar "$sha" | tar -x -C "$dest"

# 實體複製 node_modules（pnpm 的連結是相對路徑，整棵一起複製後仍然有效）
for d in "" front backend packages/api-client packages/demo-world tests/e2e; do
  src="$ROOT/${d:+$d/}node_modules"
  if [[ -d "$src" ]]; then
    echo "  複製 ${d:-.}/node_modules …"
    mkdir -p "$dest/${d}"
    cp -R "$src" "$dest/${d:+$d/}node_modules"
  fi
done

if [[ -f "$ROOT/backend/.env" ]]; then cp "$ROOT/backend/.env" "$dest/backend/.env"; fi
echo "$sha" > "$dest/.iso-base"
echo "✓ 副本就緒：$dest（$rev ${sha:0:7}）。之後一律用絕對路徑操作副本。"
