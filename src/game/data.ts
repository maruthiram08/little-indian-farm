// All tunable game content lives here, so balancing never touches game logic.

export type CropId = 'wheat' | 'marigold' | 'sugarcane';
export type ProductId = 'jaggery';
export type ItemId = CropId | ProductId;

export interface CropDef {
  id: CropId;
  name: string;
  icon: string;
  seedCost: number;
  growMs: number;
  value: number;
  unlockLevel: number;
}

export interface ItemDef {
  id: ItemId;
  name: string;
  icon: string;
  value: number;
  unlockLevel: number;
}

export const CROPS: Record<CropId, CropDef> = {
  wheat: { id: 'wheat', name: 'Wheat', icon: '🌾', seedCost: 0, growMs: 10_000, value: 4, unlockLevel: 1 },
  marigold: { id: 'marigold', name: 'Marigold', icon: '🌼', seedCost: 4, growMs: 20_000, value: 10, unlockLevel: 2 },
  sugarcane: { id: 'sugarcane', name: 'Sugarcane', icon: '🎋', seedCost: 8, growMs: 40_000, value: 18, unlockLevel: 3 },
};

export const CROP_ORDER: CropId[] = ['wheat', 'marigold', 'sugarcane'];

// The kolhu presses sugarcane into jaggery (gur).
export const KOLHU = {
  unlockLevel: 3,
  input: 'sugarcane' as CropId,
  inputQty: 2,
  output: 'jaggery' as ProductId,
  pressMs: 30_000,
};

export const ITEMS: Record<ItemId, ItemDef> = {
  wheat: { id: 'wheat', name: 'Wheat', icon: '🌾', value: CROPS.wheat.value, unlockLevel: 1 },
  marigold: { id: 'marigold', name: 'Marigold', icon: '🌼', value: CROPS.marigold.value, unlockLevel: 2 },
  sugarcane: { id: 'sugarcane', name: 'Sugarcane', icon: '🎋', value: CROPS.sugarcane.value, unlockLevel: 3 },
  jaggery: { id: 'jaggery', name: 'Jaggery', icon: '🟫', value: 50, unlockLevel: 3 },
};

export const ITEM_ORDER: ItemId[] = ['wheat', 'marigold', 'sugarcane', 'jaggery'];

// XP needed to reach each level; index 0 is level 1. Level 5 is the Diwali finish.
export const LEVEL_XP = [0, 80, 320, 800, 1600];
export const MAX_LEVEL = LEVEL_XP.length;

export const LEVEL_UNLOCK_TEXT: Record<number, string> = {
  2: 'Marigold seeds and the ghoda ride unlocked 🌼🐎',
  3: 'Sugarcane and the kolhu unlocked 🎋',
  4: 'Bigger orders from the city trader 🚚',
  5: 'The village celebrates Diwali! 🪔',
};

// Hire the village ghoda (horse) for a short, fast ride.
export const HORSE = {
  unlockLevel: 2,
  cost: 15,
  rideMs: 40_000,
  speed: 1.4,
};

// How much the farmer can carry at each level; index 0 is level 1.
export const BASKET_CAP = [10, 15, 20, 25, 30];
// When the basket is full, the haat buys goods no order wants at this share of their value.
export const SURPLUS_RATE = 0.5;

export const GRID_SIZE = 4;
export const START_PLOTS = 4;
export const START_COINS = 10;

// Cost of the nth plot bought after the starting ones.
export function plotCost(bought: number): number {
  return Math.round((15 * Math.pow(1.3, bought)) / 5) * 5;
}

export const MAX_ORDERS = 3;
export const ORDER_GAP_MS = 4_000;
// Orders pay a little more than the raw value of their goods.
export const ORDER_BONUS = 1.25;

export const VILLAGERS = [
  { name: 'Sarpanch ji', icon: '👳' },
  { name: 'Meena Teacher', icon: '👩‍🏫' },
  { name: 'Ramu Kaka', icon: '👴' },
  { name: 'Lakshmi Amma', icon: '👵' },
  { name: 'Pappu (dhaba)', icon: '🧔' },
  { name: 'Chotu', icon: '👦' },
  { name: 'Mithaiwala', icon: '👨‍🍳' },
];

export const TRADER = { name: 'City trader', icon: '🚚' };
