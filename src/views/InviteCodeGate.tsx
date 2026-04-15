import React, { useState } from 'react';
import { KeyRound, ArrowRight, LogOut } from 'lucide-react';
import { useStore } from '../store/index';

const InviteCodeGate: React.FC = () => {
  const { verifyAndUseSystemInviteCode, logout, firebaseUser } = useStore();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const ok = await verifyAndUseSystemInviteCode(code);
      if (!ok) setError('邀請碼無效或已被使用，請確認後再試。');
    } catch {
      setError('驗證時發生錯誤，請稍後再試。');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card w-full max-w-sm p-8 flex flex-col items-center gap-6">
        <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center">
          <KeyRound size={32} className="text-primary" />
        </div>

        <div className="text-center">
          <h2 className="text-2xl font-black mb-1">需要邀請碼</h2>
          <p className="text-sm text-muted">
            使用本系統需要有效的邀請碼。<br />
            請向家庭管理員索取。
          </p>
          {firebaseUser?.email && (
            <p className="text-xs text-muted mt-2 opacity-60">
              已登入：{firebaseUser.email}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-3">
          <input
            type="text"
            className="input-field text-center tracking-widest text-lg font-mono uppercase"
            placeholder="輸入邀請碼"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            maxLength={20}
            autoFocus
          />
          {error && (
            <p className="text-red-400 text-sm text-center">{error}</p>
          )}
          <button
            type="submit"
            className="btn btn-primary flex items-center justify-center gap-2"
            disabled={isLoading || !code.trim()}
          >
            {isLoading ? '驗證中...' : <>驗證邀請碼 <ArrowRight size={16} /></>}
          </button>
        </form>

        <button
          className="btn btn-ghost text-sm flex items-center gap-1 opacity-60"
          onClick={() => logout()}
        >
          <LogOut size={14} /> 切換帳號
        </button>
      </div>
    </div>
  );
};

export default InviteCodeGate;
