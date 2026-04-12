# Backend Rules

適用於 Firebase / Firestore / Auth / store 相關任務。

## Current Status
Backend stack: Firebase (Firestore + Auth)

## Firebase 規則
- 永遠不要修改 `firestore.rules` 中已有的規則；改用 additive 方式（新增 match 區塊）
- 新規則不要縮窄現有已授予的權限，避免破壞線上使用者
- Security model：目前所有 authenticated user 均可讀寫；app 層面由 role 控制

## Firestore 寫入規範
- 寫入前必須用 `deepClean` 清除 undefined 欄位（`deepClean` 已在 `src/store/index.ts` 實作）
- 所有 family doc 的更新透過 `updateFamilyField(familyId, data)` helper
- 需要 atomic 操作時使用 `writeBatch`

## Realtime Sync
- 使用 `onSnapshot` 做 realtime 監聽（family doc、quests、transactions）
- fetch-only 操作用 `getDoc` / `getDocs`（如 joinFamilyByCode）
- `subscribeToFamily` 負責設定所有 onSnapshot；`unsubscribeAll` 清除

## Firebase Auth
- 只使用 Google Sign-In（`GoogleAuthProvider`）
- `onAuthStateChanged` 在 App.tsx 中監聽，並觸發 `setFirebaseUser`
- `userFamilyMap` collection 記錄 Google UID → familyId 的對應
