import React, { useState } from 'react';
import { useStore } from '../store/index';
import type { Badge, BadgeCondition, BadgeConditionType, TreasureBox, TreasureBoxItem } from '../store/index';
import { Award, Gift, PlusCircle, Trash2, X, Sparkles, Edit2, Settings } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';
import { EmojiInput } from '../components/EmojiInput';

const INPUT = 'w-full bg-slate-900/70 border border-white/10 rounded-xl px-4 py-3 text-base text-white focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 placeholder:text-muted transition';
const BTN_PRIMARY = 'min-h-[48px] px-4 rounded-2xl font-bold text-sm flex items-center justify-center gap-2 transition-all active:scale-95 bg-primary text-white shadow-lg';
const BTN_GHOST = 'min-h-[44px] px-4 rounded-xl font-bold text-sm text-muted hover:text-white bg-white/5 transition-all';
const SMALL_INPUT = 'bg-slate-900/70 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary transition';

const CONDITION_LABELS: Record<BadgeConditionType, string> = {
  quests_count: '累積完成任務 (次)',
  level: '角色等級達標 (等)',
  consecutive_record_days: '連續記帳天數 (天)',
  total_gems: '累積獲得寶石數 (顆)',
  savings_amount: '存錢筒儲蓄達標 (元)',
  consecutive_all_quests_weeks: '連續達成全部任務 (週)',
  consecutive_all_quests_days: '連續達成全部任務 (天)',
};

export const GamificationAdmin: React.FC = () => {
  const { badges, treasureBoxes, addBadge, updateBadge, deleteBadge, addTreasureBox, updateTreasureBox, deleteTreasureBox } = useStore();
  const [activeTab, setActiveTab] = useState<'badges' | 'boxes' | 'settings'>('badges');

  return (
    <div className="flex flex-col gap-4 w-full">
      <div className="flex border-b border-white/10 mb-2">
        <button className={`flex-1 py-2 font-bold transition-colors ${activeTab === 'badges' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`} onClick={() => setActiveTab('badges')}>
          <Award size={18} className="inline mr-2" /> 成就徽章設定
        </button>
        <button className={`flex-1 py-2 font-bold transition-colors ${activeTab === 'boxes' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`} onClick={() => setActiveTab('boxes')}>
          <Gift size={18} className="inline mr-2" /> 寶箱獎勵設定
        </button>
        <button className={`flex-1 py-2 font-bold transition-colors ${activeTab === 'settings' ? 'text-primary border-b-2 border-primary' : 'text-muted'}`} onClick={() => setActiveTab('settings')}>
          <Settings size={18} className="inline mr-2" /> 全域設定
        </button>
      </div>

      <div className="animate-fade-in">
        {activeTab === 'settings' && <GamificationSettingsPanel />}
        {activeTab === 'badges' && <BadgeManager badges={badges} treasureBoxes={treasureBoxes} addBadge={addBadge} updateBadge={updateBadge} deleteBadge={deleteBadge} />}
        {activeTab === 'boxes' && <TreasureBoxManager boxes={treasureBoxes} addBox={addTreasureBox} updateBox={updateTreasureBox} deleteBox={deleteTreasureBox} />}
      </div>
    </div>
  );
};

