# Agent Guides

本目錄提供 Claude Code 在本 repo 工作時需要的進階指引。

## Reading Rules
1. 先讀 `project-map.md`
2. 再根據任務類型選讀最相關文件
3. 若屬於特定子系統，再讀 `.claude/rules/` 相關規則
4. 若遇到 TBD，先看 `change-log-for-agents.md` 的建議與證據

## 文件索引

| 文件 | 適用時機 |
|------|---------|
| `project-map.md` | 任何任務開始前，了解目錄結構 |
| `architecture.md` | 新增功能、理解分層關係 |
| `workflow.md` | 需要執行 lint/build/test 指令 |
| `coding-conventions.md` | 寫新程式碼前 |
| `common-gotchas.md` | 遇到奇怪 bug，或要修改既有邏輯前 |
| `debugging-playbook.md` | 排查問題 |
| `module-boundaries.md` | 新增 import 前確認合法性 |
| `dependency-policy.md` | 考慮新增套件前 |
| `testing-strategy.md` | 驗證變更 |
| `change-log-for-agents.md` | 查詢已確認或待確認的 stack 決策 |

## 本專案重點
- 這是一個 React + Firebase 家庭預算 app，面向家長與小孩
- 核心是 Zustand store（`src/store/index.ts`），管理所有 Firestore 操作與 App 狀態
- Types 已拆分至 `src/types/`，Domain 純函數在 `src/domain/`
- Views 只透過 `useStore()` 存取資料，不直接 import firebase
