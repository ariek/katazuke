#!/bin/sh
# コミット前の簡易チェック: JS の構文と CSS の波括弧の対応
set -e
cd "$(dirname "$0")/.."
for f in *.js sw.js; do
  [ -f "$f" ] && node --check "$f"
done
python3 - <<'PY'
import sys
s = open('style.css', encoding='utf-8').read()
depth = 0
for i, line in enumerate(s.split('\n'), 1):
    for ch in line:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
            if depth < 0:
                print(f'style.css: 余分な }} が {i} 行目にあります'); sys.exit(1)
if depth != 0:
    print(f'style.css: 波括弧が {depth} 個閉じていません'); sys.exit(1)
print('check ok')
PY
