# Project Map

## Purpose
以訓練小孩經濟與習慣紀律的有趣家庭預算系統
主要使用者：家長與小孩

## Top-Level Structure
```
Family_Budget_System-main_Claude/
├── src/
│   ├── types/            ← 所有 TypeScript 型別定義（index.ts re-exports 全部）
│   │   ├── user.ts         (Role, AllowanceSettings, User, OwnedBoxInstance)
│   │   ├── quest.ts        (QuestStatus, QuestFeedback, Quest, RoutineQuest)
│   │   ├── envelope.ts     (EnvelopeType, Envelope, Transaction, ExpenseCategory)
│   │   ├── gamification.ts (BadgeConditionType, BadgeCondition, Badge, TreasureBoxItem, TreasureBox, TreasureClaim)
│   │   ├── family.ts       (AllowancePeriod, FamilyDoc)
│   │   └── index.ts        (re-exports all types)
│   ├── domain/           ← 純業務邏輯（不依賴 Firebase/React）
│   │   ├── allowance.ts    (getNextAllowanceDate)
│   │   ├── level.ts        (evaluateLevelFormula, calculateExpToNextLevel, calculateLevelProgress, applyUserRewards)
│   │   └── invite.ts       (generateInviteCode)
│   ├── services/
│   │   └── firebase.ts     ← Firebase 初始化（auth, db, googleProvider）
│   ├── store/
│   │   └── index.ts        ← Zustand store（AppState, 所有 actions, Firestore 操作）
│   ├── components/
│   │   ├── DigitalClock.tsx
│   │   └── EmojiInput.tsx
│   ├── views/
│   │   ├── Login.tsx
│   │   ├── FamilySetup.tsx
│   │   ├── ParentDashboard.tsx
│   │   ├── KidDashboard.tsx
│   │   └── GamificationAdmin.tsx
│   ├── App.tsx
│   ├── main.tsx
│   ├── index.css           ← 設計系統（glass-card, btn, input-field 等）
│   └── App.css
├── scripts/
│   ├── discover-context.sh
│   ├── promote-confirmed-context.sh
│   └── setup-semi-auto-claude-repo.sh
├── docs/
│   └── agent-guides/       ← 本目錄
├── .claude/
│   ├── settings.json
│   └── rules/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── CLAUDE.md
├── firebase.json
├── firestore.rules
├── .firebaserc
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── tailwind.config.js
├── postcss.config.js
└── eslint.config.js
```

## Key Files

### src/store/index.ts
最核心的檔案。包含：
- `AppState` interface（所有 app 狀態欄位）
- Firestore helpers（`familyRef`、`deepClean`、`updateFamilyField`）
- `useStore` Zustand store（所有 actions）
- `subscribeToFamily`（onSnapshot 監聽三個 collections）

### src/types/
所有共用型別的 single source of truth。views 和 store 都從這裡 import 型別。

### src/domain/
純函數，不依賴 Firebase 或 React。可以單獨測試。

### src/views/ParentDashboard.tsx
家長端主要介面，包含：零用錢管理、任務審核、小孩管理、信封管理、歷史記錄等。

### src/views/KidDashboard.tsx
小孩端介面，包含：信封餘額、任務列表、寶石/等級顯示、寶箱開啟等。
