// The game's rules, with no rendering. Every function takes `now` (ms) so the
// simulation is deterministic in tests and crops keep growing while the game is closed.
import {
  CROPS,
  CropId,
  GRID_SIZE,
  ITEMS,
  ITEM_ORDER,
  ItemId,
  KOLHU,
  LEVEL_XP,
  MAX_LEVEL,
  MAX_ORDERS,
  ORDER_BONUS,
  ORDER_GAP_MS,
  START_COINS,
  START_PLOTS,
  TRADER,
  VILLAGERS,
  plotCost,
} from './data';

export interface Plot {
  unlocked: boolean;
  crop: CropId | null;
  plantedAt: number;
}

export interface OrderLine {
  item: ItemId;
  qty: number;
}

export interface Order {
  id: number;
  who: string;
  icon: string;
  lines: OrderLine[];
  coins: number;
  xp: number;
}

export interface GameState {
  version: 1;
  coins: number;
  xp: number;
  level: number;
  celebrated: boolean;
  plots: Plot[];
  plotsBought: number;
  inventory: Record<ItemId, number>;
  kolhuStartedAt: number | null;
  orders: Order[];
  nextOrderAt: number;
  nextOrderId: number;
}

export type Rng = () => number;

export type Result = { ok: true } | { ok: false; reason: string };

const ok: Result = { ok: true };
const fail = (reason: string): Result => ({ ok: false, reason });

export function newGame(now: number): GameState {
  const plots: Plot[] = [];
  for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
    plots.push({ unlocked: i < START_PLOTS, crop: null, plantedAt: 0 });
  }
  return {
    version: 1,
    coins: START_COINS,
    xp: 0,
    level: 1,
    celebrated: false,
    plots,
    plotsBought: 0,
    inventory: { wheat: 0, marigold: 0, sugarcane: 0, jaggery: 0 },
    kolhuStartedAt: null,
    // A first, easy order so a new player knows what to do.
    orders: [{ id: 1, who: 'Dadi', icon: '👵', lines: [{ item: 'wheat', qty: 2 }], coins: 10, xp: 8 }],
    nextOrderAt: now + ORDER_GAP_MS,
    nextOrderId: 2,
  };
}

export function levelForXp(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_XP.length; i++) {
    if (xp >= LEVEL_XP[i]) level = i + 1;
  }
  return level;
}

/** Progress from 0 to 1 towards the next level; 1 at max level. */
export function levelProgress(state: GameState): number {
  if (state.level >= MAX_LEVEL) return 1;
  const from = LEVEL_XP[state.level - 1];
  const to = LEVEL_XP[state.level];
  return Math.min(1, (state.xp - from) / (to - from));
}

export function isCropUnlocked(state: GameState, crop: CropId): boolean {
  return state.level >= CROPS[crop].unlockLevel;
}

export function growProgress(plot: Plot, now: number): number {
  if (!plot.crop) return 0;
  return Math.min(1, (now - plot.plantedAt) / CROPS[plot.crop].growMs);
}

export function isRipe(plot: Plot, now: number): boolean {
  return plot.crop !== null && growProgress(plot, now) >= 1;
}

export function plant(state: GameState, index: number, crop: CropId, now: number): Result {
  const plot = state.plots[index];
  if (!plot || !plot.unlocked) return fail('This land is not cleared yet');
  if (plot.crop) return fail('Something is already growing here');
  if (!isCropUnlocked(state, crop)) return fail(`${CROPS[crop].name} unlocks at level ${CROPS[crop].unlockLevel}`);
  const cost = CROPS[crop].seedCost;
  if (state.coins < cost) return fail('Not enough coins for seeds');
  state.coins -= cost;
  plot.crop = crop;
  plot.plantedAt = now;
  return ok;
}

export function harvest(state: GameState, index: number, now: number): Result {
  const plot = state.plots[index];
  if (!plot || !plot.crop) return fail('Nothing to harvest');
  if (!isRipe(plot, now)) return fail('Not ready yet');
  state.inventory[plot.crop] += 1;
  plot.crop = null;
  plot.plantedAt = 0;
  return ok;
}

export function nextPlotCost(state: GameState): number {
  return plotCost(state.plotsBought);
}

export function buyPlot(state: GameState, index: number): Result {
  const plot = state.plots[index];
  if (!plot) return fail('No such plot');
  if (plot.unlocked) return fail('Already cleared');
  const cost = nextPlotCost(state);
  if (state.coins < cost) return fail(`Clearing costs ${cost} coins`);
  state.coins -= cost;
  plot.unlocked = true;
  state.plotsBought += 1;
  return ok;
}

export type KolhuStatus = 'locked' | 'idle' | 'pressing' | 'ready';

export function kolhuStatus(state: GameState, now: number): KolhuStatus {
  if (state.level < KOLHU.unlockLevel) return 'locked';
  if (state.kolhuStartedAt === null) return 'idle';
  return now - state.kolhuStartedAt >= KOLHU.pressMs ? 'ready' : 'pressing';
}

export function kolhuProgress(state: GameState, now: number): number {
  if (state.kolhuStartedAt === null) return 0;
  return Math.min(1, (now - state.kolhuStartedAt) / KOLHU.pressMs);
}

