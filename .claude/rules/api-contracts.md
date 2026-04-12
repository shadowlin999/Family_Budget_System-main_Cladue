# API Contracts Rules

## Firestore 存取規則
- 所有 Firestore 讀寫必須透過 `src/store/index.ts` 提供的 actions
- 不要在 view component（`src/views/`）直接使用 `firebase/firestore` import
- `src/services/firebase.ts` 只負責初始化 Firebase app，不做業務邏輯

## 資料型別規範
- Quest、Transaction 的欄位定義以 `src/types/` 為 single source of truth
- 不要在 view 或 store 以外的地方重新定義這些型別
- 若需要 Partial 或 Omit 版本，從 `src/types/` 的 base 型別推導

## Firestore Collections
- `families/{familyId}` — 家庭文件，包含 users、envelopes、routineQuests 等陣列欄位
- `quests/{questId}` — 任務 sub-collection（以 familyId 欄位關聯家庭）
- `transactions/{txId}` — 交易 sub-collection（以 familyId 欄位關聯家庭）
- `userFamilyMap/{uid}` — Google UID 對應 familyId 的 junction map

## 改動 Response Shape
- 改動 FamilyDoc 欄位前，先評估所有 views 中對該欄位的使用
- 新增欄位使用 optional 標記，避免破壞現有快照讀取
