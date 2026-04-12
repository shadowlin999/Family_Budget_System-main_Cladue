# Architecture

## Preferred Layers
UI → Feature → Domain → Data

## 本專案的實際分層

```
Views (UI)
  └─ src/views/*.tsx
     ↓ useStore() hook only
Store (Feature + Data orchestration)
  └─ src/store/index.ts
     ↓ pure function calls
Domain (Business Logic)
  └─ src/domain/*.ts
     ↓ type imports only
Types (Contracts)
  └─ src/types/*.ts

Data (Firebase)
  └─ src/services/firebase.ts  (init only)
     ← imported by store/index.ts
```

## 分層說明

### Views 層（`src/views/`）
- 負責 UI 呈現與使用者互動
- 只透過 `useStore()` 存取資料與觸發 actions
- 不直接 import `firebase/firestore` 或 `firebase/auth`
- 可 import：`../store/index`、`../types/`、`../components/`、lucide-react、@dnd-kit

### Store 層（`src/store/index.ts`）
- Zustand store，管理所有 App 狀態
- 負責 Firestore CRUD 操作
- 呼叫 `src/domain/` 的純函數處理業務計算
- 使用 `onSnapshot` 做 realtime sync

### Domain 層（`src/domain/`）
- 純 TypeScript 函數，無副作用
- 不依賴 Firebase、React 或 Zustand
- 範例：`getNextAllowanceDate`、`evaluateLevelFormula`、`applyUserRewards`

### Types 層（`src/types/`）
- 所有共用 TypeScript 型別的 single source of truth
- 不 import 任何本地模組（除了其他 types/ 的 type-only import）

### Data 層（`src/services/firebase.ts`）
- 只做 Firebase app 初始化
- Export：`auth`、`db`、`googleProvider`
- 不包含任何業務邏輯

## 目前不遵循的分層
Store 層直接包含 Firestore operations（沒有獨立的 repository 層）。
這是刻意的設計選擇——Firestore operations 與 Zustand 狀態高度耦合，
過早分離會增加不必要的複雜度。若未來需要更好的測試性，再考慮拆分。
