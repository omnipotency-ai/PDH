#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

echo "Checking UI for unsafe HTML rendering APIs..."

if rg -n "dangerouslySetInnerHTML|\\binnerHTML\\s*=|\\bcontentEditable\\b" src; then
  echo
  echo "Unsafe HTML rendering API usage detected in src/."
  echo "Policy: user/model text must render as plain text unless a dedicated sanitized rich-text pipeline is introduced."
  exit 1
fi

echo "No raw HTML rendering APIs found in src/."

