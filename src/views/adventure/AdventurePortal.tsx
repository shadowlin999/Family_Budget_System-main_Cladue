import React, { useState } from 'react';
import { MapPin, Clock, Gem, Star, Zap, Wind, Brain, Lock } from 'lucide-react';
import type { ExpeditionDestination } from '../../types/adventure';

// ── Static destination data ───────────────────────────────────────────────────
interface DestinationInfo {
  key: ExpeditionDestination;
  emoji: string;
  name: string;
  desc: string;
  color: string;
  durationHours: number;
  requiredLevel: number;
  baseGemReward: [number, number]; // [min, max]
  baseExpReward: [number, number];
  successRate: number; // base %
}

const DESTINATIONS: DestinationInfo[] = [
  {
    key: 'ancient_forest',
    emoji: '🌲',
    name: '古老森林',
    desc: '蒼翠的森林中藏有許多寶物，適合初心者探索！',
    color: 'from-green-500/30 to-emerald-600/30',
    durationHours: 2,
    requiredLevel: 1,
    baseGemReward: [10, 30],
    baseExpReward: [20, 50],
    successRate: 80,
  },
  {
    key: 'crystal_cave',
    emoji: '💎',
    name: '水晶洞穴',
    desc: '閃耀的水晶礦脈，寶石豐富但地形複雜！',
    color: 'from-cyan-500/30 to-blue-600/30',
    durationHours: 4,
    requiredLevel: 3,
    baseGemReward: [25, 60],
    baseExpReward: [40, 90],
    successRate: 65,
  },
  {
    key: 'sky_citadel',
    emoji: '🏰',
    name: '天空城堡',
    desc: '漂浮在雲端的神秘城堡，傳說中有巨大寶藏！',
    color: 'from-violet-500/30 to-purple-600/30',
    durationHours: 8,
    requiredLevel: 5,
    baseGemReward: [50, 120],
    baseExpReward: [80, 180],
    successRate: 55,
  },
  {
    key: 'deep_ocean',
    emoji: '🌊',
    name: '深海遺跡',
    desc: '沉睡在海底的古代文明，危機四伏卻寶藏無數！',
    color: 'from-blue-500/30 to-indigo-600/30',
    durationHours: 12,
    requiredLevel: 8,
    baseGemReward: [80, 200],
    baseExpReward: [120, 260],
    successRate: 45,
  },
  {
    key: 'volcano_isle',
    emoji: '🌋',
    name: '火山島',
    desc: '熔岩與火焰的領域，最強夥伴才能征服！',
    color: 'from-red-500/30 to-orange-600/30',
    durationHours: 24,
    requiredLevel: 12,
    baseGemReward: [150, 400],
    baseExpReward: [200, 500],
    successRate: 35,
  },
];

// Demo active expedition
const DEMO_EXPEDITION = {
  destination: 'crystal_cave' as ExpeditionDestination,
  petName: '小火球',
  petEmoji: '🐉',
  startedAt: new Date(Date.now() - 1.5 * 3600 * 1000).toISOString(),
  returnsAt: new Date(Date.now() + 2.5 * 3600 * 1000).toISOString(),
};

// Demo pet for sending
const DEMO_PET_LEVEL = 3;
const DEMO_PET_ABILITIES = { strength: 65, agility: 40, intelligence: 35, luck: 45 };

function calcActualSuccess(base: number, abilities: typeof DEMO_PET_ABILITIES): number {
  const bonus = Math.floor((abilities.strength + abilities.agility + abilities.intelligence + abilities.luck) / 40);
  return Math.min(95, base + bonus);
}

// Snapshot taken at module load time — this is a demo-only component with static data
const _NOW = Date.now();

function calcTimeLeft(returnsAt: string): string {
  const ms = new Date(returnsAt).getTime() - _NOW;
  if (ms <= 0) return '已回來！';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `${h}h ${m}m` : `${m} 分鐘`;
}

// ── Sub-components ────────────────────────────────────────────────────────────
const AbilityChip: React.FC<{ icon: React.ReactNode; value: number; label: string }> = ({ icon, value, label }) => (
  <div className="flex items-center gap-1 bg-white/10 px-2 py-1 rounded-lg text-[10px]">
    {icon}
    <span className="text-muted">{label}</span>
    <span className="font-bold">{value}</span>
  </div>
);

