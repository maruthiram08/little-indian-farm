import * as THREE from 'three';
import { CROPS, CropId, HORSE, ITEMS, KOLHU, LEVEL_UNLOCK_TEXT, MAX_LEVEL } from './game/data';
import { addPlayTime, record, report } from './game/playtest';
import { clearSave, loadGame, loadLog, saveGame, saveLog } from './game/save';
import {
  GameState,
  buyPlot,
  canFulfill,
  collectPress,
  dismissOrder,
  fulfill,
  harvest,
  hireHorse,
  isCropUnlocked,
  isRipe,
  kolhuStatus,
  nextPlotCost,
  orderProgress,
  plant,
  rideLeft,
  startPress,
  tick,
} from './game/sim';
import { Controls } from './three/controls';
import {
  BOUNDS,
  HAAT_ZONE,
  HAAT_ZONE_RADIUS,
  HORSE_POS,
  HORSE_ZONE,
  HORSE_ZONE_RADIUS,
  KOLHU_POS,
  KOLHU_ZONE_RADIUS,
  World,
  plotAt,
  plotCenter,
} from './three/world';
import { Hud } from './ui/hud';

let state: GameState = loadGame(Date.now());
let selectedSeed: CropId = 'wheat';
const playtest = loadLog(Date.now());
const playtestMode = new URLSearchParams(location.search).has('playtest') || location.hash === '#playtest';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game')!.appendChild(renderer.domElement);

let world = new World();
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 120);
const controls = new Controls(renderer.domElement);

const hud = new Hud({
  onSeed(crop) {
    if (!isCropUnlocked(state, crop)) {
      hud.toast(`${CROPS[crop].name} unlocks at level ${CROPS[crop].unlockLevel}`);
      return;
    }
    selectedSeed = crop;
    hud.toast(`Fields you harvest now get ${CROPS[crop].name} ${CROPS[crop].icon}`);
  },
  onDismiss(id) {
    if (dismissOrder(state, id, Date.now()).ok) record(playtest, 'dismiss');
  },
  onReport() {
    const device = `${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? 'unknown'} · ${window.innerWidth}×${window.innerHeight}`;
    hud.report(report(playtest, device));
  },
  showReport: playtestMode,
  onReset() {
    hud.modal('Start over?', 'This clears your village and starts a new game.', [
      { text: 'Cancel' },
      {
        text: 'Start over',
        primary: true,
        onClick: () => {
          clearSave();
          record(playtest, 'reset');
          state = loadGame(Date.now());
          selectedSeed = 'wheat';
          world = new World();
          hud.toast('Walk onto the soil to plant wheat 🌾');
        },
      },
    ]);
  },
});