// ─── GamificationSettingsPanel ───────────────────────────────────────────────
const GamificationSettingsPanel: React.FC = () => {
  const { gamificationSettings, updateGamificationSettings } = useStore();
  const [formula, setFormula] = useState(gamificationSettings?.levelFormula || 'Math.floor(exp / 100) + 1');
  const [testExp, setTestExp] = useState('500');

  const handleSave = async () => {
    await updateGamificationSettings({ levelFormula: formula });
    alert('全域設定已儲存！');
  };

  let testResult = 1;
  try {
    const fn = new Function('exp', 'return ' + formula.replace(/exp/g, 'exp'));
    testResult = Math.max(1, Math.floor(fn(Number(testExp))));
  } catch {
    testResult = NaN;
  }

  return (
    <div className="glass-card flex flex-col gap-4">
      <h4 className="font-bold text-sm text-indigo-400 flex items-center gap-2"><Settings size={18}/> 經驗值與等級設定</h4>
      <div className="bg-primary/10 p-3 rounded-xl border border-primary/20 text-xs text-primary/80">
        所有孩子的等級皆會由「累積獲得的 EXP」透過此公式即時換算。若修改公式，所有人的等級都會自動跟著總經驗值重算。
      </div>
      <div>
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">計算公式 (變數請使用 exp)</label>
        <input className={INPUT} value={formula} onChange={e => setFormula(e.target.value)} placeholder="例: Math.floor(exp / 100) + 1" required />
      </div>
      <div className="bg-black/20 p-3 rounded-xl border border-white/5 flex flex-col gap-2">
        <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">公式測試器</label>
        <div className="flex items-center gap-3">
          <input type="number" className={`${SMALL_INPUT} w-24`} value={testExp} onChange={e => setTestExp(e.target.value)} />
          <span className="text-xs text-muted">EXP 算出的等級 =</span>
          <span className="font-bold text-success text-base">Lv.{isNaN(testResult) ? '?' : testResult}</span>
        </div>
      </div>
      <button type="button" onClick={handleSave} className={BTN_PRIMARY} disabled={isNaN(testResult)}>✅ 儲存全域設定</button>
    </div>
  );
};

// ─── BoxRewardSelect ──────────────────────────────────────────────────────────
const BoxRewardSelect: React.FC<{
  value: string;
  onChange: (v: string) => void;
  treasureBoxes: TreasureBox[];
  label?: string;
}> = ({ value, onChange, treasureBoxes, label = '寶箱獎勵 (選填)' }) => (
  <div>
    <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">{label}</label>
    <select
      className={INPUT}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">(無寶箱獎勵)</option>
      {treasureBoxes.map(box => (
        <option key={box.id} value={box.id}>🎁 {box.name}</option>
      ))}
    </select>
  </div>
);

