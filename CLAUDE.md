# CLAUDE.md

## Project Identity
你正在協作的專案是：Family_Budget_System_For_Kids
本專案用途：以訓練小孩經濟與習慣紀律的有趣家庭預算系統
主要使用者：家長與小孩

主要技術棧：
- Frontend: React 19 + Vite + TypeScript + TailwindCSS
- Backend: Firebase (Firestore + Auth)
- Package manager: npm
- Test / Tooling: ESLint + TypeScript

本專案的首要目標不是最快生成程式，而是：
1. 保持正確性
2. 維持模組化與可維護性
3. 以最小變更完成需求
4. 優先沿用既有架構與慣例
5. 盡量降低不必要的 token / context 消耗

## Required Reading Order
1. 閱讀 `docs/agent-guides/README.md`
2. 閱讀 `docs/agent-guides/project-map.md`
3. 只閱讀與當前任務最相關的 guide
4. 若任務屬於特定領域，再閱讀 `.claude/rules/` 中對應規則
5. 不要一次展開所有 guide 與 rules，避免上下文膨脹

## Unknown Decision Handling
若 stack、commands、rules 尚未定案：
- 不要把猜測寫成既定事實
- 先從 repo 實際檔案與工具設定推斷
- 以「recommendation + evidence + confidence」格式記錄到 `docs/agent-guides/change-log-for-agents.md`
- 若同一建議在多次任務中持續被驗證，或我明確確認，才更新正式 guide

## Validation Commands
- Lint: npm run lint
- Typecheck: tsc -b
- Test: TBD（無測試框架）
- Build: npm run build

## Guide Update Rule
若同一類錯誤被我糾正兩次以上，或本次任務發現高機率會再次出現的 repo-specific gotcha：
- 不要直接把內容堆進 `CLAUDE.md`
- 優先更新對應 guide 或 `.claude/rules/`
- 若屬於高頻錯誤模式，記錄到 `docs/agent-guides/common-gotchas.md`
- 若已有相近條目，優先更新或整併，不要新增重複條目
