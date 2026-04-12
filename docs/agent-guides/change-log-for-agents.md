# Change Log For Agents

本文件記錄對 Claude / agent 有重要影響的知識更新與待確認建議。

## Schema
每筆 recommendation 使用固定欄位，方便後續自動 promotion、去重與驗證。

```yaml
id: rec-YYYYMMDD-001
area: package-manager | frontend-stack | backend-stack | lint-command | typecheck-command | test-command | build-command | architecture
recommendation: <value>
evidence:
  - <evidence item 1>
  - <evidence item 2>
confidence: low | medium | high
status: pending-confirmation | confirmed | rejected
source: manual | repo-scan | user-confirmed
last_checked: YYYY-MM-DD
target_files:
  - CLAUDE.md
  - docs/agent-guides/workflow.md
notes: <optional>
```

## Recommendations

```yaml
id: rec-20260412-001
area: package-manager
recommendation: npm
evidence:
  - Found package-lock.json in root
  - package.json scripts use npm conventions
confidence: high
status: confirmed
source: repo-scan
last_checked: 2026-04-12
target_files:
  - CLAUDE.md
  - docs/agent-guides/workflow.md
notes: Confirmed via package-lock.json presence.
```

```yaml
id: rec-20260412-002
area: frontend-stack
recommendation: React 19 + Vite + TypeScript + TailwindCSS
evidence:
  - Found vite.config.ts
  - package.json dependencies include react@19, vite@8, tailwindcss
  - tsconfig.app.json present with jsx: react-jsx
confidence: high
status: confirmed
source: repo-scan
last_checked: 2026-04-12
target_files:
  - CLAUDE.md
  - .claude/rules/frontend.md
notes: All confirmed from package.json and config files.
```

```yaml
id: rec-20260412-003
area: backend-stack
recommendation: Firebase (Firestore + Auth)
evidence:
  - firebase.json present
  - firestore.rules present
  - package.json dependencies include firebase@12
  - src/services/firebase.ts initializes Firestore and Auth
confidence: high
status: confirmed
source: repo-scan
last_checked: 2026-04-12
target_files:
  - CLAUDE.md
  - .claude/rules/backend.md
notes: Firebase is the only backend. No server-side code.
```

```yaml
id: rec-20260412-004
area: lint-command
recommendation: npm run lint
evidence:
  - package.json scripts.lint = "eslint ."
  - eslint.config.js present with TypeScript + react-hooks plugins
confidence: high
status: confirmed
source: repo-scan
last_checked: 2026-04-12
target_files:
  - CLAUDE.md
  - docs/agent-guides/workflow.md
  - .claude/rules/testing.md
notes: ESLint 9 with flat config.
```

```yaml
id: rec-20260412-005
area: build-command
recommendation: npm run build
evidence:
  - package.json scripts.build = "tsc -b && vite build"
  - Includes TypeScript check before bundle
confidence: high
status: confirmed
source: repo-scan
last_checked: 2026-04-12
target_files:
  - CLAUDE.md
  - docs/agent-guides/workflow.md
  - .claude/rules/testing.md
notes: Build includes tsc -b, so TypeScript errors will fail the build.
```

## Confirmed Updates
- 2026-04-12: 確認所有主要 stack 設定（npm, React 19 + Vite, Firebase, eslint, build）
