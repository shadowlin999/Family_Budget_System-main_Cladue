# Testing Rules

## Validation Commands
- Lint: npm run lint
- Typecheck: tsc -b
- Test: TBD（無測試框架）
- Build: npm run build

## 目前策略
目前無自動化測試框架，以手動測試為主。

## 手動測試優先順序
1. Auth 流程（Google 登入 → 建立家庭 → 邀請碼加入）
2. 零用錢發放（定期自動 + 手動發放）
3. Quest 提交 → 審核流程（approveQuestWithFeedback）
4. 關卡升級（EXP → level 計算）
5. 寶箱開啟流程（purchaseTreasureBox → openOwnedBox）
6. 徽章解鎖（badge conditions 觸發）

## 若未來加入測試框架
- 優先測試 `src/domain/` 的純函數（無副作用，易於單元測試）
  - `getNextAllowanceDate`
  - `evaluateLevelFormula`
  - `calculateExpToNextLevel`
  - `calculateLevelProgress`
  - `applyUserRewards`
- 次優先：store actions 的 Firestore 操作（需要 mock）
- 不強求 UI component 測試

## 驗證流程（每次 PR 前）
```bash
npm run lint   # ESLint check
tsc -b         # TypeScript typecheck
npm run build  # Vite production build
```
