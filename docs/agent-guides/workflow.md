# Workflow

## Current Validation Commands
- Lint: npm run lint
- Typecheck: tsc -b
- Test: TBD（無測試框架）
- Build: npm run build

## 開發流程

### 本地開發
```bash
npm install
cp .env.example .env.local  # 填入 Firebase 設定
npm run dev
```

### 驗證變更
```bash
npm run lint   # ESLint（含 TypeScript、react-hooks 規則）
tsc -b         # TypeScript 嚴格型別檢查
npm run build  # Vite production build（同時執行 tsc -b）
```

### 部署
```bash
npm run build
firebase deploy  # 需要先 firebase login
```

## Unknown Command Policy
若命令仍是 TBD：
- 先從 `package.json`、Makefile、CI workflow 推斷
- 將建議寫入 `change-log-for-agents.md`
- 不要在未確認前把猜測當正式命令

## 注意事項
- `npm run build` 包含 `tsc -b && vite build`，TypeScript 錯誤會讓 build 失敗
- Firebase Hosting 部署需要 `.firebaserc` 設定正確的 project ID
- 本地測試需要在 `.env.local` 填入真實的 Firebase config
