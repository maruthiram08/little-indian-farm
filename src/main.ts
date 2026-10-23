import * as THREE from 'three';
import { newGame } from './game/sim';
import { Controls } from './three/controls';
import { BOUNDS, World } from './three/world';

// Preview scene: a sample village state to walk around in. Game logic comes next.
const now = Date.now();
const state = newGame(now);
state.level = 3;
state.xp = 400;
state.plots.forEach((p, i) => {
  p.unlocked = i < 11;
  if (!p.unlocked || i % 5 === 4) return;
  p.crop = (['wheat', 'marigold', 'sugarcane'] as const)[i % 3];
  p.plantedAt = now - (i % 2 ? 120_000 : 6_000 + i * 1000);
});
state.inventory = { wheat: 3, marigold: 2, sugarcane: 2, jaggery: 1 };
state.kolhuStartedAt = now;
state.orders = [
  { id: 2, who: 'Sarpanch ji', icon: '👳', lines: [{ item: 'wheat', qty: 3 }], coins: 15, xp: 12 },
  { id: 3, who: 'Meena Teacher', icon: '👩‍🏫', lines: [{ item: 'marigold', qty: 2 }], coins: 25, xp: 20 },
  { id: 4, who: 'Ramu Kaka', icon: '👴', lines: [{ item: 'jaggery', qty: 1 }], coins: 63, xp: 50 },
];
if (new URLSearchParams(location.search).has('diwali')) state.celebrated = true;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.getElementById('game')!.appendChild(renderer.domElement);

const world = new World();
const camera = new THREE.PerspectiveCamera(42, 1, 0.5, 120);
const controls = new Controls(renderer.domElement);

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

const farmer = world.farmer.root;
const SPEED = 5.5;
const camTarget = new THREE.Vector3();
let last = performance.now();

function step(dt: number): boolean {
  const dir = controls.direction();
  const len = Math.hypot(dir.x, dir.z);
  if (len < 0.05) return false;
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
  const target = Math.atan2(dir.x, dir.z);
  let diff = target - farmer.rotation.y;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  farmer.rotation.y += diff * Math.min(1, dt * 14);
  return true;
}

function frame(ms: number): void {
  const dt = Math.min(0.05, (ms - last) / 1000);
  last = ms;
  const moving = step(dt);
  world.update(state, Date.now(), ms / 1000, moving);
  // Portrait screens see less width, so pull the camera back.
  const back = THREE.MathUtils.clamp(0.9 / camera.aspect, 1, 1.75);
  camTarget.set(farmer.position.x * 0.8, 0, farmer.position.z * 0.85 + 1.2);
  camera.position.set(camTarget.x, 13 * back, camTarget.z + 10.5 * back);
  camera.lookAt(camTarget);
  renderer.render(world.scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
