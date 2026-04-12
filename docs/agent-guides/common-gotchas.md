# Common Gotchas

## Frontend

### 不要在 view 直接 import firebase/firestore
錯誤示範：
```tsx
// src/views/ParentDashboard.tsx
import { updateDoc, doc } from 'firebase/firestore'; // ❌ 禁止
```
正確做法：
```tsx
const { updateKid } = useStore(); // ✅ 透過 store action
```

**例外**：`src/views/Login.tsx` 直接使用 `signInWithPopup` from `firebase/auth`，
這是已知的架構例外——Google Sign-In popup 是純 UI 觸發行為，可接受直接使用。
若未來需要嚴格遵守 module boundary，可將 `signInWithGoogle` action 移進 store。

### 金額顯示必須使用 currencySymbol
```tsx
const { currencySymbol } = useStore();
// ...
<span>{currencySymbol}{amount}</span>  // ✅
<span>NT${amount}</span>               // ❌ 硬編碼
```

### approveQuestWithFeedback 使用乘數（mult）而非直接金額
```ts
// expMult / moneyMult / gemMult 是乘數（0.0 ~ 2.0），不是金額
approveQuestWithFeedback(questId, grade, emoji, comment, 1.0, 1.0, 1.0)
// 實際獎勵 = quest.expReward * expMult（在 store 內計算）
```

### ownedBoxes 是 OwnedBoxInstance[]，不是 boxId[]
```ts
// 錯誤理解：ownedBoxes: string[]
// 正確型別：
interface OwnedBoxInstance {
  instanceId: string; // 唯一 per 獲得的寶箱
  boxId: string;
  boxName: string;
  obtainedAt: string;
}
```

### joinFamilyAsKid 有舊版和新版，只用新版（2-step）
```ts
// 舊版（deprecated，保留向後相容）
joinFamilyAsKid(kidCode)

// 新版（使用這個）
const result = await joinFamilyAsKidStep1(kidCode);
// result: { familyId, familyName, kids }
await joinFamilyAsKidStep2(familyId, kidUserId);
```

## Backend / Firestore

### 寫入前必須 deepClean（清除 undefined）
Firestore 不接受 `undefined` 值。`updateFamilyField` 內部已呼叫 `deepClean`。
若直接用 `updateDoc`，要確保資料沒有 undefined 欄位。

### onSnapshot 的 currentUser 同步
`subscribeToFamily` 會在 family doc 更新時自動找到 `currentUser` 的最新版本：
```ts
const freshCurrentUser = prevCurrentUser
  ? users.find(u => u.id === prevCurrentUser.id) ?? prevCurrentUser
  : null;
```
不要直接從 local state 讀 `currentUser.gems` 然後手動加減；讓 onSnapshot 更新。

### Quest 在不同 collection
Quest 使用獨立的 `quests` collection（不是 family doc 子陣列）。
Routine quest 的*範本*在 `family.routineQuests`；*生成的 instance* 在 `quests` collection。

### createQuest 使用 `families/{familyId}/quests` 路徑
```ts
await addDoc(collection(db, `families/${familyId}/quests`), newQuest);
// 注意：subscribeToFamily 用的是 query(collection(db, 'quests'), where('familyId', '==', fid))
// 兩者都能找到（Firestore 支援 collection group query）
```

## TypeScript

### noUnusedLocals / noUnusedParameters 嚴格模式
tsconfig 開啟了這兩個選項，未使用的變數/參數會造成型別錯誤（build 失敗）。
用 `_` 前綴標記有意不使用的參數：`(_unused: string) => ...`

### verbatimModuleSyntax
必須使用 `import type` 做型別-only import：
```ts
import type { User } from '../types/user'; // ✅
import { User } from '../types/user';      // ❌ 若 User 只用於型別
```
