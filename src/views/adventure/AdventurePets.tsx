import React, { useState } from 'react';
import { Heart, Zap, Brain, Star, Swords, Wind, Cat } from 'lucide-react';
import type { PetSpecies, PetStage, PetMood } from '../../types/adventure';

// ── Static data ───────────────────────────────────────────────────────────────
const SPECIES_INFO: Record<PetSpecies, { emoji: string; name: string; color: string; desc: string }> = {
  dragon:  { emoji: '🐉', name: '小火龍',  color: 'from-red-500/30 to-orange-500/30',   desc: '力量超強，天生的戰士！' },
  cat:     { emoji: '🐱', name: '靈貓',    color: 'from-purple-500/30 to-pink-500/30',  desc: '敏捷迅速，行動如風！' },
  fox:     { emoji: '🦊', name: '狡狐',    color: 'from-amber-500/30 to-yellow-500/30', desc: '聰明機靈，智力驚人！' },
  wolf:    { emoji: '🐺', name: '銀狼',    color: 'from-slate-500/30 to-blue-500/30',   desc: '全能型夥伴，均衡發展！' },
  bunny:   { emoji: '🐰', name: '幸運兔',  color: 'from-pink-500/30 to-rose-500/30',    desc: '幸運值爆表，寶物收集王！' },
  phoenix: { emoji: '🦅', name: '鳳凰',   color: 'from-cyan-500/30 to-teal-500/30',    desc: '傳說中的神鳥，超稀有！' },
};

const STAGE_INFO: Record<PetStage, { label: string; color: string }> = {
  egg:       { label: '蛋',   color: 'text-slate-400' },
  baby:      { label: '幼體', color: 'text-green-400' },
  teen:      { label: '少年', color: 'text-blue-400' },
  adult:     { label: '成體', color: 'text-violet-400' },
  legendary: { label: '傳說', color: 'text-amber-400' },
};

const MOOD_INFO: Record<PetMood, { emoji: string; label: string; color: string }> = {
  ecstatic:  { emoji: '🤩', label: '狂喜', color: 'text-amber-400' },
  happy:     { emoji: '😊', label: '開心', color: 'text-green-400' },
  neutral:   { emoji: '😐', label: '普通', color: 'text-slate-400' },
  sad:       { emoji: '😢', label: '難過', color: 'text-blue-400' },
  depressed: { emoji: '😞', label: '低落', color: 'text-red-400' },
};

