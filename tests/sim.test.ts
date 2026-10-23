import { describe, expect, it } from 'vitest';
import { CROPS, KOLHU, LEVEL_XP, MAX_LEVEL } from '../src/game/data';
import {
  buyPlot,
  orderProgress,
  collectPress,
  dismissOrder,
  fulfill,
  harvest,
  kolhuStatus,
  levelForXp,
  newGame,
  plant,
  restore,
  startPress,
  tick,
} from '../src/game/sim';

const T0 = 1_000_000;
const fixedRng = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

describe('fields', () => {
  it('grows wheat for free and harvests it when ripe', () => {
    const s = newGame(T0);
    expect(plant(s, 0, 'wheat', T0).ok).toBe(true);
    expect(s.coins).toBe(10);
    expect(harvest(s, 0, T0 + CROPS.wheat.growMs - 1).ok).toBe(false);
    expect(harvest(s, 0, T0 + CROPS.wheat.growMs).ok).toBe(true);
    expect(s.inventory.wheat).toBe(1);
    expect(s.plots[0].crop).toBeNull();
  });

  it('keeps growing while the game is closed', () => {
    const s = newGame(T0);
    plant(s, 0, 'wheat', T0);
    const reopened = restore(JSON.parse(JSON.stringify(s)), T0 + 3_600_000);
    expect(harvest(reopened, 0, T0 + 3_600_000).ok).toBe(true);
  });

  it('refuses locked crops and uncleared land', () => {
    const s = newGame(T0);
    expect(plant(s, 0, 'marigold', T0).ok).toBe(false);
    expect(plant(s, 10, 'wheat', T0).ok).toBe(false);
  });

  it('buys plots at rising prices', () => {
    const s = newGame(T0);
    s.coins = 100;
    expect(buyPlot(s, 10).ok).toBe(true);
    expect(s.coins).toBe(85);
    expect(s.plots[10].unlocked).toBe(true);
    expect(buyPlot(s, 11).ok).toBe(true);
    expect(s.coins).toBeLessThan(70);
    s.coins = 0;
    expect(buyPlot(s, 12).ok).toBe(false);
  });
});

describe('kolhu', () => {
  it('presses 2 sugarcane into 1 jaggery once unlocked', () => {
    const s = newGame(T0);
    expect(kolhuStatus(s, T0)).toBe('locked');
    s.xp = LEVEL_XP[2];
    s.level = levelForXp(s.xp);
    s.inventory.sugarcane = 2;
    expect(startPress(s, T0).ok).toBe(true);
    expect(s.inventory.sugarcane).toBe(0);
    expect(kolhuStatus(s, T0 + 1)).toBe('pressing');
    expect(collectPress(s, T0 + 1).ok).toBe(false);
    expect(collectPress(s, T0 + KOLHU.pressMs).ok).toBe(true);
    expect(s.inventory.jaggery).toBe(1);
    expect(kolhuStatus(s, T0 + KOLHU.pressMs)).toBe('idle');
  });
});

describe('orders', () => {
  it('starts with an easy wheat order that pays coins and xp', () => {
    const s = newGame(T0);
    const first = s.orders[0];
    expect(fulfill(s, first.id, T0).ok).toBe(false);
    s.inventory.wheat = 2;
    const r = fulfill(s, first.id, T0);
    expect(r.ok).toBe(true);
    expect(s.coins).toBe(10 + first.coins);
    expect(s.xp).toBe(first.xp);
    expect(s.inventory.wheat).toBe(0);
  });

  it('fills the haat up to 3 customers over time, only asking for unlocked goods', () => {
    const s = newGame(T0);
    tick(s, T0 + 60_000, Math.random);
    expect(s.orders.length).toBe(3);
    for (const o of s.orders) for (const l of o.lines) expect(l.item).toBe('wheat');
  });

  it('replaces a dismissed customer after a short gap', () => {
    const s = newGame(T0);
    tick(s, T0 + 60_000, fixedRng([0.1, 0.9, 0.3]));
    const id = s.orders[0].id;
    expect(dismissOrder(s, id, T0 + 60_000).ok).toBe(true);
    expect(s.orders.length).toBe(2);
    tick(s, T0 + 60_001, Math.random);
    expect(s.orders.length).toBe(2);
    tick(s, T0 + 70_000, Math.random);
    expect(s.orders.length).toBe(3);
  });

  it('reports each level gained', () => {
    const s = newGame(T0);
    s.inventory.wheat = 2;
    s.orders[0].xp = LEVEL_XP[2];
    const r = fulfill(s, s.orders[0].id, T0);
    expect(r.levelsGained).toEqual([2, 3]);
    expect(s.level).toBe(3);
  });
});

describe('closed loop', () => {
  it('a greedy player reaches the final level by just playing', () => {
    // Simulates a player who taps every 0.5 s: harvest, press, fill orders, plant, buy land.
    const s = newGame(T0);
    const rng = fixedRng([0.13, 0.71, 0.42, 0.95, 0.05, 0.58, 0.33, 0.87]);
    let now = T0;
    const limit = T0 + 60 * 60_000;
    while (s.level < MAX_LEVEL && now < limit) {
      now += 500;
      tick(s, now, rng);
      s.plots.forEach((_, i) => harvest(s, i, now));
      collectPress(s, now);
      startPress(s, now);
      for (const o of [...s.orders]) fulfill(s, o.id, now);
      // Drop orders that wait too long so the haat keeps moving.
      if (s.orders.length === 3 && rng() < 0.01) dismissOrder(s, s.orders[0].id, now);
      s.plots.forEach((p, i) => {
        if (!p.unlocked || p.crop) return;
        const crop = s.level >= 3 && i % 2 === 0 ? 'sugarcane' : s.level >= 2 && i % 3 === 0 ? 'marigold' : 'wheat';
        if (plant(s, i, crop, now).ok === false) plant(s, i, 'wheat', now);
      });
      const locked = s.plots.findIndex((p) => !p.unlocked);
      if (locked >= 0) buyPlot(s, locked);
    }
    expect(s.level).toBe(MAX_LEVEL);
    const minutes = (now - T0) / 60_000;
    // Pacing target from the plan: roughly 15 minutes for the whole run.
    expect(minutes).toBeGreaterThan(5);
    expect(minutes).toBeLessThan(30);
    console.log(`reached level ${MAX_LEVEL} in ${minutes.toFixed(1)} min, ${s.plots.filter((p) => p.unlocked).length} plots`);
  });
});

describe('saves', () => {
  it('starts fresh from a missing or broken save', () => {
    expect(restore(null, T0).coins).toBe(10);
    expect(restore({ version: 99 }, T0).coins).toBe(10);
    expect(restore({ version: 1, plots: [] }, T0).plots.length).toBe(16);
  });
});

describe('order progress', () => {
  it('shares one carried pile across orders, first order first', () => {
    const s = newGame(0);
    s.orders = [
      { id: 1, who: 'Dadi', icon: '👵', lines: [{ item: 'wheat', qty: 2 }], coins: 10, xp: 8 },
      { id: 2, who: 'Ravi', icon: '👦', lines: [{ item: 'wheat', qty: 3 }], coins: 15, xp: 10 },
    ];
    s.inventory.wheat = 3;
    const [a, b] = orderProgress(s);
    expect(a).toEqual({ have: [2], ready: true });
    expect(b).toEqual({ have: [1], ready: false });
  });
});
