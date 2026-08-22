#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cc -std=c11 -O2 -Wall -Wextra -Werror \
  -I"$ROOT/src" \
  "$ROOT/src/autobrightness_algo.c" \
  "$ROOT/tests/test_algo.c" \
  -lm -o "$ROOT/tests/test_algo"
"$ROOT/tests/test_algo"
