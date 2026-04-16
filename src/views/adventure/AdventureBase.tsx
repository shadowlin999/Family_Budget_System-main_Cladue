import React, { useState } from 'react';
import { Shirt, Sword, Shield, Sparkles, Camera, Check } from 'lucide-react';
import type {
  AvatarGender, AvatarSkinTone, WeaponType, ArmorType, AccessoryType,
} from '../../types/adventure';

// ── Static option lists ───────────────────────────────────────────────────────
const SKIN_TONES: { key: AvatarSkinTone; color: string; label: string }[] = [
  { key: 'light',  color: '#fde68a', label: '淺膚' },
  { key: 'medium', color: '#fbbf24', label: '中膚' },
  { key: 'tan',    color: '#d97706', label: '小麥' },
  { key: 'dark',   color: '#92400e', label: '深膚' },
];
const HAIR_COLORS = ['#1a1a1a', '#5c3a1e', '#c8860a', '#e8c14b', '#e03c3c', '#6d28d9', '#0891b2', '#d1fae5'];
const HAIR_STYLES = ['短直', '長直', '捲髮', '馬尾', '雙馬尾', '辮子', '爆炸頭', '光頭', '丸子頭', '半扎'];
const WEAPONS: { key: WeaponType; emoji: string; name: string }[] = [
  { key: 'none',   emoji: '🤲', name: '空手' },
  { key: 'sword',  emoji: '⚔️', name: '勇士劍' },
  { key: 'staff',  emoji: '🪄', name: '魔法杖' },
  { key: 'bow',    emoji: '🏹', name: '精靈弓' },
  { key: 'shield', emoji: '🛡️', name: '守護盾' },
  { key: 'wand',   emoji: '✨', name: '仙靈棒' },
];
const ARMORS: { key: ArmorType; emoji: string; name: string }[] = [
  { key: 'none',   emoji: '👕', name: '便服' },
  { key: 'casual', emoji: '🧥', name: '冒險服' },
  { key: 'robe',   emoji: '👘', name: '魔法袍' },
  { key: 'armor',  emoji: '🥋', name: '戰士甲' },
  { key: 'cloak',  emoji: '🦸', name: '英雄披風' },
];
const ACCESSORIES: { key: AccessoryType; emoji: string; name: string }[] = [
  { key: 'none',   emoji: '—',  name: '無' },
  { key: 'hat',    emoji: '🎩', name: '魔術帽' },
  { key: 'crown',  emoji: '👑', name: '勇者冠' },
  { key: 'wings',  emoji: '🪽', name: '天使翅膀' },
  { key: 'aura',   emoji: '💫', name: '神聖光環' },
];

