import * as THREE from 'three';
import { CROPS, CropId, ITEMS, KOLHU, LEVEL_UNLOCK_TEXT, MAX_LEVEL } from './game/data';
import { clearSave, loadGame, saveGame } from './game/save';
import {
  GameState,
  buyPlot,
  canFulfill,
  collectPress,
  dismissOrder,
  fulfill,
  harvest,
  isCropUnlocked,
  isRipe,
  kolhuStatus,
  nextPlotCost,
  plant,
  startPress,
  tick,
} from './game/sim';
import { Controls } from './three/controls';
import { BOUNDS, HAAT_ZONE, HAAT_ZONE_RADIUS, KOLHU_POS, KOLHU_ZONE_RADIUS, World, plotAt, plotCenter } from './three/world';
import { Hud } from './ui/hud';

let state: GameState = loadGame(Date.now());
let selectedSeed: CropId = 'wheat';

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
    hud.toast(`Now planting ${CROPS[crop].name} ${CROPS[crop].icon}`);
  },
  onDismiss(id) {
    dismissOrder(state, id, Date.now());
  },
  onReset() {
    hud.modal('Start over?', 'This clears your village and starts a new game.', [
      { text: 'Cancel' },
      {
        text: 'Start over',
        primary: true,
        onClick: () => {
          clearSave();
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

const persist = () => saveGame(state);
document.addEventListener('visibilitychange', persist);
window.addEventListener('pagehide', persist);

// ---------- movement ----------

const SPEED = 5.5;

function step(dt: number): boolean {
  if (hud.modalOpen) return false;
  const farmer = world.farmer.root;
  const dir = controls.direction();
  if (Math.hypot(dir.x, dir.z) < 0.05) return false;
  let x = farmer.position.x + dir.x * SPEED * dt;
  let z = farmer.position.z + dir.z * SPEED * dt;
  for (const o of world.obstacles) {
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
  let diff = Math.atan2(dir.x, dir.z) - farmer.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  farmer.rotation.y += diff * Math.min(1, dt * 14);
  return true;
}

// ---------- what happens where you stand ----------

const KOLHU_ZONE = new THREE.Vector3(KOLHU_POS.x + 0.4, 0, KOLHU_POS.z);
let currentPlot = -1;
let holdTime = 0;
let holdDone = false;
let haatCooldown = 0;
let warnedSeed = false;
let hintStage = state.xp > 0 ? 3 : 0;
const up = (v: THREE.Vector3, y: number) => v.clone().setY(y);

function interact(dt: number, now: number): void {
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
      holdTime += dt;
      if (holdTime > 0.7 && !holdDone) {
        holdDone = true;
        const cost = nextPlotCost(state);
        const r = buyPlot(state, plotIndex);
        if (r.ok) hud.float(`Cleared! −🪙${cost}`, up(at, 1), camera);
        else hud.toast(`Clearing this land costs 🪙 ${cost}`);
      }
    } else if (!p.crop) {
      const r = plant(state, plotIndex, selectedSeed, now);
      if (!r.ok && selectedSeed !== 'wheat') {
        plant(state, plotIndex, 'wheat', now);
        if (!warnedSeed) hud.toast(`Not enough coins for ${CROPS[selectedSeed].name}, planted wheat`);
        warnedSeed = true;
      }
    } else if (isRipe(p, now)) {
      const crop = p.crop;
      harvest(state, plotIndex, now);
      hud.float(`+1 ${CROPS[crop].icon}`, up(at, 1.2), camera);
      if (hintStage === 1) {
        hintStage = 2;
        hud.toast('Carry the wheat to the haat on the right →');
      }
    }
  }

  // Kolhu: drop off sugarcane, pick up jaggery
  if (pos.distanceTo(KOLHU_ZONE) < KOLHU_ZONE_RADIUS + 0.2) {
    const k = kolhuStatus(state, now);
    if (k === 'ready') {
      collectPress(state, now);
      hud.float('+1 🟫', up(KOLHU_POS, 2.2), camera);
    } else if (k === 'idle' && state.inventory.sugarcane >= KOLHU.inputQty) {
      startPress(state, now);
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
  hud.label('haat', 'Haat', up(HAAT_ZONE, 2.4), state.orders.some((o) => canFulfill(state, o)) ? 'hot' : '');
  const cost = nextPlotCost(state);
  const farmerPos = world.farmer.root.position;
  state.plots.forEach((p, i) => {
    // Only price the land around the farmer, so the field stays readable.
    const show = !p.unlocked && plotCenter(i).distanceTo(farmerPos) < 2.8;
    const holding = i === currentPlot && show && !holdDone;
    hud.label(`plot-${i}`, show ? (holding ? '⏳ Clearing…' : `🪙 ${cost}`) : null, up(plotCenter(i), 1.1), 'small');
  });
  state.plots.forEach((p, i) => {
    const ready = p.crop && isRipe(p, now);
    hud.label(`ripe-${i}`, ready ? `${ITEMS[p.crop!].icon}` : null, up(plotCenter(i), 1.8), 'bubble');
  });
}

// ---------- loop ----------

const camTarget = new THREE.Vector3();
let last = performance.now();
let lastSave = 0;

if (hintStage === 0) {
  window.setTimeout(() => hud.toast('Drag anywhere to walk. Step onto the soil to plant wheat 🌾'), 600);
  hintStage = 1;
}

function frame(ms: number): void {
  const dt = Math.min(0.05, (ms - last) / 1000);
  last = ms;
  const now = Date.now();
  tick(state, now, Math.random);
  const moving = step(dt);
  interact(dt, now);
  world.update(state, now, ms / 1000, moving);

  const farmer = world.farmer.root;
  const back = THREE.MathUtils.clamp(0.9 / camera.aspect, 1, 1.75);
  camTarget.set(farmer.position.x * 0.8, 0, farmer.position.z * 0.85 + 1.2);
  camera.position.set(camTarget.x, 13 * back, camTarget.z + 10.5 * back);
  camera.lookAt(camTarget);
  renderer.render(world.scene, camera);

  updateLabels(now);
  hud.render(state, selectedSeed);
  hud.placeLabels(camera);

  if (now - lastSave > 5000) {
    saveGame(state);
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
