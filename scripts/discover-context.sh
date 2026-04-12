#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_FILE="$ROOT/docs/agent-guides/change-log-for-agents.md"
TODAY="$(date +%F)"

ensure_schema() {
  if [[ ! -f "$LOG_FILE" ]]; then
    echo "Missing $LOG_FILE"
    exit 1
  fi
}

next_id() {
  python3 - "$LOG_FILE" "$TODAY" <<'PY'
import re, sys
from pathlib import Path
log = Path(sys.argv[1]).read_text(encoding='utf-8')
today = sys.argv[2].replace('-', '')
nums = [int(m.group(1)) for m in re.finditer(rf'id: rec-{today}-(\d{{3}})', log)]
print(f"rec-{today}-{(max(nums)+1 if nums else 1):03d}")
PY
}

append_yaml_block() {
  local area="$1"
  local recommendation="$2"
  local confidence="$3"
  local source="$4"
  local target_files="$5"
  shift 5
  local evidence_items=("$@")

  python3 - "$LOG_FILE" "$area" "$recommendation" <<'PY'
import sys
from pathlib import Path
text = Path(sys.argv[1]).read_text(encoding='utf-8')
area = sys.argv[2]
rec = sys.argv[3]
if f"area: {area}\nrecommendation: {rec}\n" in text:
    raise SystemExit(10)
PY
  local status=$?
  if [[ $status -eq 10 ]]; then
    return 0
  fi

  local rec_id
  rec_id="$(next_id)"
  {
    echo
    echo '```yaml'
    echo "id: ${rec_id}"
    echo "area: ${area}"
    echo "recommendation: ${recommendation}"
    echo 'evidence:'
    for item in "${evidence_items[@]}"; do
      echo "  - ${item}"
    done
    echo "confidence: ${confidence}"
    echo 'status: pending-confirmation'
    echo "source: ${source}"
    echo "last_checked: ${TODAY}"
    echo 'target_files:'
    IFS='|' read -r -a tf <<< "$target_files"
    for t in "${tf[@]}"; do
      echo "  - ${t}"
    done
    echo 'notes: Auto-discovered. Confirm before promotion.'
    echo '```'
  } >> "$LOG_FILE"
}

ensure_schema

if [[ -f "$ROOT/pnpm-lock.yaml" ]]; then
  append_yaml_block "package-manager" "pnpm" "high" "repo-scan" "CLAUDE.md|docs/agent-guides/workflow.md" "Found pnpm-lock.yaml"
elif [[ -f "$ROOT/yarn.lock" ]]; then
  append_yaml_block "package-manager" "yarn" "high" "repo-scan" "CLAUDE.md|docs/agent-guides/workflow.md" "Found yarn.lock"
elif [[ -f "$ROOT/package-lock.json" ]]; then
  append_yaml_block "package-manager" "npm" "high" "repo-scan" "CLAUDE.md|docs/agent-guides/workflow.md" "Found package-lock.json"
elif [[ -f "$ROOT/bun.lockb" || -f "$ROOT/bun.lock" ]]; then
  append_yaml_block "package-manager" "bun" "high" "repo-scan" "CLAUDE.md|docs/agent-guides/workflow.md" "Found bun lockfile"
fi

if [[ -f "$ROOT/next.config.js" || -f "$ROOT/next.config.ts" ]]; then
  append_yaml_block "frontend-stack" "Next.js" "high" "repo-scan" "CLAUDE.md|.claude/rules/frontend.md" "Found next.config.*"
elif [[ -f "$ROOT/vite.config.ts" || -f "$ROOT/vite.config.js" ]]; then
  append_yaml_block "frontend-stack" "Vite-based frontend" "medium" "repo-scan" "CLAUDE.md|.claude/rules/frontend.md" "Found vite.config.*"
elif [[ -f "$ROOT/nuxt.config.ts" || -f "$ROOT/nuxt.config.js" ]]; then
  append_yaml_block "frontend-stack" "Nuxt" "high" "repo-scan" "CLAUDE.md|.claude/rules/frontend.md" "Found nuxt.config.*"
fi

if [[ -f "$ROOT/pyproject.toml" ]] && grep -qi "fastapi" "$ROOT/pyproject.toml"; then
  append_yaml_block "backend-stack" "FastAPI" "high" "repo-scan" "CLAUDE.md|.claude/rules/backend.md" "Found FastAPI in pyproject.toml"
elif [[ -f "$ROOT/requirements.txt" ]] && grep -qi "fastapi" "$ROOT/requirements.txt"; then
  append_yaml_block "backend-stack" "FastAPI" "high" "repo-scan" "CLAUDE.md|.claude/rules/backend.md" "Found FastAPI in requirements.txt"
elif [[ -f "$ROOT/go.mod" ]]; then
  append_yaml_block "backend-stack" "Go backend" "medium" "repo-scan" "CLAUDE.md|.claude/rules/backend.md" "Found go.mod"
elif [[ -f "$ROOT/package.json" ]]; then
  append_yaml_block "backend-stack" "Node.js-based backend or tooling" "low" "repo-scan" "CLAUDE.md|.claude/rules/backend.md" "Found package.json"
fi

if [[ -f "$ROOT/package.json" ]]; then
  python3 - "$ROOT/package.json" "$LOG_FILE" "$TODAY" <<'PY'
import json, sys, re
from pathlib import Path
pkg = Path(sys.argv[1])
log_path = Path(sys.argv[2])
today = sys.argv[3]
try:
    data = json.loads(pkg.read_text(encoding='utf-8'))
except Exception:
    raise SystemExit(0)
scripts = data.get('scripts', {})
log = log_path.read_text(encoding='utf-8')
nums = [int(m.group(1)) for m in re.finditer(rf'id: rec-{today.replace("-", "")}-(\d{{3}})', log)]
next_num = max(nums)+1 if nums else 1

def has(area, recommendation):
    needle = f"area: {area}\nrecommendation: {recommendation}\n"
    return needle in log

def emit(area, recommendation, key):
    global next_num, log
    if has(area, recommendation):
        return
    rec_id = f"rec-{today.replace('-', '')}-{next_num:03d}"
    next_num += 1
    block = f'''\n```yaml
id: {rec_id}
area: {area}
recommendation: {recommendation}
evidence:
  - Found `{key}` script in package.json
confidence: high
status: pending-confirmation
source: repo-scan
last_checked: {today}
target_files:
  - CLAUDE.md
  - docs/agent-guides/workflow.md
  - .claude/rules/testing.md
notes: Auto-discovered. Confirm before promotion.
```\n'''
    with log_path.open('a', encoding='utf-8') as f:
        f.write(block)
    log += block

mapping = [
    ('lint-command', 'lint'),
    ('typecheck-command', 'typecheck'),
    ('test-command', 'test'),
    ('build-command', 'build'),
]
for area, key in mapping:
    if key in scripts:
        emit(area, scripts[key], key)
PY
fi

echo "Appended structured recommendations to: $LOG_FILE"