// ── Avatar preview renderer ───────────────────────────────────────────────────
const AvatarPreview: React.FC<{
  skinTone: AvatarSkinTone; hairStyle: number; hairColor: string;
  weapon: WeaponType; armor: ArmorType; accessory: AccessoryType;
  name: string; gender: AvatarGender;
}> = ({ skinTone, hairStyle, hairColor, weapon, armor, accessory, name }) => {
  const skin = SKIN_TONES.find(s => s.key === skinTone)?.color ?? '#fbbf24';
  const hair = HAIR_COLORS[hairColor as unknown as number] ?? hairColor;
  const acc  = ACCESSORIES.find(a => a.key === accessory);
  const arm  = ARMORS.find(a => a.key === armor);
  const wpn  = WEAPONS.find(w => w.key === weapon);
  const hs   = HAIR_STYLES[hairStyle] ?? '短直';

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-32 h-36 flex flex-col items-center justify-end select-none">
        {/* Accessory */}
        {acc && acc.key !== 'none' && (
          <span className="absolute top-0 text-3xl z-10">{acc.emoji}</span>
        )}
        {/* Head */}
        <div className="relative w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center mb-1 shadow-xl"
          style={{ background: `radial-gradient(circle at 35% 35%, ${skin}dd, ${skin}88)` }}>
          {/* Hair indicator */}
          <div className="absolute -top-2 left-0 right-0 h-4 rounded-t-full text-[8px] text-white/60 text-center font-bold"
            style={{ background: hair, borderRadius: '50% 50% 0 0' }} />
          {/* Eyes */}
          <div className="flex gap-2 mt-2">
            <div className="w-2 h-2 rounded-full bg-slate-800" />
            <div className="w-2 h-2 rounded-full bg-slate-800" />
          </div>
        </div>
        {/* Body */}
        <div className="w-20 h-14 rounded-t-2xl flex items-center justify-center text-2xl shadow-md"
          style={{ background: arm?.key !== 'none' ? '#6d28d9' : '#374151' }}>
          {arm && arm.key !== 'none' ? arm.emoji : '👕'}
        </div>
        {/* Weapon */}
        {wpn && wpn.key !== 'none' && (
          <span className="absolute right-0 bottom-4 text-2xl">{wpn.emoji}</span>
        )}
      </div>
      <div className="text-center">
        <div className="font-black text-sm">{name || '冒險者'}</div>
        <div className="text-[10px] text-muted">{hs}髮 · {arm?.name} · {wpn?.name}</div>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdventureBase: React.FC<{ kidName: string }> = ({ kidName }) => {
  const [gender, setGender]       = useState<AvatarGender>('other');
  const [skinTone, setSkinTone]   = useState<AvatarSkinTone>('medium');
  const [hairStyle, setHairStyle] = useState(0);
  const [hairColor, setHairColor] = useState(0);
  const [weapon, setWeapon]       = useState<WeaponType>('none');
  const [armor, setArmorState]    = useState<ArmorType>('none');
  const [accessory, setAccessory] = useState<AccessoryType>('none');
  const [useAsProfile, setUseAsProfile] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    // TODO: persist to Firestore adventureProfiles/{kidId}
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="w-14 h-14 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <Shirt size={28} className="text-indigo-400" />
        </div>
        <h4 className="text-xl font-black">冒險基地</h4>
        <p className="text-xs text-muted">打造你的專屬數位分身！</p>
      </div>

      {/* Preview + controls */}
      <div className="flex flex-col sm:flex-row gap-5 items-start">
        {/* Avatar preview */}
        <div className="flex-shrink-0 w-full sm:w-auto flex flex-col items-center gap-3 glass-card p-5">
          <AvatarPreview
            skinTone={skinTone} hairStyle={hairStyle} hairColor={HAIR_COLORS[hairColor]}
            weapon={weapon} armor={armor} accessory={accessory}
            name={kidName} gender={gender}
          />
          <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
            <input type="checkbox" checked={useAsProfile} onChange={e => setUseAsProfile(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500" />
            <Camera size={12} className="text-muted" />
            設為首頁大頭貼
          </label>
        </div>

        {/* Controls */}
        <div className="flex-1 flex flex-col gap-4 w-full">
          {/* Gender */}
          <div>
            <div className="text-xs font-bold text-muted mb-2">性別</div>
            <div className="flex gap-2">
              {(['male', 'female', 'other'] as AvatarGender[]).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${gender === g ? 'border-indigo-400 bg-indigo-400/20 text-indigo-300' : 'border-white/10 text-muted hover:border-white/30'}`}>
                  {g === 'male' ? '♂ 男生' : g === 'female' ? '♀ 女生' : '✦ 其他'}
                </button>
              ))}
            </div>
          </div>

          {/* Skin */}
          <div>
            <div className="text-xs font-bold text-muted mb-2">膚色</div>
            <div className="flex gap-3">
              {SKIN_TONES.map(s => (
                <button key={s.key} onClick={() => setSkinTone(s.key)} title={s.label}
                  className={`w-9 h-9 rounded-full border-2 transition-all ${skinTone === s.key ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: s.color }} />
              ))}
            </div>
          </div>

          {/* Hair style */}
          <div>
            <div className="text-xs font-bold text-muted mb-2">髮型 — {HAIR_STYLES[hairStyle]}</div>
            <div className="flex gap-1 flex-wrap">
              {HAIR_STYLES.map((_, i) => (
                <button key={i} onClick={() => setHairStyle(i)}
                  className={`w-8 h-8 rounded-lg text-xs font-bold border transition-all ${hairStyle === i ? 'border-indigo-400 bg-indigo-400/20' : 'border-white/10 text-muted hover:border-white/30'}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Hair color */}
          <div>
            <div className="text-xs font-bold text-muted mb-2">髮色</div>
            <div className="flex gap-2 flex-wrap">
              {HAIR_COLORS.map((c, i) => (
                <button key={c} onClick={() => setHairColor(i)} title={c}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${hairColor === i ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ background: c }} />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Equipment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {/* Weapon */}
        <div className="glass-card">
          <div className="text-xs font-bold text-muted mb-2 flex items-center gap-1"><Sword size={12} /> 武器</div>
          <div className="flex flex-col gap-1">
            {WEAPONS.map(w => (
              <button key={w.key} onClick={() => setWeapon(w.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${weapon === w.key ? 'border-amber-400 bg-amber-400/10 text-amber-300' : 'border-white/10 text-muted hover:border-white/30 hover:text-white'}`}>
                <span className="text-base">{w.emoji}</span> {w.name}
              </button>
            ))}
          </div>
        </div>

        {/* Armor */}
        <div className="glass-card">
          <div className="text-xs font-bold text-muted mb-2 flex items-center gap-1"><Shield size={12} /> 裝甲</div>
          <div className="flex flex-col gap-1">
            {ARMORS.map(a => (
              <button key={a.key} onClick={() => setArmorState(a.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${armor === a.key ? 'border-violet-400 bg-violet-400/10 text-violet-300' : 'border-white/10 text-muted hover:border-white/30 hover:text-white'}`}>
                <span className="text-base">{a.emoji}</span> {a.name}
              </button>
            ))}
          </div>
        </div>

        {/* Accessory */}
        <div className="glass-card">
          <div className="text-xs font-bold text-muted mb-2 flex items-center gap-1"><Sparkles size={12} /> 飾品</div>
          <div className="flex flex-col gap-1">
            {ACCESSORIES.map(a => (
              <button key={a.key} onClick={() => setAccessory(a.key)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-bold border transition-all ${accessory === a.key ? 'border-cyan-400 bg-cyan-400/10 text-cyan-300' : 'border-white/10 text-muted hover:border-white/30 hover:text-white'}`}>
                <span className="text-base">{a.emoji}</span> {a.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      <button onClick={handleSave}
        className={`btn flex items-center justify-center gap-2 font-black py-3 transition-all ${saved ? 'bg-green-500 text-white' : 'btn-primary'}`}>
        {saved ? <><Check size={18} /> 已儲存！</> : '儲存分身設定'}
      </button>
    </div>
  );
};

export default AdventureBase;