function resize(): void {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const persist = () => {
  saveGame(state);
  saveLog(playtest);
};
document.addEventListener('visibilitychange', persist);
window.addEventListener('pagehide', persist);

// ---------- movement ----------

const SPEED = 5.5;

const velocity = new THREE.Vector3();
const wanted = new THREE.Vector3();

function step(dt: number): boolean {
  const farmer = world.farmer.root;
  const dir = hud.modalOpen ? { x: 0, z: 0 } : controls.direction();
  const speed = SPEED * (rideLeft(state, Date.now()) > 0 ? HORSE.speed : 1);
  // Ease towards the wanted velocity, so starting, stopping and turning feel smooth rather than snappy.
  wanted.set(dir.x * speed, 0, dir.z * speed);
  velocity.lerp(wanted, 1 - Math.exp(-dt * 9));
  if (velocity.length() < 0.25 && wanted.lengthSq() === 0) {
    velocity.set(0, 0, 0);
    return false;
  }
  let x = farmer.position.x + velocity.x * dt;
  let z = farmer.position.z + velocity.z * dt;
  for (const o of world.obstacles) {
    if (o.hw !== undefined && o.hd !== undefined) {
      // Push out of a box along whichever side is nearest.
      const px = o.hw + 0.35 - Math.abs(x - o.x);
      const pz = o.hd + 0.35 - Math.abs(z - o.z);
      if (px > 0 && pz > 0) {
        if (px < pz) x += Math.sign(x - o.x || 1) * px;
        else z += Math.sign(z - o.z || 1) * pz;
      }
      continue;
    }
    const dx = x - o.x;
    const dz = z - o.z;
    const d = Math.hypot(dx, dz);
    const min = o.r + 0.35;
    if (d < min && d > 0.0001) {
      x = o.x + (dx / d) * min;
      z = o.z + (dz / d) * min;
    }
  }
  farmer.position.x = THREE.MathUtils.clamp(x, BOUNDS.minX, BOUNDS.maxX);
  farmer.position.z = THREE.MathUtils.clamp(z, BOUNDS.minZ, BOUNDS.maxZ);
  let diff = Math.atan2(velocity.x, velocity.z) - farmer.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  farmer.rotation.y += diff * (1 - Math.exp(-dt * 8));
  return true;
}

// ---------- what happens where you stand ----------

const KOLHU_ZONE = new THREE.Vector3(KOLHU_POS.x + 0.4, 0, KOLHU_POS.z);
let currentPlot = -1;
let holdTime = 0;
let holdDone = false;
let haatCooldown = 0;
let horseHold = 0;
let warnedHorse = false;
let wasRiding = false;
let warnedSeed = false;
let hintStage = state.xp > 0 ? 3 : 0;
const up = (v: THREE.Vector3, y: number) => v.clone().setY(y);

const CLEAR_HOLD = 1;

function interact(dt: number, now: number, moving: boolean): void {
  if (hud.modalOpen) return;
  const pos = world.farmer.root.position;
  const plotIndex = plotAt(pos.x, pos.z);
  if (plotIndex !== currentPlot) {
    currentPlot = plotIndex;
    holdTime = 0;
    holdDone = false;
    warnedSeed = false;
  }

  if (plotIndex >= 0) {
    const p = state.plots[plotIndex];
    const at = plotCenter(plotIndex);
    if (!p.unlocked) {
      // Land is cleared only when you stop on it, so walking across the field never spends coins.
      const affordable = state.coins >= nextPlotCost(state);
      if (moving || !affordable) holdTime = 0;
      else holdTime += dt;
      if (!affordable && !moving && !warnedSeed) {
        warnedSeed = true;
        hud.toast(`Clearing this land costs 🪙 ${nextPlotCost(state)}`);
      }
      if (holdTime > CLEAR_HOLD && !holdDone) {
        holdDone = true;
        const cost = nextPlotCost(state);
        const r = buyPlot(state, plotIndex);
        if (r.ok) {
          record(playtest, 'plot');
          hud.float(`Cleared! −🪙${cost}`, up(at, 1), camera);
        }
        else hud.toast(`Clearing this land costs 🪙 ${cost}`);
      }
    } else if (!p.crop) {
      const r = plant(state, plotIndex, selectedSeed, now);
      if (r.ok) {
        record(playtest, 'plant', selectedSeed);
        hud.float(`🌱${CROPS[selectedSeed].icon}`, up(at, 0.8), camera);
      }
      if (!r.ok && selectedSeed !== 'wheat') {
        if (plant(state, plotIndex, 'wheat', now).ok) {
          record(playtest, 'plant', 'wheat');
          hud.float('🌱🌾', up(at, 0.8), camera);
        }
        if (!warnedSeed) hud.toast(`Not enough coins for ${CROPS[selectedSeed].name}, planted wheat`);
        warnedSeed = true;
      }
    } else if (isRipe(p, now)) {
      const crop = p.crop;
      harvest(state, plotIndex, now);
      record(playtest, 'harvest', crop);
      hud.float(`+1 ${CROPS[crop].icon}`, up(at, 1.2), camera);
      if (hintStage === 1) {
        hintStage = 2;
        hud.toast('Carry the wheat to the haat on the right →');
      }
    }
  }

  // Ghoda: stand still at the hitching post to hire a ride
  const atHorse = pos.distanceTo(HORSE_ZONE) < HORSE_ZONE_RADIUS + 0.2;
  if (!atHorse || moving || rideLeft(state, now) > 0 || state.level < HORSE.unlockLevel) horseHold = 0;
  else if (state.coins < HORSE.cost) {
    if (!warnedHorse) hud.toast(`A ghoda ride costs 🪙 ${HORSE.cost}`);
    warnedHorse = true;
  } else {
    horseHold += dt;
    if (horseHold > 0.6 && hireHorse(state, now).ok) {
      horseHold = 0;
      record(playtest, 'horse');
      hud.float(`−🪙${HORSE.cost}`, up(HORSE_ZONE, 2.4), camera);
      hud.toast(`Chal, ghoda! 🐎 Faster for ${HORSE.rideMs / 1000}s`);
    }
  }
  if (!atHorse) warnedHorse = false;
  if (wasRiding && rideLeft(state, now) <= 0) hud.toast('The ghoda trotted back to its post 🐎');
  wasRiding = rideLeft(state, now) > 0;

  // Kolhu: drop off sugarcane, pick up jaggery
  if (pos.distanceTo(KOLHU_ZONE) < KOLHU_ZONE_RADIUS + 0.2) {
    const k = kolhuStatus(state, now);
    if (k === 'ready') {
      collectPress(state, now);
      record(playtest, 'kolhu-collect');
      hud.float('+1 🟫', up(KOLHU_POS, 2.2), camera);
    } else if (k === 'idle' && state.inventory.sugarcane >= KOLHU.inputQty) {
      startPress(state, now);
      record(playtest, 'kolhu-start');
      hud.float(`−${KOLHU.inputQty} 🎋`, up(KOLHU_POS, 2.2), camera);
    }
  }

  // Haat: hand over whatever orders you can fill
  haatCooldown -= dt;
  if (haatCooldown <= 0 && pos.distanceTo(HAAT_ZONE) < HAAT_ZONE_RADIUS + 0.4) {
    const order = state.orders.find((o) => canFulfill(state, o));
    if (order) {
      haatCooldown = 0.35;
      const r = fulfill(state, order.id, now);
      if (r.ok) {
        record(playtest, 'order', order.who);
        r.levelsGained.forEach((level) => record(playtest, level >= MAX_LEVEL ? 'diwali' : 'level', String(level)));
        hud.float(`+🪙${order.coins}`, up(HAAT_ZONE, 2), camera);
        saveGame(state);
        if (hintStage < 3) {
          hintStage = 3;
          hud.toast('Shabash! Clear more land by standing on a plot with a sign');
        }
        r.levelsGained.forEach((level, n) => window.setTimeout(() => levelUp(level), 400 + n * 100));
      }
    }
  }
}

function levelUp(level: number): void {
  if (level >= MAX_LEVEL && !state.celebrated) {
    state.celebrated = true;
    saveGame(state);
    hud.modal(
      'Shubh Deepavali! 🪔',
      "Dadi's fields are green again and the whole village is lit up for Diwali. Thank you for playing! Villagers will keep coming if you want to keep farming.",
      [{ text: 'Keep farming', primary: true }],
      true,
    );
    return;
  }
  hud.modal(`Level ${level}! ⭐`, LEVEL_UNLOCK_TEXT[level] ?? 'Well done!', [{ text: 'Shabash!', primary: true }]);
}

// ---------- labels over the world ----------

function updateLabels(now: number): void {
  const k = kolhuStatus(state, now);
  const left = Math.ceil((KOLHU.pressMs - (now - (state.kolhuStartedAt ?? now))) / 1000);
  const kText =
    k === 'locked'
      ? `🔒 Kolhu · level ${KOLHU.unlockLevel}`
      : k === 'pressing'
        ? `Pressing… ${left}s`
        : k === 'ready'
          ? 'Jaggery ready! 🟫'
          : `Kolhu · bring ${KOLHU.inputQty} 🎋`;
  hud.label('kolhu', kText, up(KOLHU_POS, 2.6), k === 'ready' ? 'hot' : '');
  const riding = rideLeft(state, now) > 0;
  const horseText =
    state.level < HORSE.unlockLevel
      ? `🔒 Ghoda · level ${HORSE.unlockLevel}`
      : riding
        ? null
        : horseHold > 0
          ? '⏳ Saddling…'
          : `🐎 Ride · 🪙 ${HORSE.cost}`;
  hud.label('horse', horseText, up(HORSE_POS, 2.7), !riding && state.coins >= HORSE.cost && state.level >= HORSE.unlockLevel ? 'hot' : '');
  hud.label('haat', 'Haat', up(HAAT_ZONE, 2.4), state.orders.some((o) => canFulfill(state, o)) ? 'hot' : '');
  const cost = nextPlotCost(state);
  const farmerPos = world.farmer.root.position;
  state.plots.forEach((p, i) => {
    // Only price the land around the farmer, so the field stays readable.
    const show = !p.unlocked && plotCenter(i).distanceTo(farmerPos) < 2.8;
    const here = i === currentPlot && !holdDone;
    const text = !here ? `🪙 ${cost}` : state.coins < cost ? `🪙 ${cost} · need more` : holdTime > 0 ? '⏳ Clearing…' : `🪙 ${cost} · stand still`;
    hud.label(`plot-${i}`, show ? text : null, up(plotCenter(i), 1.1), 'small');
  });
  state.plots.forEach((p, i) => {
    const ready = p.crop && isRipe(p, now);
    hud.label(`ripe-${i}`, ready ? `${ITEMS[p.crop!].icon}` : null, up(plotCenter(i), 1.8), 'bubble');
  });
}

// ---------- what to do next ----------

/** One line under the field telling the player their next useful step. */
function nextGoal(now: number): string {
  const k = kolhuStatus(state, now);
  if (k === 'ready') return '← Your jaggery is ready at the kolhu';
  if (orderProgress(state).some((p) => p.ready)) return 'Take your harvest to the Haat →';
  if (k === 'idle' && state.inventory.sugarcane >= KOLHU.inputQty) return `← Take ${KOLHU.inputQty} 🎋 to the kolhu to make jaggery`;
  if (state.plots.some((p) => p.crop && isRipe(p, now))) return 'Walk over ripe crops to harvest them';
  if (state.plots.some((p) => p.unlocked && !p.crop)) return 'Walk onto empty soil to plant';
  // An order that needs a crop nobody is growing would stall quietly, so say so.
  const growing = new Set(state.plots.map((p) => p.crop));
  for (const o of state.orders) {
    for (const l of o.lines) {
      if (l.item in CROPS && l.item !== selectedSeed && !growing.has(l.item as CropId) && state.inventory[l.item] < l.qty) {
        const c = CROPS[l.item as CropId];
        if (isCropUnlocked(state, c.id)) return `${o.who} needs ${c.icon} but none is growing. Tap ${c.icon} below`;
      }
    }
  }
  if (state.level >= MAX_LEVEL) return '';
  return `Crops growing… Level ${state.level + 1}: ${LEVEL_UNLOCK_TEXT[state.level + 1]}`;
}

// ---------- loop ----------

const camTarget = new THREE.Vector3();
const camGoal = new THREE.Vector3();
let last = performance.now();
let lastSave = 0;

if (hintStage === 0) {
  window.setTimeout(() => hud.toast('Drag anywhere to walk. Step onto the soil to plant wheat 🌾'), 600);
  hintStage = 1;
}

function frame(ms: number): void {
  const dt = Math.min(0.1, (ms - last) / 1000);
  last = ms;
  const now = Date.now();
  tick(state, now, Math.random);
  if (!document.hidden) addPlayTime(playtest, dt);
  const moving = step(dt);
  interact(dt, now, moving);
  world.update(state, now, ms / 1000, moving);

  const farmer = world.farmer.root;
  const back = THREE.MathUtils.clamp(0.9 / camera.aspect, 1, 1.75);
  camGoal.set(farmer.position.x * 0.8, 0, farmer.position.z * 0.85 + 1.2);
  // The camera trails the farmer a little instead of being bolted on.
  if (camTarget.lengthSq() === 0) camTarget.copy(camGoal);
  else camTarget.lerp(camGoal, 1 - Math.exp(-dt * 4));
  camera.position.set(camTarget.x, 13 * back, camTarget.z + 10.5 * back);
  camera.lookAt(camTarget);
  renderer.render(world.scene, camera);

  updateLabels(now);
  hud.render(state, selectedSeed, nextGoal(now), rideLeft(state, now));
  hud.placeLabels(camera);

  if (now - lastSave > 5000) {
    persist();
    lastSave = now;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Offline play is a bonus; the game works without it.
  });
}

// Test hook for automated screenshots: open with ?debug to reach the game from the console.
if (new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __game: { get state() { return state; }, get farmer() { return world.farmer.root; } } });
}
