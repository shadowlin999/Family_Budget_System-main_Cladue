# Coding Conventions

## 通用原則
- 可讀性優先於炫技
- 明確優先於隱式
- 小步修改優先於一次大改
- 重用優先於重寫
- 簡單直接優先於過度抽象

## TypeScript
- 使用嚴格模式（`strict: true`）
- 優先使用 `interface` 而非 `type`（對 object shape）
- 使用 `type` 做 union type（如 `Role`、`QuestStatus`）
- `import type` 用於只在型別位置使用的 import

## React
- Function components + TypeScript interface props
- 局部常數用大寫（如 `const BTN = '...'`，`const INPUT = '...'`）表示 Tailwind class 字串
- 避免 inline object 作為 prop（會導致不必要的 re-render）
- 使用 `useMemo` 做昂貴計算的 memoization

## CSS / Tailwind
- 共用 class 定義在 `src/index.css`（`glass-card`、`btn`、`input-field` 等）
- 組件內部可以定義局部常數 `const BTN = '...'` 避免重複
- 最小 touch target：44px（`var(--touch-min)`）
- 不要使用 `!important`（除非處理第三方組件）

## 命名慣例
- Components：PascalCase（`ParentDashboard`、`EmojiInput`）
- Hooks / functions：camelCase（`useStore`、`getNextAllowanceDate`）
- Types / interfaces：PascalCase（`User`、`FamilyDoc`、`QuestStatus`）
- Firestore collections：小寫複數（`families`、`quests`、`transactions`）
- Store actions：動詞 + 名詞（`addKid`、`approveQuest`、`updateFamilyName`）

## 本專案特有慣例
- 金額顯示：使用 `{currencySymbol}{amount}` 格式，`currencySymbol` 從 `useStore()` 取得
- 日期：使用 ISO string（`new Date().toISOString()`）存 Firestore；顯示時再格式化
- 寶石/EXP 計算：使用 `applyUserRewards` domain 函數（統一處理 badge unlock）
- Quest 審核：使用 `approveQuestWithFeedback`（multiplier 參數）而非直接金額
