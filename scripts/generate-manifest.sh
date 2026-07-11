#!/usr/bin/env bash
set -euo pipefail

mode="${1:-write}"
temporary_file="$(mktemp)"
trap 'rm -f "$temporary_file"' EXIT

mapfile -d '' files < <(
  find . -type f \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path '*/node_modules/*' \
    -not -path '*/dist/*' \
    -not -path '*/coverage/*' \
    -not -path '*/.vite/*' \
    -not -name '*.tsbuildinfo' \
    -not -path './MANIFEST.md' \
    -print0 | sort -z
)

{
  echo '# 交付清单'
  echo
  echo "生成日期：$(date +%F)"
  echo
  echo "文件数量（不含本清单、依赖和构建产物）：${#files[@]}"
  echo
  echo '| 文件 | SHA-256 |'
  echo '|---|---|'
  for file in "${files[@]}"; do
    hash="$(sha256sum "$file" | cut -d ' ' -f 1)"
    echo "| \`${file#./}\` | \`$hash\` |"
  done
} > "$temporary_file"

if [[ "$mode" == '--check' ]]; then
  if ! cmp -s "$temporary_file" MANIFEST.md; then
    echo 'MANIFEST.md is stale. Run: bash scripts/generate-manifest.sh' >&2
    diff -u MANIFEST.md "$temporary_file" || true
    exit 1
  fi
  echo 'Manifest hashes are current.'
  exit 0
fi

if [[ "$mode" != 'write' ]]; then
  echo "Unknown mode: $mode" >&2
  exit 2
fi

mv "$temporary_file" MANIFEST.md
trap - EXIT
echo 'MANIFEST.md updated.'