export function startPress(state: GameState, now: number): Result {
  const status = kolhuStatus(state, now);
  if (status === 'locked') return fail(`The kolhu opens at level ${KOLHU.unlockLevel}`);
  if (status !== 'idle') return fail('The kolhu is busy');
  if (state.inventory[KOLHU.input] < KOLHU.inputQty) return fail(`Needs ${KOLHU.inputQty} sugarcane`);
  state.inventory[KOLHU.input] -= KOLHU.inputQty;
  state.kolhuStartedAt = now;
  return ok;
}

export function collectPress(state: GameState, now: number): Result {
  if (kolhuStatus(state, now) !== 'ready') return fail('Jaggery is not ready');
  state.inventory[KOLHU.output] += 1;
  state.kolhuStartedAt = null;
  return ok;
}

export function canFulfill(state: GameState, order: Order): boolean {
  return order.lines.every((l) => state.inventory[l.item] >= l.qty);
}

export interface OrderProgress {
  /** How many of each line's items are set aside for this order. */
  have: number[];
  ready: boolean;
}

/** Splits what you carry across the orders in turn, so two orders never count the same wheat. */
export function orderProgress(state: GameState): OrderProgress[] {
  const left = { ...state.inventory };
  return state.orders.map((o) => {
    const ready = o.lines.every((l) => left[l.item] >= l.qty);
    const have = o.lines.map((l) => Math.min(left[l.item], l.qty));
    if (ready) for (const l of o.lines) left[l.item] -= l.qty;
    return { have, ready };
  });
}

export interface FulfillResult {
  ok: boolean;
  reason?: string;
  levelsGained: number[];
}

export function fulfill(state: GameState, orderId: number, now: number): FulfillResult {
  const order = state.orders.find((o) => o.id === orderId);
  if (!order) return { ok: false, reason: 'That villager has left', levelsGained: [] };
  if (!canFulfill(state, order)) return { ok: false, reason: 'You need more goods', levelsGained: [] };
  for (const line of order.lines) state.inventory[line.item] -= line.qty;
  state.coins += order.coins;
  state.xp += order.xp;
  removeOrder(state, orderId, now);
  const before = state.level;
  state.level = levelForXp(state.xp);
  const levelsGained: number[] = [];
  for (let l = before + 1; l <= state.level; l++) levelsGained.push(l);
  return { ok: true, levelsGained };
}

export function dismissOrder(state: GameState, orderId: number, now: number): Result {
  if (!state.orders.some((o) => o.id === orderId)) return fail('That villager has left');
  removeOrder(state, orderId, now);
  return ok;
}

function removeOrder(state: GameState, orderId: number, now: number): void {
  state.orders = state.orders.filter((o) => o.id !== orderId);
  state.nextOrderAt = Math.max(state.nextOrderAt, now + ORDER_GAP_MS);
}

export function availableItems(state: GameState): ItemId[] {
  return ITEM_ORDER.filter((id) => state.level >= ITEMS[id].unlockLevel);
}

export function makeOrder(state: GameState, rng: Rng, id: number): Order {
  const items = availableItems(state);
  const pick = <T,>(list: T[]): T => list[Math.floor(rng() * list.length)];
  const isTrader = state.level >= 4 && rng() < 0.25;
  const lineCount = items.length > 1 && rng() < 0.5 ? 2 : 1;
  const chosen: ItemId[] = [];
  while (chosen.length < lineCount) {
    const item = pick(items);
    if (!chosen.includes(item)) chosen.push(item);
  }
  const maxQty = state.level >= 4 ? 4 : 3;
  const lines = chosen.map((item) => {
    let qty = item === 'jaggery' ? 1 : 1 + Math.floor(rng() * maxQty);
    if (isTrader) qty *= 2;
    return { item, qty };
  });
  const value = lines.reduce((sum, l) => sum + ITEMS[l.item].value * l.qty, 0);
  const present = state.orders.map((o) => o.who);
  const free = VILLAGERS.filter((v) => !present.includes(v.name));
  const who = isTrader ? TRADER : pick(free.length ? free : VILLAGERS);
  return {
    id,
    who: who.name,
    icon: who.icon,
    lines,
    coins: Math.ceil(value * ORDER_BONUS),
    xp: value,
  };
}

/** Advance time-based state: new customers arrive at the haat. */
export function tick(state: GameState, now: number, rng: Rng): void {
  while (state.orders.length < MAX_ORDERS && now >= state.nextOrderAt) {
    state.orders.push(makeOrder(state, rng, state.nextOrderId++));
    state.nextOrderAt += ORDER_GAP_MS;
  }
}

/** Fills in fields missing from older saves and rejects anything unusable. */
export function restore(raw: unknown, now: number): GameState {
  const fresh = newGame(now);
  if (!raw || typeof raw !== 'object' || (raw as GameState).version !== 1) return fresh;
  const saved = raw as GameState;
  if (!Array.isArray(saved.plots) || saved.plots.length !== fresh.plots.length) return fresh;
  return {
    ...fresh,
    ...saved,
    inventory: { ...fresh.inventory, ...saved.inventory },
    level: levelForXp(saved.xp ?? 0),
  };
}
