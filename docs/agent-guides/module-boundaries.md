# Module Boundaries

## 規則總覽

```
views/          → 可以 import from：store/, components/, types/, lucide-react, @dnd-kit
                  禁止 import from：firebase/firestore, firebase/auth, domain/（直接）

store/          → 可以 import from：types/, domain/, services/firebase
                  禁止 import from：views/, components/

domain/         → 可以 import from：types/（type-only）
                  禁止 import from：store/, services/, views/, firebase, react, zustand

types/          → 可以 import from：其他 types/（type-only）
                  禁止 import from：所有本地非 types/ 模組

services/       → 只有 firebase.ts，初始化 Firebase
                  可以 import from：firebase SDK
                  禁止 import from：store/, views/, domain/

components/     → 可以 import from：react, lucide-react, types/
                  禁止 import from：store/, firebase, domain/
```

## UI 不直接碰資料庫
View component 不應該有任何 `firebase/firestore` 的 import。
所有資料操作透過 `useStore()` 的 actions。

## Domain 不依賴 UI framework
`src/domain/` 中的函數是純 TypeScript，不依賴 React、Zustand 或 Firebase。
這確保它們可以在任何環境測試，也方便未來遷移。

## Types 是底層
`src/types/` 不應該 import 任何業務邏輯或 framework。
它只定義資料結構（interface / type）。

## 允許的跨層 import 路徑

### views → store
```ts
import { useStore } from '../store/index';
import type { AppState } from '../store/index';
```

### views → types（型別用途）
```ts
import type { User, Quest, AllowancePeriod } from '../types';
```

### store → domain
```ts
import { getNextAllowanceDate } from '../domain/allowance';
import { applyUserRewards } from '../domain/level';
```

### store → types
```ts
import type { User, FamilyDoc, Quest } from '../types';
```

## 反模式（Prohibited Patterns）
```ts
// ❌ view 直接用 Firestore
import { updateDoc } from 'firebase/firestore'; // in views/

// ❌ domain 用 firebase
import { db } from '../services/firebase'; // in domain/

// ❌ types 有業務邏輯
export function calculateLevel(exp: number) { ... } // in types/

// ❌ components 用 store
import { useStore } from '../store'; // in components/DigitalClock.tsx
```
