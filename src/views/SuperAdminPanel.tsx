import React, { useState, useEffect, useCallback } from 'react';
import {
  Shield, Key, Plus, Trash2, RefreshCw,
  Copy, Check, Crown, Star, Home, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useStore } from '../store/index';
import type { FamilySummary, InviteCode, SystemAdmin, SystemAdminRole } from '../store/index';

type AdminTab = 'families' | 'invites' | 'admins';

const ROLE_LABEL: Record<SystemAdminRole, string> = {
  super: '⭐ 超級管理者',
  senior: '🔑 高級管理者',
};

const SuperAdminPanel: React.FC = () => {
  const {
    systemAdminRole, firebaseUser,
    generateSystemInviteCode, listAllInviteCodes,
    listAllFamilies, listSystemAdmins,
    setSystemAdmin, removeSystemAdmin, updateAdminQuota,
  } = useStore();

  const [tab, setTab] = useState<AdminTab>('families');
  const [families, setFamilies] = useState<FamilySummary[]>([]);
  const [inviteCodes, setInviteCodes] = useState<InviteCode[]>([]);
  const [admins, setAdmins] = useState<SystemAdmin[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // New admin form
  const [newAdminUid, setNewAdminUid] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminRole, setNewAdminRole] = useState<SystemAdminRole>('senior');
  const [newAdminQuota, setNewAdminQuota] = useState('10');

  // Expanded family rows
  const [expandedFamily, setExpandedFamily] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      if (tab === 'families') setFamilies(await listAllFamilies());
      else if (tab === 'invites') setInviteCodes((await listAllInviteCodes()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      else if (tab === 'admins' && systemAdminRole === 'super') setAdmins(await listSystemAdmins());
    } finally {
      setIsLoading(false);
    }
  }, [tab, systemAdminRole, listAllFamilies, listAllInviteCodes, listSystemAdmins]);

  useEffect(() => { refresh(); }, [refresh]);

  const handleGenerateCode = async () => {
    const code = await generateSystemInviteCode();
    if (!code) {
      alert('邀請碼產生失敗（可能已達配額上限）');
      return;
    }
    await refresh();
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleAddAdmin = async () => {
    if (!newAdminUid.trim() || !newAdminEmail.trim()) {
      alert('請填寫 UID 與 Email');
      return;
    }
    await setSystemAdmin(
      newAdminUid.trim(), newAdminEmail.trim(), newAdminRole,
      newAdminRole === 'senior' ? Number(newAdminQuota) : undefined,
    );
    setNewAdminUid(''); setNewAdminEmail('');
    await refresh();
  };

  const handleRemoveAdmin = async (uid: string) => {
    if (uid === firebaseUser?.uid) { alert('不能移除自己'); return; }
    if (!confirm('確定要移除此管理者？')) return;
    await removeSystemAdmin(uid);
    await refresh();
  };

  const handleUpdateQuota = async (uid: string, quota: string) => {
    const n = quota === '' ? undefined : Number(quota);
    await updateAdminQuota(uid, n);
    await refresh();
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-20">
      <div className="flex items-center gap-3 mb-6">
        <Shield size={28} className="text-primary" />
        <div>
          <h1 className="text-2xl font-black">系統管理員面板</h1>
          <p className="text-xs text-muted">
            {systemAdminRole === 'super' ? ROLE_LABEL.super : ROLE_LABEL.senior}
            {firebaseUser?.email && <span className="ml-2 opacity-60">{firebaseUser.email}</span>}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {([['families', Home, '家庭總覽'], ['invites', Key, '邀請碼'], ['admins', Crown, '管理者']] as const).map(([id, Icon, label]) => {
          if (id === 'admins' && systemAdminRole !== 'super') return null;
          return (
            <button
              key={id}
              className={`btn flex items-center gap-1.5 ${tab === id ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setTab(id)}
            >
              <Icon size={15} /> {label}
            </button>
          );
        })}
        <button className="btn btn-ghost ml-auto flex items-center gap-1" onClick={refresh} disabled={isLoading}>
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} /> 重新整理
        </button>
      </div>

      {/* ── Tab: Families ─────────────────────────────── */}
      {tab === 'families' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">共 {families.length} 個家庭</p>
          {families.map(f => (
            <div key={f.familyId} className="glass-card">
              <button
                className="w-full flex items-center justify-between"
                onClick={() => setExpandedFamily(expandedFamily === f.familyId ? null : f.familyId)}
              >
                <div className="flex items-center gap-2">
                  <Home size={16} className="text-primary flex-shrink-0" />
                  <span className="font-bold">{f.familyName}</span>
                  <span className="text-xs text-muted">({f.members.length} 人)</span>
                </div>
                {expandedFamily === f.familyId ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </button>
              {expandedFamily === f.familyId && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-muted text-xs">
                        <th className="text-left pb-1">姓名</th>
                        <th className="text-left pb-1">身分</th>
                        <th className="text-left pb-1">Google 帳號</th>
                      </tr>
                    </thead>
                    <tbody>
                      {f.members.map((m, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="py-1 pr-4">{m.name}</td>
                          <td className="py-1 pr-4 text-xs">
                            {m.role === 'primary_admin' ? '🏠 家長(主)' : m.role === 'co_admin' ? '👨‍👩 家長(副)' : '👦 小孩'}
                          </td>
                          <td className="py-1 text-xs text-muted">{m.googleEmail || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {f.createdAt && (
                    <p className="text-xs text-muted mt-2">建立時間：{new Date(f.createdAt).toLocaleDateString('zh-TW')}</p>
                  )}
                </div>
              )}
            </div>
          ))}
          {families.length === 0 && !isLoading && (
            <p className="text-muted text-sm text-center py-8">目前沒有家庭資料</p>
          )}
        </div>
      )}

      {/* ── Tab: Invite Codes ─────────────────────────── */}
      {tab === 'invites' && (
        <div className="flex flex-col gap-4">
          <button className="btn btn-primary flex items-center gap-2 self-start" onClick={handleGenerateCode}>
            <Plus size={16} /> 產生新邀請碼
          </button>

          <div className="flex flex-col gap-2">
            {inviteCodes.map(c => (
              <div key={c.code} className={`glass-card flex items-center justify-between gap-3 ${c.isUsed ? 'opacity-50' : ''}`}>
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`font-mono font-bold tracking-widest text-sm ${c.isUsed ? 'line-through text-muted' : 'text-primary'}`}>
                    {c.code}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded font-bold ${c.isUsed ? 'bg-slate-600/40 text-muted' : 'bg-green-500/20 text-green-400'}`}>
                    {c.isUsed ? '已使用' : '可用'}
                  </span>
                </div>
                <div className="text-xs text-muted min-w-0 hidden sm:block">
                  {c.isUsed ? `被 ${c.usedByEmail || c.usedBy} 使用` : `由 ${c.createdByEmail} 建立`}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-xs text-muted">{new Date(c.createdAt).toLocaleDateString('zh-TW')}</span>
                  {!c.isUsed && (
                    <button className="btn btn-ghost p-1.5" onClick={() => handleCopy(c.code)} title="複製">
                      {copiedCode === c.code ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {inviteCodes.length === 0 && !isLoading && (
              <p className="text-muted text-sm text-center py-8">尚無邀請碼</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Admins (super only) ──────────────────── */}
      {tab === 'admins' && systemAdminRole === 'super' && (
        <div className="flex flex-col gap-6">
          {/* Add admin form */}
          <div className="glass-card flex flex-col gap-3">
            <h3 className="font-bold flex items-center gap-2"><Plus size={16} /> 新增管理者</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                className="input-field" placeholder="Firebase UID"
                value={newAdminUid} onChange={e => setNewAdminUid(e.target.value)}
              />
              <input
                className="input-field" placeholder="Google Email"
                value={newAdminEmail} onChange={e => setNewAdminEmail(e.target.value)}
              />
              <select
                className="input-field"
                value={newAdminRole}
                onChange={e => setNewAdminRole(e.target.value as SystemAdminRole)}
              >
                <option value="senior">高級管理者</option>
                <option value="super">超級管理者</option>
              </select>
              {newAdminRole === 'senior' && (
                <input
                  className="input-field" placeholder="邀請碼配額（次數）" type="number" min="0"
                  value={newAdminQuota} onChange={e => setNewAdminQuota(e.target.value)}
                />
              )}
            </div>
            <button className="btn btn-primary self-start flex items-center gap-1" onClick={handleAddAdmin}>
              <Plus size={14} /> 新增
            </button>
          </div>

          {/* Admin list */}
          <div className="flex flex-col gap-2">
            {admins.map(a => (
              <div key={a.uid} className="glass-card flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    {a.role === 'super' ? <Crown size={14} className="text-amber-400" /> : <Star size={14} className="text-blue-400" />}
                    <span className="font-bold text-sm">{a.email}</span>
                    <span className="text-xs text-muted">{ROLE_LABEL[a.role]}</span>
                  </div>
                  <p className="text-xs text-muted mt-0.5 ml-5">UID: {a.uid}</p>
                </div>
                <div className="flex items-center gap-2">
                  {a.role === 'senior' && (
                    <div className="flex items-center gap-1 text-xs">
                      <span className="text-muted">配額:</span>
                      <input
                        type="number" min="0"
                        className="input-field py-0.5 w-16 text-center text-xs"
                        defaultValue={a.inviteQuota ?? ''}
                        onBlur={e => handleUpdateQuota(a.uid, e.target.value)}
                      />
                      <span className="text-muted">已用 {a.inviteUsed}</span>
                    </div>
                  )}
                  {a.uid !== firebaseUser?.uid && (
                    <button
                      className="btn btn-ghost text-red-400 p-1.5"
                      onClick={() => handleRemoveAdmin(a.uid)}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                  {a.uid === firebaseUser?.uid && (
                    <span className="text-xs text-muted">(自己)</span>
                  )}
                </div>
              </div>
            ))}
            {admins.length === 0 && !isLoading && (
              <p className="text-muted text-sm text-center py-8">沒有管理者</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default SuperAdminPanel;
