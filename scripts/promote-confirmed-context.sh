#!/usr/bin/env bash
set -euo pipefail

ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
LOG_FILE="$ROOT/docs/agent-guides/change-log-for-agents.md"
CLAUDE_FILE="$ROOT/CLAUDE.md"
WORKFLOW_FILE="$ROOT/docs/agent-guides/workflow.md"
FRONTEND_RULES="$ROOT/.claude/rules/frontend.md"
BACKEND_RULES="$ROOT/.claude/rules/backend.md"
TESTING_RULES="$ROOT/.claude/rules/testing.md"

python3 - "$LOG_FILE" "$CLAUDE_FILE" "$WORKFLOW_FILE" "$FRONTEND_RULES" "$BACKEND_RULES" "$TESTING_RULES" <<'PY'
import re, sys
from pathlib import Path
log, claude, workflow, frontend, backend, testing = map(Path, sys.argv[1:])
text = log.read_text(encoding='utf-8')
blocks = re.findall(r'```yaml\n(.*?)\n```', text, re.S)
confirmed = []
for block in blocks:
    data = {}
    lines = block.splitlines()
    key = None
    collecting = None
    for line in lines:
        if re.match(r'^[A-Za-z_]+:', line):
            k, v = line.split(':', 1)
            k = k.strip()
            v = v.strip()
            if v == '':
                data[k] = []
                collecting = k
            else:
                data[k] = v
                collecting = None
        elif line.startswith('  - ') and collecting:
            data.setdefault(collecting, []).append(line[4:])
    if data.get('status') == 'confirmed':
        confirmed.append(data)

def replace_line(path, prefix, value):
    if not path.exists():
        return
    lines = path.read_text(encoding='utf-8').splitlines()
    out = []
    changed = False
    for line in lines:
        if line.startswith(prefix):
            out.append(f'{prefix}{value}')
            changed = True
        else:
            out.append(line)
    if changed:
        path.write_text('\n'.join(out) + '\n', encoding='utf-8')

for item in confirmed:
    area = item.get('area')
    value = item.get('recommendation', '')
    if area == 'package-manager':
        replace_line(claude, '- Package manager: ', value)
    elif area == 'frontend-stack':
        replace_line(claude, '- Frontend: ', value)
        replace_line(frontend, 'Frontend stack: ', value)
    elif area == 'backend-stack':
        replace_line(claude, '- Backend: ', value)
        replace_line(backend, 'Backend stack: ', value)
    elif area == 'lint-command':
        replace_line(claude, '- Lint: ', value)
        replace_line(workflow, '- Lint: ', value)
        replace_line(testing, '- Lint: ', value)
    elif area == 'typecheck-command':
        replace_line(claude, '- Typecheck: ', value)
        replace_line(workflow, '- Typecheck: ', value)
        replace_line(testing, '- Typecheck: ', value)
    elif area == 'test-command':
        replace_line(claude, '- Test: ', value)
        replace_line(workflow, '- Test: ', value)
        replace_line(testing, '- Test: ', value)
    elif area == 'build-command':
        replace_line(claude, '- Build: ', value)
        replace_line(workflow, '- Build: ', value)
        replace_line(testing, '- Build: ', value)
PY

echo "Promoted confirmed structured recommendations into official guides."
