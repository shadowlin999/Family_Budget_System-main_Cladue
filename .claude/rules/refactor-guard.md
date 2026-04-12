# Refactor Guard Rules

## 一般原則
- 先做最小功能修改，再做小幅重構
- 不要把功能交付與大規模翻新綁在同一步
- 若只是看到結構不理想，先記錄與提案，不要直接擴大範圍

## Store 相關
- `src/store/index.ts` 是核心；改動前確認對 `subscribeToFamily` 無副作用
- `subscribeToFamily` 的 onSnapshot handler 負責同步所有家庭狀態，任何欄位的 defaulting 邏輯都在這裡
- 不要新增第三方狀態管理套件（已有 Zustand）
- 不要把 Firestore operations 從 store 移出（它們與狀態高度耦合，移出會增加複雜度）

## 新增功能的優先順序
1. 優先在 `src/domain/` 加純函數（不依賴 Firebase/React）
2. 再由 `src/store/index.ts` 呼叫 domain 函數
3. view 透過 `useStore()` 使用 store 提供的 actions

## 禁止操作
- 不要在 view 中寫 Firestore 業務邏輯
- 不要在 domain/ 中 import firebase、zustand 或 react
- 不要在 types/ 中 import 任何本地模組（只允許其他 types/ 的 type-only import）