// ─── BadgeManager ─────────────────────────────────────────────────────────────
const BadgeManager: React.FC<{
  badges: Badge[];
  treasureBoxes: TreasureBox[];
  addBadge: (badge: Omit<Badge, 'id'>) => Promise<void>;
  updateBadge: (id: string, badge: Omit<Badge, 'id'>) => Promise<void>;
  deleteBadge: (id: string) => Promise<void>;
}> = ({ badges, treasureBoxes, addBadge, updateBadge, deleteBadge }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('🏆');
  const [conditions, setConditions] = useState<BadgeCondition[]>([]);
  const [expReward, setExpReward] = useState('0');
  const [gemReward, setGemReward] = useState('0');
  const [boxRewardId, setBoxRewardId] = useState('');

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editIcon, setEditIcon] = useState('🏆');
  const [editConditions, setEditConditions] = useState<BadgeCondition[]>([]);
  const [editExpReward, setEditExpReward] = useState('0');
  const [editGemReward, setEditGemReward] = useState('0');
  const [editBoxRewardId, setEditBoxRewardId] = useState('');

  const handleAddCondition = () => setConditions([...conditions, { type: 'level', value: 1 }]);
  const handleAddEditCondition = () => setEditConditions([...editConditions, { type: 'level', value: 1 }]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || conditions.length === 0) return;
    try {
      await addBadge({ name, description, icon, conditions, expReward: Number(expReward) || 0, gemReward: Number(gemReward) || 0, boxRewardId: boxRewardId || undefined });
      setName(''); setDescription(''); setIcon('🏆'); setConditions([]); setExpReward('0'); setGemReward('0'); setBoxRewardId('');
      alert('徽章建立成功！');
    } catch (err) {
      console.error(err);
      alert('徽章建立失敗，請檢查網路或權限。');
    }
  };

  const startEdit = (b: Badge) => {
    setEditId(b.id);
    setEditName(b.name);
    setEditDescription(b.description || '');
    setEditIcon(b.icon);
    setEditConditions(b.conditions.map(c => ({ ...c })));
    setEditExpReward(String(b.expReward || 0));
    setEditGemReward(String(b.gemReward || 0));
    setEditBoxRewardId(b.boxRewardId || '');
  };

  const handleUpdate = async () => {
    if (!editId || !editName || editConditions.length === 0) return;
    try {
      await updateBadge(editId, {
        name: editName, description: editDescription, icon: editIcon, conditions: editConditions,
        expReward: Number(editExpReward) || 0, gemReward: Number(editGemReward) || 0,
        boxRewardId: editBoxRewardId || undefined,
      });
      setEditId(null);
      alert('徽章更新成功！');
    } catch (err) {
      console.error(err);
      alert('更新失敗。');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create form */}
      <form onSubmit={handleCreate} className="glass-card flex flex-col gap-4">
        <h4 className="font-bold text-sm text-indigo-400 flex items-center gap-2"><PlusCircle size={18}/> 新增成就徽章</h4>
        <div className="flex gap-3">
          <EmojiInput value={icon} onChange={setIcon} label="圖示" />
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">徽章名稱</label>
            <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="例: 新手冒險家" required />
          </div>
        </div>
        <div>
          <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">說明文案</label>
          <input className={INPUT} value={description} onChange={e => setDescription(e.target.value)} placeholder="例: 踏上理財與解任務的第一步！" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">獎勵 EXP</label>
            <input type="number" className={INPUT} value={expReward} onChange={e => setExpReward(e.target.value)} min="0" />
          </div>
          <div>
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">獎勵寶石</label>
            <input type="number" className={INPUT} value={gemReward} onChange={e => setGemReward(e.target.value)} min="0" />
          </div>
        </div>
        {treasureBoxes.length > 0 && (
          <BoxRewardSelect value={boxRewardId} onChange={setBoxRewardId} treasureBoxes={treasureBoxes} label="寶箱獎勵 (解鎖徽章時發放)" />
        )}
        <div className="bg-black/20 p-3 rounded border border-white/5 flex flex-col gap-2">
          <label className="text-xs font-bold text-muted">達標條件 (需全部滿足)</label>
          {conditions.map((cond, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <select className={`${SMALL_INPUT} flex-1`} value={cond.type} onChange={e => { const n = [...conditions]; n[idx].type = e.target.value as BadgeConditionType; setConditions(n); }}>
                {Object.entries(CONDITION_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
              </select>
              <input type="number" className={`${SMALL_INPUT} w-20 flex-none`} value={cond.value} min="1" onChange={e => { const n = [...conditions]; n[idx].value = Number(e.target.value); setConditions(n); }} required />
              <button type="button" onClick={() => setConditions(conditions.filter((_, i) => i !== idx))} className="text-error hover:text-red-400 p-1 flex-none"><X size={16}/></button>
            </div>
          ))}
          <button type="button" onClick={handleAddCondition} className={`${BTN_GHOST} w-full mt-1 border border-white/10 border-dashed text-xs`}>+ 新增達標條件</button>
        </div>
        <button type="submit" className={`${BTN_PRIMARY} mt-1`} disabled={conditions.length === 0}><Sparkles size={18} /> 建立徽章</button>
      </form>

      {/* List */}
      <div className="flex flex-col gap-2">
        {badges.map(b => {
          if (editId === b.id) {
            return (
              <div key={b.id} className="glass-card p-4 border border-primary/30 flex flex-col gap-3">
                <div className="text-xs font-bold text-primary">✏️ 修改成就徽章</div>
                <div className="flex gap-3">
                  <EmojiInput value={editIcon} onChange={setEditIcon} label="圖示" />
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">徽章名稱</label>
                    <input className={INPUT} value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 block mb-1">說明文案</label>
                  <input className={INPUT} value={editDescription} onChange={e => setEditDescription(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">獎勵 EXP</label>
                    <input type="number" className={INPUT} value={editExpReward} onChange={e => setEditExpReward(e.target.value)} min="0" />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">獎勵寶石</label>
                    <input type="number" className={INPUT} value={editGemReward} onChange={e => setEditGemReward(e.target.value)} min="0" />
                  </div>
                </div>
                {treasureBoxes.length > 0 && (
                  <BoxRewardSelect value={editBoxRewardId} onChange={setEditBoxRewardId} treasureBoxes={treasureBoxes} label="寶箱獎勵 (解鎖徽章時發放)" />
                )}
                <div className="bg-black/20 p-3 rounded border border-white/5 flex flex-col gap-2">
                  <label className="text-xs font-bold text-muted">達標條件</label>
                  {editConditions.map((cond, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select className={`${SMALL_INPUT} flex-1`} value={cond.type} onChange={e => { const n = [...editConditions]; n[idx].type = e.target.value as BadgeConditionType; setEditConditions(n); }}>
                        {Object.entries(CONDITION_LABELS).map(([val, label]) => <option key={val} value={val}>{label}</option>)}
                      </select>
                      <input type="number" className={`${SMALL_INPUT} w-20 flex-none`} value={cond.value} min="1" onChange={e => { const n = [...editConditions]; n[idx].value = Number(e.target.value); setEditConditions(n); }} />
                      <button type="button" onClick={() => setEditConditions(editConditions.filter((_, i) => i !== idx))} className="text-error p-1 flex-none"><X size={16}/></button>
                    </div>
                  ))}
                  <button type="button" onClick={handleAddEditCondition} className={`${BTN_GHOST} w-full mt-1 border border-white/10 border-dashed text-xs`}>+ 新增條件</button>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="flex-1 py-2.5 rounded-xl bg-primary text-white font-bold text-sm">✅ 儲存變更</button>
                  <button onClick={() => setEditId(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-muted font-bold text-sm">取消</button>
                </div>
              </div>
            );
          }
          const rewardBox = b.boxRewardId ? treasureBoxes.find(tb => tb.id === b.boxRewardId) : null;
          return (
            <div key={b.id} className="glass-card p-3 flex justify-between items-start">
              <div className="flex items-start gap-3">
                <span className="text-3xl">{b.icon}</span>
                <div>
                  <h5 className="font-bold">{b.name}</h5>
                  <p className="text-xs text-muted mb-2">{b.description}</p>
                  <div className="flex flex-wrap gap-1">
                    {b.conditions.map((cond, idx) => (
                      <span key={idx} className="text-[10px] bg-primary/20 text-indigo-300 px-1.5 py-0.5 rounded border border-primary/30">
                        {CONDITION_LABELS[cond.type]}: {cond.value}
                      </span>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-2 flex-wrap">
                    {b.expReward ? <span className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">+{b.expReward} EXP</span> : null}
                    {b.gemReward ? <span className="text-[10px] text-emerald-400 font-bold bg-emerald-400/10 px-1.5 py-0.5 rounded border border-emerald-400/20">+{b.gemReward} 寶石</span> : null}
                    {rewardBox ? <span className="text-[10px] text-fuchsia-400 font-bold bg-fuchsia-400/10 px-1.5 py-0.5 rounded border border-fuchsia-400/20">🎁 {rewardBox.name}</span> : null}
                  </div>
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={() => startEdit(b)} className="p-1.5 text-primary/60 hover:text-primary hover:bg-primary/10 rounded"><Edit2 size={15} /></button>
                <button onClick={() => { if (window.confirm('確定刪除此徽章？')) deleteBadge(b.id); }} className="p-1.5 text-error/60 hover:text-error hover:bg-error/10 rounded"><Trash2 size={15} /></button>
              </div>
            </div>
          );
        })}
        {badges.length === 0 && <p className="text-center text-muted text-sm py-4">尚未建立任何徽章</p>}
      </div>
    </div>
  );
};

// ─── ItemsEditor ─────────────────────────────────────────────────────────────
// Defined OUTSIDE TreasureBoxManager to avoid "component created during render" anti-pattern
type ItemUpdateField = 'name' | 'probability' | 'isPhysical' | 'expReward' | 'gemReward';
interface ItemsEditorProps {
  its: TreasureBoxItem[];
  onUpdate: (id: string, field: ItemUpdateField, value: string | number | boolean) => void;
  onAdd: () => void;
  onDelete: (id: string) => void;
}
const ItemsEditor: React.FC<ItemsEditorProps> = ({ its, onUpdate, onAdd, onDelete }) => (
  <div className="bg-black/20 p-3 rounded border border-white/5 flex flex-col gap-3">
    <div className="flex justify-between items-center mb-1">
      <label className="text-xs font-bold text-muted">包含物品與機率</label>
      <span className={`text-xs ${its.reduce((s, i) => s + i.probability, 0) === 100 ? 'text-success' : 'text-error'}`}>
        總和: {its.reduce((s, i) => s + i.probability, 0)}%
      </span>
    </div>
    {its.map(item => (
      <div key={item.id} className="flex flex-col gap-2 p-2 bg-slate-900/50 rounded-lg border border-white/5">
        <div className="flex items-center gap-2">
          <input className={`${SMALL_INPUT} flex-1`} value={item.name} onChange={e => onUpdate(item.id, 'name', e.target.value)} placeholder="物品名稱 / 獎勵" required />
          <div className="flex items-center flex-none">
            <input type="number" className={`${SMALL_INPUT} w-16 text-right rounded-r-none border-r-0`} value={item.probability} onChange={e => onUpdate(item.id, 'probability', Number(e.target.value))} min="1" max="100" required />
            <div className="bg-slate-900/70 py-2 px-2 text-[10px] text-muted rounded-r-lg border border-white/10 border-l-0">%</div>
          </div>
          <button type="button" onClick={() => onDelete(item.id)} className="text-error disabled:opacity-30 p-1 flex-none" disabled={its.length <= 1}><X size={16}/></button>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex flex-none items-center gap-1 text-[10px] text-amber-400 bg-amber-400/10 px-2 py-1.5 rounded cursor-pointer whitespace-nowrap border border-amber-400/20">
            <input type="checkbox" className="accent-amber-500" checked={item.isPhysical || false} onChange={e => onUpdate(item.id, 'isPhysical', e.target.checked)} />
            實體(須審核)
          </label>
          <input type="number" className={`${SMALL_INPUT} py-1.5 px-2 flex-1`} placeholder="獎勵 EXP" value={item.expReward || ''} onChange={e => onUpdate(item.id, 'expReward', Number(e.target.value))} min="0" />
          <input type="number" className={`${SMALL_INPUT} py-1.5 px-2 flex-1`} placeholder="獎勵寶石" value={item.gemReward || ''} onChange={e => onUpdate(item.id, 'gemReward', Number(e.target.value))} min="0" />
        </div>
      </div>
    ))}
    <button type="button" onClick={onAdd} className={`${BTN_GHOST} w-full mt-1 border border-white/10 border-dashed text-xs`}>+ 新增物品</button>
  </div>
);

// ─── TreasureBoxManager ───────────────────────────────────────────────────────
type BoxMutator = (id: string, box: Omit<TreasureBox, 'id'>) => Promise<void>;
const TreasureBoxManager: React.FC<{
  boxes: TreasureBox[];
  addBox: (box: Omit<TreasureBox, 'id'>) => Promise<void>;
  updateBox: BoxMutator;
  deleteBox: (id: string) => Promise<void>;
}> = ({ boxes, addBox, updateBox, deleteBox }) => {
  const [name, setName] = useState('');
  const [costGems, setCostGems] = useState('10');
  const [purchasable, setPurchasable] = useState(true);
  const [items, setItems] = useState<TreasureBoxItem[]>([
    { id: uuidv4(), name: '小點心', probability: 50 },
    { id: uuidv4(), name: '10元現金', probability: 50 },
  ]);

  // Edit state
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editCostGems, setEditCostGems] = useState('10');
  const [editPurchasable, setEditPurchasable] = useState(true);
  const [editItems, setEditItems] = useState<TreasureBoxItem[]>([]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const totalProb = items.reduce((sum, item) => sum + item.probability, 0);
    if (totalProb !== 100) { alert('所有物品的機率總和必須等於 100%'); return; }
    if (!name || items.length === 0) return;
    try {
      await addBox({ name, costGems: purchasable ? Number(costGems) : 0, purchasable, items });
      setName(''); setCostGems('10'); setPurchasable(true);
      setItems([{ id: uuidv4(), name: '小點心', probability: 50 }, { id: uuidv4(), name: '10元現金', probability: 50 }]);
      alert('寶箱種類已建立！');
    } catch (err) {
      console.error(err);
      alert('建立寶箱失敗。');
    }
  };

  const updateItem = (id: string, field: keyof TreasureBoxItem, value: string | number | boolean) => setItems(items.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addItem = () => setItems([...items, { id: uuidv4(), name: '', probability: 10 }]);
  const deleteItem = (id: string) => setItems(items.filter(it => it.id !== id));

  const updateEditItem = (id: string, field: keyof TreasureBoxItem, value: string | number | boolean) => setEditItems(editItems.map(it => it.id === id ? { ...it, [field]: value } : it));
  const addEditItem = () => setEditItems([...editItems, { id: uuidv4(), name: '', probability: 10 }]);
  const deleteEditItem = (id: string) => setEditItems(editItems.filter(it => it.id !== id));

  const startEdit = (box: TreasureBox) => {
    setEditId(box.id);
    setEditName(box.name);
    setEditCostGems(String(box.costGems));
    setEditPurchasable(box.purchasable !== false);
    setEditItems(box.items.map(it => ({ ...it })));
  };

  const handleUpdate = async () => {
    if (!editId || !editName) return;
    const totalProb = editItems.reduce((sum, it) => sum + it.probability, 0);
    if (totalProb !== 100) { alert('所有物品的機率總和必須等於 100%'); return; }
    try {
      await updateBox(editId, { name: editName, costGems: editPurchasable ? Number(editCostGems) : 0, purchasable: editPurchasable, items: editItems });
      setEditId(null);
      alert('寶箱已更新！');
    } catch (err) {
      console.error(err);
      alert('更新失敗。');
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Create form */}
      <form onSubmit={handleCreate} className="glass-card flex flex-col gap-4">
        <h4 className="font-bold text-sm text-amber-400 flex items-center gap-2"><PlusCircle size={18}/> 新增寶箱種類</h4>

        {/* Purchasable toggle */}
        <label className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer">
          <input type="checkbox" className="w-5 h-5 accent-amber-500 rounded" checked={purchasable} onChange={e => setPurchasable(e.target.checked)} />
          <div>
            <div className="font-bold text-sm text-white">允許孩子用寶石購買</div>
            <div className="text-xs text-muted">若不勾選，此寶箱只能透過任務獎勵或徽章解鎖取得</div>
          </div>
        </label>

        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">寶箱名稱</label>
            <input className={INPUT} value={name} onChange={e => setName(e.target.value)} placeholder="例: 週末驚喜包" required />
          </div>
          {purchasable && (
            <div className="w-28">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1.5">消耗寶石</label>
              <input type="number" className={INPUT} value={costGems} onChange={e => setCostGems(e.target.value)} required min="1" />
            </div>
          )}
        </div>
        <ItemsEditor its={items} onUpdate={updateItem} onAdd={addItem} onDelete={deleteItem} />
        <button type="submit" className={`${BTN_PRIMARY} mt-1`}>建立寶箱</button>
      </form>

      {/* List */}
      <div className="flex flex-col gap-2">
        {boxes.map(box => {
          const isPurchasable = box.purchasable !== false;
          if (editId === box.id) {
            return (
              <div key={box.id} className="glass-card p-4 border border-amber-400/30 flex flex-col gap-3">
                <div className="text-xs font-bold text-amber-400">✏️ 修改寶箱</div>
                <label className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10 cursor-pointer">
                  <input type="checkbox" className="w-5 h-5 accent-amber-500 rounded" checked={editPurchasable} onChange={e => setEditPurchasable(e.target.checked)} />
                  <div>
                    <div className="font-bold text-sm text-white">允許孩子用寶石購買</div>
                    <div className="text-xs text-muted">若不勾選，此寶箱只能透過任務獎勵或徽章解鎖取得</div>
                  </div>
                </label>
                <div className="flex gap-3">
                  <div className="flex-1">
                    <label className="text-[10px] text-slate-400 block mb-1">寶箱名稱</label>
                    <input className={INPUT} value={editName} onChange={e => setEditName(e.target.value)} />
                  </div>
                  {editPurchasable && (
                    <div className="w-28">
                      <label className="text-[10px] text-slate-400 block mb-1">消耗寶石</label>
                      <input type="number" className={INPUT} value={editCostGems} onChange={e => setEditCostGems(e.target.value)} min="1" />
                    </div>
                  )}
                </div>
                <ItemsEditor its={editItems} onUpdate={updateEditItem} onAdd={addEditItem} onDelete={deleteEditItem} />
                <div className="flex gap-2">
                  <button onClick={handleUpdate} className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-900 font-bold text-sm">✅ 儲存變更</button>
                  <button onClick={() => setEditId(null)} className="flex-1 py-2.5 rounded-xl bg-white/10 text-muted font-bold text-sm">取消</button>
                </div>
              </div>
            );
          }
          return (
            <div key={box.id} className="glass-card p-3">
              <div className="flex justify-between items-center mb-3">
                <div>
                  <h5 className="font-bold text-amber-400 flex items-center gap-2"><Gift size={16}/> {box.name}</h5>
                  {isPurchasable
                    ? <span className="text-xs text-muted">💎 消耗 {box.costGems} 顆寶石可購買</span>
                    : <span className="text-xs text-muted bg-slate-700/50 px-2 py-0.5 rounded">🔒 僅限任務/徽章獲得</span>
                  }
                </div>
                <div className="flex gap-1">
                  <button onClick={() => startEdit(box)} className="p-1.5 text-amber-400/60 hover:text-amber-400 hover:bg-amber-400/10 rounded"><Edit2 size={15} /></button>
                  <button onClick={() => { if (window.confirm('確定刪除此寶箱嗎？')) deleteBox(box.id); }} className="p-1.5 text-error/60 hover:text-error hover:bg-error/10 rounded"><Trash2 size={15} /></button>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {box.items.map(item => (
                  <div key={item.id} className="flex flex-col gap-1 text-xs bg-black/30 px-3 py-2 rounded border border-white/5">
                    <div className="flex justify-between font-bold">
                      <span>{item.name}</span>
                      <span className="text-muted">{item.probability}%</span>
                    </div>
                    {item.isPhysical && <div className="text-[10px] text-amber-500 mt-1">📦 實體獎勵(須審核)</div>}
                    {(item.expReward || item.gemReward) ? (
                      <div className="flex gap-2">
                        {item.expReward ? <span className="text-[10px] text-indigo-300">+{item.expReward} EXP</span> : null}
                        {item.gemReward ? <span className="text-[10px] text-emerald-400">+{item.gemReward} 寶石</span> : null}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        {boxes.length === 0 && <p className="text-center text-muted text-sm py-4">尚未建立任何寶箱</p>}
      </div>
    </div>
  );
};
