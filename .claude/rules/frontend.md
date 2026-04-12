# Frontend Rules

適用於 React component / view / hook / UI 相關任務。

## Current Status
Frontend stack: React 19 + Vite + TypeScript + TailwindCSS

## 架構限制
- 不在 view（`src/views/`）直接 import `firebase/firestore`
- 所有資料存取透過 `useStore()` hook（Zustand store）
- view 可以 import from：`../store/index`、`../components/`、`../types/`、`lucide-react`、`@dnd-kit/`

## CSS 規範
- 共用 CSS class（`glass-card`、`btn`、`btn-primary`、`btn-ghost`、`input-field`、`badge` 等）定義在 `src/index.css`
- 不要在 component 中大量 inline 重複 Tailwind class；可萃取成局部常數（如 `const BTN = '...'`）
- 最小 touch target：44px（`var(--touch-min)`）
- 所有顯示金額的字串必須使用 `currencySymbol`（從 `useStore()` 取得）

## React 慣例
- Function components + TypeScript interface props
- 使用 `useState`、`useMemo`、`useRef` 等 React hooks
- 避免 `useEffect` 依賴陣列遺漏（遵循 react-hooks/exhaustive-deps）
- Drag-and-drop 使用 `@dnd-kit/core` + `@dnd-kit/sortable`

## 路由
- 使用 `react-router-dom` v7
- 路由結構：`/` → Login/redirect；`/parent/*` → ParentDashboard；`/kid/*` → KidDashboard