// ── Main component ────────────────────────────────────────────────────────────
const AdventurePortal: React.FC = () => {
  const [hasActiveExpedition] = useState(true);
  const [selectedDest, setSelectedDest] = useState<ExpeditionDestination | null>(null);
  const petLevel = DEMO_PET_LEVEL;
  const abilities = DEMO_PET_ABILITIES;
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="text-center">
        <div className="w-14 h-14 bg-violet-500/20 rounded-full flex items-center justify-center mx-auto mb-2">
          <MapPin size={28} className="text-violet-400" />
        </div>
        <h4 className="text-xl font-black">傳送門</h4>
        <p className="text-xs text-muted">派遣夥伴出征，帶回寶物！</p>
      </div>

      {/* Active expedition status */}
      {hasActiveExpedition && (
        <div className="glass-card bg-gradient-to-r from-violet-500/10 to-indigo-500/10 border border-violet-400/20">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
            <span className="text-xs font-black text-violet-300">出征中</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-4xl">{DEMO_EXPEDITION.petEmoji}</div>
            <div className="flex-1">
              <div className="font-black text-sm">{DEMO_EXPEDITION.petName}</div>
              <div className="text-xs text-muted">
                → {DESTINATIONS.find(d => d.key === DEMO_EXPEDITION.destination)?.name}
              </div>
              <div className="flex items-center gap-1 mt-1 text-xs text-violet-300 font-bold">
                <Clock size={11} />
                還有 {calcTimeLeft(DEMO_EXPEDITION.returnsAt)} 回來
              </div>
            </div>
            <button disabled
              className="text-xs bg-white/5 border border-white/10 text-muted px-3 py-1.5 rounded-xl cursor-not-allowed">
              等待中
            </button>
          </div>
          {/* Progress bar */}
          <div className="mt-3">
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-violet-400 to-indigo-400 rounded-full"
                style={{
                  width: `${Math.min(100, (_NOW - new Date(DEMO_EXPEDITION.startedAt).getTime()) /
                    (new Date(DEMO_EXPEDITION.returnsAt).getTime() - new Date(DEMO_EXPEDITION.startedAt).getTime()) * 100)}%`
                }} />
            </div>
          </div>
        </div>
      )}

      {/* Pet status bar */}
      <div className="glass-card">
        <div className="text-xs font-bold text-muted mb-2">🐉 小火球 — 出征能力</div>
        <div className="flex flex-wrap gap-1.5">
          <AbilityChip icon={<Star size={10} className="text-amber-400" />} value={petLevel} label="等級" />
          <AbilityChip icon={<Star size={10} className="text-red-400" />} value={abilities.strength} label="力量" />
          <AbilityChip icon={<Wind size={10} className="text-cyan-400" />} value={abilities.agility} label="敏捷" />
          <AbilityChip icon={<Brain size={10} className="text-violet-400" />} value={abilities.intelligence} label="智力" />
          <AbilityChip icon={<Zap size={10} className="text-yellow-400" />} value={abilities.luck} label="幸運" />
        </div>
        <div className="mt-2 text-[10px] text-muted">
          💡 互動、訓練、購買寵物食物可提升夥伴能力值！
        </div>
      </div>

      {/* Destinations */}
      <div>
        <div className="text-xs font-bold text-muted mb-3">選擇目的地</div>
        <div className="flex flex-col gap-3">
          {DESTINATIONS.map(dest => {
            const locked = petLevel < dest.requiredLevel;
            const successRate = calcActualSuccess(dest.successRate, abilities);
            const isSelected = selectedDest === dest.key;

            return (
              <div key={dest.key}>
                <button
                  onClick={() => !locked && setSelectedDest(isSelected ? null : dest.key)}
                  className={`w-full text-left glass-card bg-gradient-to-r ${dest.color} border transition-all
                    ${locked ? 'opacity-60 cursor-not-allowed border-white/5' : isSelected ? 'border-violet-400/40' : 'border-white/10 hover:border-white/30'}`}>
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{dest.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-black text-sm">{dest.name}</span>
                        {locked && (
                          <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-400/20 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
                            <Lock size={9} /> Lv.{dest.requiredLevel}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted mt-0.5">{dest.desc}</div>
                      <div className="flex gap-3 mt-2 flex-wrap">
                        <span className="flex items-center gap-1 text-[10px] text-muted">
                          <Clock size={9} /> {dest.durationHours}h
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-amber-400">
                          <Gem size={9} /> {dest.baseGemReward[0]}~{dest.baseGemReward[1]}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-blue-400">
                          <Star size={9} /> EXP {dest.baseExpReward[0]}~{dest.baseExpReward[1]}
                        </span>
                        {!locked && (
                          <span className={`text-[10px] font-bold ${successRate >= 70 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                            成功率 {successRate}%
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </button>

                {/* Send panel */}
                {isSelected && !locked && (
                  <div className="mt-1 glass-card border border-violet-400/20 bg-violet-400/5 flex flex-col gap-3">
                    <div className="text-xs font-bold">派遣設定</div>
                    <div className="text-xs text-muted flex flex-col gap-1.5">
                      <div className="flex justify-between">
                        <span>夥伴</span><span className="font-bold">🐉 小火球</span>
                      </div>
                      <div className="flex justify-between">
                        <span>目的地</span><span className="font-bold">{dest.emoji} {dest.name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>預計耗時</span><span className="font-bold">{dest.durationHours} 小時</span>
                      </div>
                      <div className="flex justify-between">
                        <span>成功率</span>
                        <span className={`font-bold ${successRate >= 70 ? 'text-green-400' : successRate >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                          {successRate}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>預期獎勵</span>
                        <span className="font-bold text-amber-400">💎 {dest.baseGemReward[0]}–{dest.baseGemReward[1]} 寶石</span>
                      </div>
                    </div>
                    <button
                      disabled={hasActiveExpedition}
                      className={`w-full py-2.5 rounded-xl font-black text-sm transition-all
                        ${hasActiveExpedition
                          ? 'bg-white/5 border border-white/10 text-muted cursor-not-allowed'
                          : 'bg-violet-500/20 border border-violet-400/30 text-violet-300 hover:bg-violet-500/30 active:scale-95'}`}>
                      {hasActiveExpedition ? '夥伴出征中，無法派遣' : `🚀 出發！`}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="text-xs text-muted text-center bg-white/5 rounded-xl py-2.5 px-4 border border-white/10">
        🗺️ 提升夥伴能力值可增加成功率與獎勵量！訓練你的夥伴，挑戰更難的遠征！
      </div>
    </div>
  );
};

export default AdventurePortal;
