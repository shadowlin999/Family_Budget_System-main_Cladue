# Migrations Rules

## Firestore Schema 遷移原則
- 不要刪除 Firestore 既有欄位；採 additive migration（只新增，不刪除）
- 新欄位在對應 interface（如 `FamilyDoc`）中加上 optional 標記（`?`）
- Migration 邏輯在 `subscribeToFamily` 的 `onSnapshot` handler 中以 defaulting 方式處理：
  ```ts
  currencySymbol: data.currencySymbol ?? 'NT$',
  timezoneOffset: data.timezoneOffset ?? 480,
  ```

## 新增欄位流程
1. 在 `src/types/family.ts`（或對應 types 檔）新增 optional 欄位
2. 在 `subscribeToFamily` onSnapshot handler 加上 `?? defaultValue`
3. 在對應的 action 中加入寫入邏輯
4. 在 `src/store/index.ts` 的 `AppState` 中加入對應狀態欄位（如需要）

## 禁止操作
- 不要在 migration 中刪除既有 Firestore document 欄位
- 不要使用 `setDoc` 覆蓋整個 family document（除非是 createFamily）；改用 `updateDoc` / `updateFamilyField`
- 不要在沒有 backfill 計畫的情況下將欄位從 optional 改為 required
