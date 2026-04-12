# Debugging Playbook

## Triage Order
1. 重現問題
2. 縮小模組範圍
3. 找最近變更點
4. 對照 `common-gotchas.md`
5. 檢查 `change-log-for-agents.md` 是否已有相關建議
6. 進行最小修復

## Firebase 相關偵錯

### Firestore 寫入失敗（undefined 欄位）
症狀：`FirebaseError: Function updateDoc() called with invalid data. Unsupported field value: undefined`
解法：確認寫入前已呼叫 `deepClean`，或改用 `updateFamilyField` helper。

### onSnapshot 權限錯誤
症狀：`FirebaseError: Missing or insufficient permissions`
步驟：
1. 確認 user 已登入（`firebaseUser !== null`）
2. 確認 `userFamilyMap/{uid}` 已寫入（`createFamily` / `joinFamily` 時）
3. 確認 `firestore.rules` 規則沒有錯誤語法

### 畫面沒有更新（Firestore 資料已改）
症狀：Firestore 資料正確，但 UI 沒有反映
步驟：
1. 確認 `subscribeToFamily` 有正確設定 onSnapshot
2. 確認 `unsubscribeAll` 沒有提早被呼叫
3. 查看 browser console 是否有 onSnapshot error callback 觸發

### 登入後卡在 loading
症狀：`isLoading: true`，但沒有進入 dashboard
步驟：
1. 確認 `userFamilyMap/{uid}` document 存在
2. 確認 `subscribeToFamily` 被呼叫（家庭 doc 存在）
3. 若 family doc 不存在，`onSnapshot` 不會觸發 → `isLoading` 不會變 false
   → 確認 `setFirebaseUser` 的 catch 有 `set({ isLoading: false })`

## React / TypeScript 偵錯

### TypeScript 型別錯誤（build 失敗）
```bash
tsc -b  # 查看完整錯誤訊息
```
常見原因：
- `noUnusedLocals`：移除未使用的 import / 變數
- `verbatimModuleSyntax`：純型別 import 需要 `import type`
- `strict`：null check 遺漏（需要 `?.` 或 null guard）

### ESLint 錯誤
```bash
npm run lint -- --fix  # 自動修復部分問題
```
常見：`react-hooks/exhaustive-deps` → 補完 useEffect 依賴陣列

## 業務邏輯偵錯

### 零用錢沒有自動發放
1. 確認 `nextAllowanceDate` 正確（比現在早）
2. 確認 `distributeAllowance` 在 App.tsx 的 `checkTasks` 中被呼叫
3. 確認 `currentUser.role === 'primary_admin' || 'co_admin'`
4. 確認 kid 的 `isHidden !== true`

### Quest 完成後獎勵沒有給
1. 確認 `approveQuestWithFeedback` 被呼叫（而非舊的 `approveQuest`）
2. 確認 `applyUserRewards` 有被呼叫（EXP / gems）
3. 確認 `spendableEnv` 存在（kid 必須有 spendable 信封）
