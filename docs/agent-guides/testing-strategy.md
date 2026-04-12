# Testing Strategy

## Testing Priorities
1. Domain logic（純函數，最易測試）
2. Store actions（Firestore 操作，需要 mock）
3. Critical user flows（手動測試）
4. UI behavior（手動測試）

## 目前狀態
目前無自動化測試框架。所有驗證依賴：
1. TypeScript 型別檢查（`tsc -b`）
2. ESLint（`npm run lint`）
3. 手動功能測試

## 手動測試優先順序

### P0 - Auth 流程
- [ ] Google 登入成功
- [ ] 建立新家庭（`createFamily`）
- [ ] 以管理員邀請碼加入（`joinFamilyByCode`）
- [ ] 以小孩邀請碼加入（`joinFamilyAsKidStep1` + `Step2`）
- [ ] PIN 碼驗證（`setUserPin` + Login.tsx）
- [ ] 登出（`logout`）

### P1 - 核心功能
- [ ] 新增小孩（`addKid` → 自動建立兩個信封）
- [ ] 零用錢設定（`updateKidAllowance`）
- [ ] 零用錢自動發放（`distributeAllowance`，定時觸發）
- [ ] 手動發放（`manualDistributeAllowance`）
- [ ] 新增任務（`createQuest`）
- [ ] 提交任務（`submitQuest`）
- [ ] 審核任務（`approveQuestWithFeedback`）

### P2 - 進階功能
- [ ] 例行任務建立與生成（`addRoutineQuest` + `generateRoutineQuests`）
- [ ] 信封轉帳（`transferMoney`）
- [ ] 寶箱購買與開啟（`purchaseTreasureBox` + `openOwnedBox`）
- [ ] 徽章解鎖（`applyUserRewards` 內的 badge check）
- [ ] 關卡升級顯示（`evaluateLevelFormula`）
- [ ] 利息計算（`calculateInterest`）

### P3 - 設定
- [ ] 時區切換（`updateTimezone`）
- [ ] 貨幣符號（`updateCurrencySymbol`）
- [ ] 主題背景（`updateThemeSettings`）
- [ ] 資料匯出/匯入（`exportFamilyData` / `importFamilyData`）

## 若未來加入測試框架
建議的測試框架：Vitest（與 Vite 整合最佳）
優先測試：`src/domain/` 的所有純函數
- `getNextAllowanceDate` — 日期計算邏輯複雜，最值得測試
- `evaluateLevelFormula` — Formula eval 的 edge cases
- `calculateLevelProgress` — 進度條計算
- `applyUserRewards` — Badge unlock 的複雜條件判斷
