import React, { useState } from 'react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../services/firebase';
import { useStore } from '../store/index';
import type { User } from '../store/index';
import { Users, User as UserIcon, Loader, ChevronRight, LogOut } from 'lucide-react';

const Login: React.FC = () => {
  const { firebaseUser, familyId, familyName, users, login, isLoading, logout } = useStore();
  const [authLoading, setAuthLoading] = useState(false);
  const [error, setError] = useState('');
  const [verifyingUser, setVerifyingUser] = useState<User | null>(null);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const handleProfileClick = (user: User) => {
    setVerifyingUser(user);
    setPinInput('');
    setPinError('');
  };

  const handlePinSubmit = () => {
    if (!verifyingUser) return;
    const expectedPin = verifyingUser.pin || '0000';
    if (pinInput === expectedPin) {
      login(verifyingUser.id);
    } else {
      setPinError('PIN 碼錯誤，請再試一次');
      setPinInput('');
    }
  };

  const handleGoogleLogin = async () => {
    setAuthLoading(true);
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '登入失敗，請再試一次');
    } finally {
      setAuthLoading(false);
    }
  };

  // ─── Firebase NOT logged in ───────────────────────────
  if (!firebaseUser) {
    return (
      <div className="flex flex-col items-center justify-center animate-fade-in" style={{ minHeight: '80vh', padding: '1rem' }}>
        <div className="glass-card w-full text-center" style={{ maxWidth: '420px' }}>
          <div className="text-6xl mb-6">💰</div>
          <h1 className="text-3xl font-extrabold mb-2 tracking-tight">家庭預算系統</h1>
          <p className="text-muted mb-10 leading-relaxed px-4">使用 Google 帳號登入，即可開始管理家庭財務、任務與預算獎勵。</p>

          {error && (
            <div className="mb-6 p-4 rounded-xl bg-error/10 border border-error/20 text-error text-sm text-left">
               {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={authLoading || isLoading}
            className="btn btn-primary w-full flex items-center justify-center gap-3 py-4 text-lg"
          >
            {authLoading || isLoading ? (
              <Loader size={20} className="animate-spin" />
            ) : (
              <div className="bg-white p-1 rounded-full"><svg width="18" height="18" viewBox="0 0 18 18">
                <path fill="#4285F4" d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 0 0 2.38-5.88c0-.57-.05-.66-.15-1.18z"/>
                <path fill="#34A853" d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 0 1-7.18-2.54H1.83v2.07A8 8 0 0 0 8.98 17z"/>
                <path fill="#FBBC05" d="M4.5 10.52a4.8 4.8 0 0 1 0-3.04V5.41H1.83a8 8 0 0 0 0 7.18l2.67-2.07z"/>
                <path fill="#EA4335" d="M8.98 4.18c1.17 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 0 0 1.83 5.4L4.5 7.49a4.77 4.77 0 0 1 4.48-3.3z"/>
              </svg></div>
            )}
            {authLoading || isLoading ? '正在登入...' : '使用 Google 帳號登入'}
          </button>

          <p className="mt-8 text-xs text-muted leading-relaxed px-6">
            本系統專為家庭理財教育設計，資料同步加密儲存於雲端 Firestore。
          </p>
        </div>
      </div>
    );
  }

  // ─── PIN Verification View ────────────────────────────
  if (verifyingUser) {
    return (
      <div className="flex flex-col items-center justify-center animate-fade-in" style={{ minHeight: '80vh', padding: '1rem' }}>
        <div className="glass-card w-full text-center relative" style={{ maxWidth: '420px' }}>
          <button onClick={() => setVerifyingUser(null)} className="absolute left-6 top-6 text-muted hover:text-white transition">← 返回</button>
          
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-3xl mx-auto mt-6 mb-4 border-2 border-primary/20 shadow-[0_0_20px_rgba(99,102,241,0.15)]">
            {verifyingUser.name.charAt(0)}
          </div>
          <h1 className="text-2xl font-black mb-1">{verifyingUser.name}</h1>
          <p className="text-sm text-muted mb-8 italic">請輸入您的 4 位數認證碼</p>

          <div className="flex justify-center gap-3 mb-8">
            {[0, 1, 2, 3].map(i => (
              <div key={i} className={`w-12 h-16 rounded-2xl border-2 flex items-center justify-center text-3xl font-black transition-all ${pinInput.length > i ? 'border-primary bg-primary/10 text-primary shadow-[0_0_15px_rgba(99,102,241,0.3)]' : 'border-white/10 bg-white/5 text-muted'}`}>
                {pinInput.length > i ? '•' : ''}
              </div>
            ))}
          </div>

          {pinError && <p className="text-red-400 text-sm font-bold mb-6 animate-shake">⚠️ {pinError}</p>}

          <div className="grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => pinInput.length < 4 && setPinInput(p => p + num)} className="py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-xl font-bold">
                {num}
              </button>
            ))}
            <button onClick={() => setPinInput('')} className="py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-red-500/10 hover:border-red-500/20 text-red-400 font-bold transition-all">
              重設
            </button>
            <button onClick={() => pinInput.length < 4 && setPinInput(p => p + '0')} className="py-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/20 active:scale-95 transition-all text-xl font-bold">
              0
            </button>
            <button onClick={handlePinSubmit} disabled={pinInput.length !== 4} className={`py-4 rounded-2xl font-bold transition-all ${pinInput.length === 4 ? 'bg-primary text-white shadow-lg active:scale-95' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}>
              確認
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Firebase logged in, family found — SELECT IDENTITY ─────────
  if (familyId) {
    const parents = users.filter(u => u.role === 'primary_admin' || u.role === 'co_admin');
    const kids = users.filter(u => u.role === 'kid' && !u.isHidden);

    return (
      <div className="flex flex-col items-center justify-center animate-fade-in" style={{ minHeight: '80vh', padding: '1rem' }}>
        <div className="mb-8 text-center">
          <p className="text-xs text-muted uppercase font-bold tracking-[0.2em] mb-2">{familyName || '家庭資料已同步'}</p>
          <h1 className="text-3xl font-extrabold mb-3">歡迎回來！你是誰呢？</h1>
          <p className="text-muted text-sm px-6">目前登入帳號：<span className="text-white">{firebaseUser.email}</span></p>
        </div>

        <div className="w-full flex flex-col gap-6" style={{ maxWidth: '440px' }}>
          {parents.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-bold text-muted flex items-center gap-2 uppercase tracking-wider ml-1">
                <Users size={18} className="text-primary" /> 管理者
              </h2>
              <div className="grid gap-2">
                {parents.map(p => (
                  <button key={p.id} 
                    className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-primary/20 hover:border-primary/50 transition-all group" 
                    onClick={() => handleProfileClick(p)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                        {p.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-lg">{p.name}</div>
                        <div className="text-xs text-muted">管理家庭所有帳本與任務</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.googleUid === firebaseUser?.uid && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">目前帳號</span>
                      )}
                      <ChevronRight size={20} className="text-muted group-hover:text-primary transition-all mr-1" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {kids.length > 0 && (
            <div className="flex flex-col gap-3">
              <h2 className="text-base font-bold text-muted flex items-center gap-2 uppercase tracking-wider ml-1 mt-2">
                <UserIcon size={18} className="text-success" /> 孩子
              </h2>
              <div className="grid gap-2">
                {kids.map(k => (
                  <button key={k.id} 
                    className="flex items-center justify-between p-5 rounded-2xl border border-white/10 bg-white/5 hover:bg-success/20 hover:border-success/50 transition-all group" 
                    onClick={() => handleProfileClick(k)}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-success/20 flex items-center justify-center text-success font-bold text-xl">
                        {k.name.charAt(0)}
                      </div>
                      <div className="text-left">
                        <div className="font-bold text-lg">{k.name}</div>
                        <div className="text-xs text-muted">查看零用錢、信封與完成任務</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {k.googleUid === firebaseUser?.uid && (
                        <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">目前帳號</span>
                      )}
                      <span className="badge badge-success">Lv.{k.level}</span>
                      <ChevronRight size={20} className="text-muted group-hover:text-success transition-all" />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <button onClick={() => logout()} className="mt-8 flex items-center justify-center gap-2 text-xs text-muted hover:text-white transition group py-4 border-t border-white/5">
            <LogOut size={14} className="group-hover:text-error transition" /> 切換其他 Google 帳號
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-[50vh]">
       <Loader size={30} className="animate-spin text-primary" />
    </div>
  );
};

export default Login;