// ── Sub-components ────────────────────────────────────────────────────────────
const StatBar: React.FC<{ label: string; icon: React.ReactNode; value: number; color: string }> = ({ label, icon, value, color }) => (
  <div className="flex items-center gap-2">
    <div className="w-16 flex items-center gap-1 text-xs text-muted shrink-0">{icon}{label}</div>
    <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-700 ${color}`} style={{ width: `${value}%` }} />
    </div>
    <div className="text-xs font-bold w-8 text-right">{value}</div>
  </div>
);

// Demo pet data for display purposes
const DEMO_PET = {
  name: '小火球',
  species: 'dragon' as PetSpecies,
  stage: 'baby' as PetStage,
  moodScore: 75,
  mood: 'happy' as PetMood,
  health: 88,
  stamina: 60,
  level: 3,
  exp: 240,
  expToNext: 400,
  abilities: { strength: 65, agility: 40, intelligence: 35, luck: 45 },
};

const EggCard: React.FC<{ species: PetSpecies; progress: number }> = ({ species, progress }) => {
  const info = SPECIES_INFO[species];
  return (
    <div className={`glass-card bg-gradient-to-br ${info.color} flex flex-col items-center gap-3 p-5`}>
      <div className="text-5xl animate-bounce">{progress < 100 ? '🥚' : info.emoji}</div>
      <div className="w-full">
        <div className="flex justify-between text-xs text-muted mb-1">
          <span>孵化進度</span>
          <span className="font-bold text-white">{progress}%</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-400 to-orange-400 rounded-full transition-all duration-700"
            style={{ width: `${progress}%` }} />
        </div>
      </div>
      <div className="text-xs text-muted">完成任務可加速孵化！</div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
const AdventurePets: React.FC = () => {
  const [view, setView] = useState<'pet' | 'eggs' | 'hatch'>('pet');
  const [interacting, setInteracting] = useState<string | null>(null);

  const pet = DEMO_PET;
  const species = SPECIES_INFO[pet.species];
  const stage = STAGE_INFO[pet.stage];
  const mood = MOOD_INFO[pet.mood];

  const handleInteract = (action: string) => {
    setInteracting(action);
    setTimeout(() => setInteracting(null), 1500);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <Cat size={28} className="text-emerald-400" />
        </div>
        <h4 className="text-xl font-black">冒險夥伴</h4>
        <p className="text-xs text-muted">養育你的專屬寵物，一起踏上冒險！</p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2 bg-white/5 p-1 rounded-2xl border border-white/10">
        {(['pet', 'eggs', 'hatch'] as const).map(t => (
          <button key={t} onClick={() => setView(t)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${view === t ? 'bg-emerald-500/30 text-emerald-300 border border-emerald-400/30' : 'text-muted hover:text-white'}`}>
            {t === 'pet' ? '🐾 我的夥伴' : t === 'eggs' ? '🥚 孵蛋中' : '📖 圖鑑'}
          </button>
        ))}
      </div>

      {/* My Pet view */}
      {view === 'pet' && (
        <div className="flex flex-col gap-4">
          {/* Pet card */}
          <div className={`glass-card bg-gradient-to-br ${species.color} flex flex-col sm:flex-row gap-5 items-center`}>
            {/* Avatar */}
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-5xl shadow-xl">
                  {species.emoji}
                </div>
                <div className={`absolute -bottom-1 -right-1 text-lg ${mood.color}`}>{mood.emoji}</div>
              </div>
              <div className="text-center">
                <div className="font-black text-base">{pet.name}</div>
                <div className={`text-xs font-bold ${stage.color}`}>{species.name} · {stage.label}</div>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 w-full flex flex-col gap-3">
              {/* Level + Mood */}
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold">
                  <Star size={12} className="text-amber-400" />
                  Lv.{pet.level}
                </div>
                <div className={`flex items-center gap-1 bg-white/10 px-3 py-1.5 rounded-xl text-xs font-bold ${mood.color}`}>
                  {mood.emoji} {mood.label}
                </div>
              </div>

              {/* EXP bar */}
              <div>
                <div className="flex justify-between text-[10px] text-muted mb-1">
                  <span>經驗值</span><span>{pet.exp}/{pet.expToNext} EXP</span>
                </div>
                <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-400 to-violet-400 rounded-full"
                    style={{ width: `${(pet.exp / pet.expToNext) * 100}%` }} />
                </div>
              </div>

              {/* Health + Stamina */}
              <StatBar label="體力" icon={<Heart size={10} className="text-red-400" />} value={pet.health} color="bg-gradient-to-r from-red-400 to-pink-400" />
              <StatBar label="耐力" icon={<Zap size={10} className="text-yellow-400" />} value={pet.stamina} color="bg-gradient-to-r from-yellow-400 to-amber-400" />
            </div>
          </div>

          {/* Abilities */}
          <div className="glass-card">
            <div className="text-xs font-bold text-muted mb-3">能力值</div>
            <div className="flex flex-col gap-2">
              <StatBar label="力量" icon={<Swords size={10} className="text-red-400" />} value={pet.abilities.strength} color="bg-gradient-to-r from-red-400 to-orange-400" />
              <StatBar label="敏捷" icon={<Wind size={10} className="text-cyan-400" />} value={pet.abilities.agility} color="bg-gradient-to-r from-cyan-400 to-blue-400" />
              <StatBar label="智力" icon={<Brain size={10} className="text-violet-400" />} value={pet.abilities.intelligence} color="bg-gradient-to-r from-violet-400 to-purple-400" />
              <StatBar label="幸運" icon={<Star size={10} className="text-amber-400" />} value={pet.abilities.luck} color="bg-gradient-to-r from-amber-400 to-yellow-400" />
            </div>
          </div>

          {/* Interact buttons */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'feed',  emoji: '🍖', label: '餵食',  tip: '增加體力' },
              { key: 'pet',   emoji: '🤝', label: '互動',  tip: '提升心情' },
              { key: 'train', emoji: '⚔️', label: '訓練',  tip: '增加能力值' },
            ].map(a => (
              <button key={a.key} onClick={() => handleInteract(a.key)}
                className={`glass-card flex flex-col items-center gap-1 py-3 border transition-all active:scale-95
                  ${interacting === a.key ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-300' : 'border-white/10 hover:border-white/30'}`}>
                <span className="text-2xl">{interacting === a.key ? '✨' : a.emoji}</span>
                <span className="text-xs font-bold">{a.label}</span>
                <span className="text-[10px] text-muted">{a.tip}</span>
              </button>
            ))}
          </div>

          <div className="text-xs text-muted text-center bg-white/5 rounded-xl py-2 px-3 border border-white/10">
            💡 完成每日任務可讓夥伴心情變好，儲蓄信封餘額會影響耐力值！
          </div>
        </div>
      )}

      {/* Eggs view */}
      {view === 'eggs' && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <EggCard species="phoenix" progress={65} />
            <EggCard species="bunny" progress={30} />
          </div>
          <div className="text-center text-xs text-muted bg-white/5 rounded-xl py-3 px-4 border border-white/10">
            🥚 完成任務可加速孵化！前往<span className="text-amber-400 font-bold">販賣部</span>購買更多蛋！
          </div>
        </div>
      )}

      {/* Hatch/Encyclopedia view */}
      {view === 'hatch' && (
        <div className="flex flex-col gap-3">
          <div className="text-xs text-muted mb-1">所有可獲得的夥伴</div>
          {(Object.entries(SPECIES_INFO) as [PetSpecies, typeof SPECIES_INFO[PetSpecies]][]).map(([key, info]) => (
            <div key={key} className={`glass-card bg-gradient-to-r ${info.color} flex items-center gap-4`}>
              <span className="text-4xl">{info.emoji}</span>
              <div className="flex-1">
                <div className="font-black text-sm">{info.name}</div>
                <div className="text-xs text-muted">{info.desc}</div>
              </div>
              <div className="text-[10px] bg-white/10 px-2 py-1 rounded-lg text-muted">
                {key === 'dragon' ? '已孵化' : key === 'phoenix' ? '孵化中' : key === 'bunny' ? '孵化中' : '未獲得'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdventurePets;
