// ─────────────────────────────────────────────────────────────────────────────
// Adventure Zone Types
// Completely independent from budget/family management types.
// Future adventure features store their data here.
// ─────────────────────────────────────────────────────────────────────────────

// ── Avatar (冒險基地) ─────────────────────────────────────────────────────────
export type AvatarGender = 'male' | 'female' | 'other';
export type AvatarSkinTone = 'light' | 'medium' | 'tan' | 'dark';
export type WeaponType = 'sword' | 'staff' | 'bow' | 'shield' | 'wand' | 'none';
export type ArmorType = 'robe' | 'armor' | 'cloak' | 'casual' | 'none';
export type AccessoryType = 'hat' | 'crown' | 'wings' | 'aura' | 'none';

export interface AvatarEquipment {
  weapon: WeaponType;
  armor: ArmorType;
  accessory: AccessoryType;
}

export interface AdventureAvatar {
  kidId: string;
  name: string;
  gender: AvatarGender;
  skinTone: AvatarSkinTone;
  hairStyle: number;       // index 0–9
  hairColor: string;       // hex
  eyeColor: string;        // hex
  equipment: AvatarEquipment;
  useAsProfilePic: boolean;
  updatedAt: string;
}

// ── Pets (冒險夥伴) ───────────────────────────────────────────────────────────
export type PetSpecies = 'dragon' | 'cat' | 'fox' | 'wolf' | 'bunny' | 'phoenix';
export type PetStage = 'egg' | 'baby' | 'teen' | 'adult' | 'legendary';
export type PetMood = 'ecstatic' | 'happy' | 'neutral' | 'sad' | 'depressed';

export interface PetAbilities {
  strength: number;     // 0–100, affects expedition combat
  agility: number;      // 0–100, affects expedition speed
  intelligence: number; // 0–100, affects expedition loot bonus
  luck: number;         // 0–100, affects rare find rate
}

export interface AdventurePet {
  id: string;
  kidId: string;
  name: string;
  species: PetSpecies;
  stage: PetStage;
  /** mood score 0–100, computed from recent quest completion rate */
  moodScore: number;
  /** health score 0–100, affected by interaction quality */
  health: number;
  /** stamina 0–100, linked to kid's savings (investing envelope balance) */
  stamina: number;
  abilities: PetAbilities;
  exp: number;
  level: number;
  lastFedAt?: string;
  lastPetAt?: string;
  hatchedAt?: string;
  createdAt: string;
}

export interface PetEgg {
  id: string;
  kidId: string;
  species: PetSpecies;
  hatchProgress: number; // 0–100
  acquiredAt: string;
}

// ── Shop (販賣部) ─────────────────────────────────────────────────────────────
export type ShopItemCategory = 'avatar_weapon' | 'avatar_armor' | 'avatar_accessory' | 'pet_weapon' | 'pet_armor' | 'pet_food' | 'pet_egg';

export interface ShopItem {
  id: string;
  name: string;
  category: ShopItemCategory;
  emoji: string;
  description: string;
  basePrice: number;      // in gems
  /** discount tiers based on investing-envelope balance */
  discountTiers: { minSavings: number; discountPct: number }[];
  stockLimit?: number;    // undefined = unlimited
}

export interface KidInventoryItem {
  itemId: string;
  quantity: number;
  acquiredAt: string;
}

// ── Investment (投資部) ────────────────────────────────────────────────────────
export type AssetType = 'stock' | 'forex' | 'crypto'; // future: crypto

export interface VirtualAsset {
  id: string;            // e.g. 'AAPL', 'USD/JPY'
  name: string;
  type: AssetType;
  symbol: string;
  emoji: string;
  /** base fee % before savings discount */
  baseFeeRate: number;
  discountTiers: { minSavings: number; discountPct: number }[];
}

export interface InvestmentHolding {
  assetId: string;
  quantity: number;
  avgCostGems: number;
  acquiredAt: string;
}

export interface InvestmentTransaction {
  id: string;
  kidId: string;
  assetId: string;
  action: 'buy' | 'sell';
  quantity: number;
  priceGems: number;
  feeGems: number;
  timestamp: string;
}

// ── Portal (傳送門) ───────────────────────────────────────────────────────────
export type ExpeditionDestination =
  | 'ancient_forest'
  | 'crystal_cave'
  | 'sky_citadel'
  | 'deep_ocean'
  | 'volcano_isle';

export type ExpeditionStatus = 'active' | 'completed' | 'failed';

export interface ExpeditionResult {
  gemsEarned: number;
  boxesEarned: number;  // number of treasure box instances
  expEarned: number;    // pet exp
  status: ExpeditionStatus;
}

export interface ActiveExpedition {
  id: string;
  kidId: string;
  petId: string;
  destination: ExpeditionDestination;
  startedAt: string;
  returnsAt: string;
  result?: ExpeditionResult;
}

// ── Admin-managed config types ────────────────────────────────────────────────
// Stored in Firestore: adventureConfig/{configType}
// Super admin (and optionally senior admin) can CRUD these via the admin panel.

export interface AdventureConfigItem {
  id: string;
  hidden: boolean; // true = not shown to kids
}

export interface ManagedShopItem extends AdventureConfigItem {
  name: string;
  category: ShopItemCategory;
  emoji: string;
  description: string;
  basePrice: number;
  discountTiers: { minSavings: number; discountPct: number }[];
}

export interface ManagedPetSpecies extends AdventureConfigItem {
  speciesKey: PetSpecies; // matches PetSpecies union
  name: string;
  emoji: string;
  desc: string;
  colorFrom: string; // Tailwind gradient from-* class
  colorTo: string;   // Tailwind gradient to-* class
}

export interface ManagedDestination extends AdventureConfigItem {
  emoji: string;
  name: string;
  desc: string;
  durationHours: number;
  requiredLevel: number;
  baseGemRewardMin: number;
  baseGemRewardMax: number;
  baseExpRewardMin: number;
  baseExpRewardMax: number;
  successRate: number; // base %, 1–99
}

export interface ManagedAsset extends AdventureConfigItem {
  name: string;
  type: AssetType;
  symbol: string;
  emoji: string;
  baseFeeRate: number; // %
  discountTiers: { minSavings: number; discountPct: number }[];
}

export type AdventureConfigType = 'shopItems' | 'petSpecies' | 'destinations' | 'assets';

export interface AdventureConfigDoc {
  allowSeniorEdit: boolean; // reserved: when true, senior admins can also edit
  items: AdventureConfigItem[];
  updatedAt: string;
  updatedBy?: string; // Firebase UID of last editor
}

// ── Aggregated adventure profile (stored per kid) ─────────────────────────────
export interface AdventureProfile {
  kidId: string;
  avatar?: AdventureAvatar;
  pets: AdventurePet[];
  eggs: PetEgg[];
  inventory: KidInventoryItem[];
  holdings: InvestmentHolding[];
  activeExpeditions: ActiveExpedition[];
  completedExpeditions: number;
  totalGemsFromAdventure: number;
  updatedAt: string;
}
