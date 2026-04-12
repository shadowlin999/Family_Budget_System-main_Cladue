import React, { useState } from 'react';
import { useStore } from '../store/index';
import { Home, Users, Loader, AlertCircle, Baby, CheckCircle2, ChevronRight, User } from 'lucide-react';
import type { Role, User as UserType } from '../store/index';

type Tab = 'create' | 'joinAdmin' | 'joinKid';

const FamilySetup: React.FC = () => {
  const { firebaseUser, createFamily, joinFamilyByCode, joinFamilyAsKidStep1, joinFamilyAsKidStep2, logout } = useStore();
  const [tab, setTab] = useState<Tab>('create');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // ── Create family ──────────────────────────────────────────────
  const [familyName, setFamilyName] = useState('');
  const [myName, setMyName] = useState(firebaseUser?.displayName ?? '');
  const [myRole, setMyRole] = useState<Role>('primary_admin');

  // ── Join as admin ──────────────────────────────────────────────
  const [adminCode, setAdminCode] = useState('');
  const [joinName, setJoinName] = useState(firebaseUser?.displayName ?? '');
  const [joinRole, setJoinRole] = useState<Role>('co_admin');

  // ── Join as kid device (2-step) ────────────────────────────────
  const [kidCode, setKidCode] = useState('');
  const [foundFamily, setFoundFamily] = useState<{ id: string, name: string, kids: UserType[] } | null>(null);

  const submit = async (fn: () => Promise<void>) => {
    setIsSubmitting(true);
    setError('');
    try { 
      await fn(); 
      // If successful, we don't necessarily set isSubmitting false if we're unmounting
    } catch (err: unknown) { 
      console.error(err);
      setError(err instanceof Error ? err.message : '操作失敗'); 
      setIsSubmitting(false); 
    }
  };

  const handleSearchKidFamily = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    try {
      const result = await joinFamilyAsKidStep1(kidCode);
      setFoundFamily({ id: result.familyId, name: result.familyName, kids: result.kids });
      setIsSubmitting(false);
    } catch (err) {
      setError((err as Error)?.message || '找不到該家庭');
      setIsSubmitting(false);
    }
  };

  const handleSelectKidProfile = async (kidId: string) => {
    if (!foundFamily) return;
    submit(() => joinFamilyAsKidStep2(foundFamily.id, kidId));
  };

  const tabs: { id: Tab; label: string; icon: React.ReactNode; color: string }[] = [
    { id: 'create',    label: '建立新家庭', icon: <Home size={16} />,  color: 'primary' },
    { id: 'joinAdmin', label: '管理者加入', icon: <Users size={16} />, color: 'info' },
    { id: 'joinKid',   label: '小孩裝置',   icon: <Baby size={16} />,  color: 'success' },
  ];

  return (
    <div className="flex flex-col items-center justify-center animate-fade-in" style={{ minHeight: '70vh', padding: '1rem' }}>
      <div className="glass-card w-full" style={{ maxWidth: '480px' }}>
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏠</div>
          <h1 className="text-2xl font-extrabold mb-1">設定家庭帳本</h1>
          {firebaseUser && <p className="text-muted text-sm">以 <span className="text-white font-medium">{firebaseUser.email}</span> 登入</p>}
        </div>

        {/* Tabs */}
        <div className="tab-container mb-8">
          {tabs.map(t => (
            <button
              key={t.id}
              className={`tab-btn ${tab === t.id ? 'active' : ''}`}
              onClick={() => { setTab(t.id); setError(''); setFoundFamily(null); }}
            >
              {t.icon}
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm flex items-start gap-3">
            <AlertCircle size={18} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Create Family ──────────────────────────────────── */}
        {tab === 'create' && (
          <form onSubmit={e => { e.preventDefault(); submit(() => createFamily(familyName, myName, myRole)); }} className="flex flex-col gap-5">
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">家庭名稱</label>
              <input type="text" placeholder="例：王氏家庭" className="input-field"
                value={familyName} onChange={e => setFamilyName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">您的名字</label>
              <input type="text" placeholder="例：爸爸 (David)" className="input-field"
                value={myName} onChange={e => setMyName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">您的身份</label>
              <div className="flex gap-3">
                {(['primary_admin', 'co_admin'] as Role[]).map(r => (
                  <button type="button" key={r} onClick={() => setMyRole(r)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${myRole === r ? 'border-primary bg-primary/20 text-primary' : 'border-white/10 text-muted hover:border-white/20'}`}>
                    {r === 'primary_admin' ? '主管理者' : '共同管理者'}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-2">
              {isSubmitting ? <Loader size={20} className="animate-spin" /> : <CheckCircle2 size={20} />}
              {isSubmitting ? '正在建立...' : '建立家庭帳本'}
            </button>
            <p className="text-xs text-muted text-center leading-relaxed px-4">
              建立後系統會自動產生「邀請碼」，您可以隨時在首頁控制台查看。
            </p>
          </form>
        )}

        {/* ── Join as Admin ──────────────────────────────────── */}
        {tab === 'joinAdmin' && (
          <form onSubmit={e => { e.preventDefault(); submit(() => joinFamilyByCode(adminCode, joinName, joinRole)); }} className="flex flex-col gap-5">
            <div className="p-4 rounded-xl bg-info/10 border border-info/20 text-xs text-info leading-relaxed">
              💡 請向家庭主管理者索取「<strong>管理碼</strong>」（藍色），這是供家長使用的身分。
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">管理員邀請碼</label>
              <input type="text" placeholder="例：A1B2C3" className="input-field tracking-[0.2em] font-mono text-center uppercase"
                value={adminCode} onChange={e => setAdminCode(e.target.value.toUpperCase())} required maxLength={6} />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">您的名字</label>
              <input type="text" placeholder="例：媽媽 (Amy)" className="input-field"
                value={joinName} onChange={e => setJoinName(e.target.value)} required />
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">您的身份</label>
              <div className="flex gap-3">
                {(['co_admin', 'primary_admin'] as Role[]).map(r => (
                  <button type="button" key={r} onClick={() => setJoinRole(r)}
                    className={`flex-1 py-3 rounded-xl text-sm font-bold border transition-all ${joinRole === r ? 'border-info bg-info/20 text-info' : 'border-white/10 text-muted hover:border-white/20'}`}>
                    {r === 'primary_admin' ? '主管理者' : '共同管理者'}
                  </button>
                ))}
              </div>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-2" style={{ background: 'var(--color-info)' }}>
              {isSubmitting ? <Loader size={20} className="animate-spin" /> : <Users size={20} />}
              {isSubmitting ? '加入中...' : '加入為家長'}
            </button>
          </form>
        )}

        {/* ── (NEW 2-Step) Join as Kid Device ─────────────────────────── */}
        {tab === 'joinKid' && !foundFamily && (
          <form onSubmit={handleSearchKidFamily} className="flex flex-col gap-5">
            <div className="p-4 rounded-xl bg-success/10 border border-success/20 text-xs text-success leading-relaxed">
              🧒 請向家長索取「<strong>小孩碼</strong>」（綠色）。<br/>輸入後您將可以選擇自己的身分進行綁定。
            </div>
            <div>
              <label className="text-xs font-bold text-muted uppercase tracking-wider ml-1 mb-2 block">小孩邀請碼</label>
              <input type="text" placeholder="例：X7Y8Z9" className="input-field tracking-[0.2em] font-mono text-center uppercase"
                value={kidCode} onChange={e => setKidCode(e.target.value.toUpperCase())} required maxLength={6} />
            </div>
            <button type="submit" disabled={isSubmitting} className="btn btn-primary w-full mt-2" style={{ background: 'var(--color-success)' }}>
              {isSubmitting ? <Loader size={20} className="animate-spin" /> : <ChevronRight size={20} />}
              {isSubmitting ? '搜尋中...' : '搜尋家庭'}
            </button>
          </form>
        )}

        {tab === 'joinKid' && foundFamily && (
          <div className="flex flex-col gap-6 animate-fade-in">
            <div className="text-center p-4 rounded-xl bg-white/5 border border-white/10">
              <p className="text-xs text-muted uppercase font-bold tracking-widest mb-1">已找到家庭</p>
              <h2 className="text-xl font-extrabold text-success">{foundFamily.name}</h2>
            </div>

            <div>
              <p className="text-sm font-bold mb-4 text-center">請問你是哪位小朋友？</p>
              <div className="grid gap-3">
                {foundFamily.kids.length === 0 ? (
                  <p className="text-center text-xs text-warning p-4 bg-warning/10 rounded-lg">
                     此家庭尚未建立任何小孩帳號。請先請家長幫你新增成員。
                  </p>
                ) : (
                  foundFamily.kids.map(kid => (
                    <button
                      key={kid.id}
                      disabled={isSubmitting}
                      onClick={() => handleSelectKidProfile(kid.id)}
                      className="flex items-center justify-between p-4 rounded-xl border border-white/10 bg-white/5 hover:bg-success/20 hover:border-success/50 transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center text-success">
                          <User size={20} />
                        </div>
                        <span className="font-bold text-lg">{kid.name}</span>
                      </div>
                      <ChevronRight size={18} className="text-muted group-hover:text-success transform group-hover:translate-x-1 transition-all" />
                    </button>
                  ))
                )}
              </div>
            </div>

            <button 
              onClick={() => setFoundFamily(null)} 
              className="text-xs text-muted hover:text-white transition"
              disabled={isSubmitting}
            >
              ← 重新輸入代碼
            </button>
          </div>
        )}

        {firebaseUser && (
          <button onClick={() => logout()} className="mt-8 pt-4 w-full border-t border-white/5 text-xs text-muted hover:text-white text-center transition">
             登出目前 Google 帳號 ({firebaseUser.email})
          </button>
        )}
      </div>
    </div>
  );
};

export default FamilySetup;
