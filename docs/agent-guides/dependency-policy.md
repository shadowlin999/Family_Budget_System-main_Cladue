# Dependency Policy

## Default Rule
能用現有依賴或少量本地程式完成，就不要新增第三方套件。

## 現有依賴（已確認使用）

### Runtime
| 套件 | 用途 |
|------|------|
| `react` + `react-dom` | UI framework |
| `react-router-dom` | 路由 |
| `firebase` | Firestore + Auth |
| `zustand` | 全域狀態管理 |
| `@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities` | 拖放排序 |
| `lucide-react` | Icon library |
| `uuid` | UUID 生成 |
| `date-fns` | 日期工具（已安裝但目前未大量使用） |

### Dev
| 套件 | 用途 |
|------|------|
| `vite` + `@vitejs/plugin-react` | Bundler |
| `typescript` | 型別檢查 |
| `tailwindcss` + `postcss` + `autoprefixer` | CSS |
| `eslint` + plugins | Linting |

## 新增套件的原則
1. 先確認現有套件無法完成
2. 選擇 bundle size 小、維護活躍的套件
3. 不要新增第二個狀態管理工具（已有 Zustand）
4. 不要新增第二個 CSS-in-JS 工具（已有 Tailwind）
5. 提案記錄到 `change-log-for-agents.md`，確認後再安裝

## 禁止新增
- 另一個 HTTP client（Firebase SDK 已處理所有後端通訊）
- 日期時間 parsing 以外的日期庫（date-fns 已安裝）
- Testing framework（目前 TBD，等待確認）
