#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TEMPLATE_DIR="${SCRIPT_DIR%/scripts}"

ask() {
  local var_name="$1"
  local label="$2"
  local default_value="${3:-TBD}"
  local input=""
  read -r -p "${label} [${default_value}]: " input || true
  input="${input:-$default_value}"
  printf -v "$var_name" '%s' "$input"
}

render_dir() {
  local src="$1"
  local dest="$2"
  mkdir -p "$dest"
  python3 - "$src" "$dest" <<'PY'
import os, sys
from pathlib import Path
src = Path(sys.argv[1])
dest = Path(sys.argv[2])
ctx = {
    'PROJECT_NAME': os.environ.get('PROJECT_NAME', 'TBD'),
    'PROJECT_PURPOSE': os.environ.get('PROJECT_PURPOSE', 'TBD'),
    'PRIMARY_USERS': os.environ.get('PRIMARY_USERS', 'TBD'),
    'FRONTEND_STACK': os.environ.get('FRONTEND_STACK', 'TBD'),
    'BACKEND_STACK': os.environ.get('BACKEND_STACK', 'TBD'),
    'PACKAGE_MANAGER': os.environ.get('PACKAGE_MANAGER', 'TBD'),
    'TEST_TOOLING': os.environ.get('TEST_TOOLING', 'TBD'),
    'LINT_CMD': os.environ.get('LINT_CMD', 'TBD'),
    'TYPECHECK_CMD': os.environ.get('TYPECHECK_CMD', 'TBD'),
    'TEST_CMD': os.environ.get('TEST_CMD', 'TBD'),
    'BUILD_CMD': os.environ.get('BUILD_CMD', 'TBD'),
}
for path in src.rglob('*'):
    if path.is_dir():
        continue
    rel = path.relative_to(src)
    out = dest / rel
    text = path.read_text(encoding='utf-8')
    for k, v in ctx.items():
        text = text.replace('{{' + k + '}}', v)
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(text, encoding='utf-8')
PY
}

ask PROJECT_NAME "Project name"
ask PROJECT_PURPOSE "Project purpose"
ask PRIMARY_USERS "Primary users"
ask FRONTEND_STACK "Frontend stack"
ask BACKEND_STACK "Backend stack"
ask PACKAGE_MANAGER "Package manager"
ask TEST_TOOLING "Test / tooling"
ask LINT_CMD "Lint command"
ask TYPECHECK_CMD "Typecheck command"
ask TEST_CMD "Test command"
ask BUILD_CMD "Build command"

export PROJECT_NAME PROJECT_PURPOSE PRIMARY_USERS FRONTEND_STACK BACKEND_STACK PACKAGE_MANAGER TEST_TOOLING LINT_CMD TYPECHECK_CMD TEST_CMD BUILD_CMD
render_dir "$TEMPLATE_DIR" "$ROOT"
chmod +x "$ROOT/scripts/discover-context.sh" "$ROOT/scripts/promote-confirmed-context.sh" "$ROOT/scripts/setup-semi-auto-claude-repo.sh" 2>/dev/null || true

echo "Installed semi-auto Claude repo scaffold into: $ROOT"
echo "Unknown values remain as TBD. Run scripts/discover-context.sh later to scan the repo and append recommendations."
