// The 3D village: layout, lighting, and per-frame visuals driven by the game state.
import * as THREE from 'three';
import { CROPS, GRID_SIZE, ITEM_ORDER, MAX_ORDERS, VILLAGERS } from '../game/data';
import { GameState, growProgress, isRipe, kolhuStatus } from '../game/sim';
import {
  PALETTE,
  Person,
  animateWalk,
  bush,
  carryItem,
  cropModel,
  diya,
  haatStall,
  house,
  kolhu,
  lamp,
  lockedPlot,
  mesh,
  palm,
  person,
  rock,
  soilPlot,
  tree,
  well,
  zoneRing,
} from './models';

export const CELL = 2.3;
export const PLOT = 2.05;
export const KOLHU_POS = new THREE.Vector3(-7.6, 0, 0.5);
export const HAAT_POS = new THREE.Vector3(8.0, 0, -0.5);
export const HAAT_ZONE = new THREE.Vector3(6.0, 0, -0.5);
export const KOLHU_ZONE_RADIUS = 2.4;
export const HAAT_ZONE_RADIUS = 1.4;
export const BOUNDS = { minX: -12, maxX: 11.5, minZ: -12.5, maxZ: 9.5 };

/** A round obstacle, or a box when hw/hd (half width and depth) are set. */
export interface Obstacle {
  x: number;
  z: number;
  r: number;
  hw?: number;
  hd?: number;
}

export function plotCenter(index: number): THREE.Vector3 {
  const col = index % GRID_SIZE;
  const row = Math.floor(index / GRID_SIZE);
  return new THREE.Vector3((col - (GRID_SIZE - 1) / 2) * CELL, 0, (row - (GRID_SIZE - 1) / 2) * CELL);
}

/** The plot the point stands on, or -1. */
export function plotAt(x: number, z: number): number {
  const half = (GRID_SIZE * CELL) / 2;
  if (x < -half || x >= half || z < -half || z >= half) return -1;
  const col = Math.floor((x + half) / CELL);
  const row = Math.floor((z + half) / CELL);
  const c = plotCenter(row * GRID_SIZE + col);
  if (Math.abs(x - c.x) > PLOT / 2 + 0.05 || Math.abs(z - c.z) > PLOT / 2 + 0.05) return -1;
  return row * GRID_SIZE + col;
}

interface PlotVisual {
  root: THREE.Group;
  key: string;
  content: THREE.Object3D | null;
}

export class World {
  readonly scene = new THREE.Scene();
  readonly farmer: Person;
  readonly obstacles: Obstacle[] = [];
  private plots: PlotVisual[] = [];
  private kolhuModel = kolhu();
  private kolhuRing = zoneRing(KOLHU_ZONE_RADIUS);
  private haatRing = zoneRing(HAAT_ZONE_RADIUS);
  private villagers: Person[] = [];
  private villagerKeys: string[] = [];
  private carryKey = '';
  private festive: THREE.Group | null = null;
  private sun: THREE.DirectionalLight;
  private hemi: THREE.HemisphereLight;

  constructor() {
    const s = this.scene;
    s.background = new THREE.Color('#bfe6f2');
    s.fog = new THREE.Fog('#bfe6f2', 30, 60);

    this.hemi = new THREE.HemisphereLight('#fff4dd', '#6a8c3a', 1.6);
    s.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff1d0', 2.2);
    this.sun.position.set(-8, 16, 10);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    const sc = this.sun.shadow.camera;
    sc.left = -16;
    sc.right = 16;
    sc.top = 16;
    sc.bottom = -16;
    sc.near = 1;
    sc.far = 50;
    this.sun.shadow.bias = -0.0015;
    s.add(this.sun);

    // Ground and paths
    const ground = mesh(new THREE.PlaneGeometry(80, 80), PALETTE.grass, 0, 0, 0, false);
    ground.rotation.x = -Math.PI / 2;
    s.add(ground);
    const pathMat: [number, number, number, number][] = [
      [0, 6.9, 22, 2.2],
      [-6.0, 0.5, 3.6, 1.8],
      [6.2, -0.5, 3.0, 1.8],
      [-2.5, -6.6, 1.8, 4],
    ];
    for (const [x, z, w, d] of pathMat) {
      const p = mesh(new THREE.PlaneGeometry(w, d), PALETTE.path, x, 0.01, z, false);
      p.rotation.x = -Math.PI / 2;
      s.add(p);
    }

    // Field border
    const half = (GRID_SIZE * CELL) / 2 + 0.25;
    const border = mesh(new THREE.BoxGeometry(half * 2, 0.06, half * 2), '#7da947', 0, 0.02, 0, false);
    s.add(border);

    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const root = new THREE.Group();
      root.position.copy(plotCenter(i));
      s.add(root);
      this.plots.push({ root, key: '', content: null });
    }

    // Kolhu (sugarcane press)
    this.kolhuModel.root.position.copy(KOLHU_POS);
    s.add(this.kolhuModel.root);
    this.kolhuRing.position.set(KOLHU_POS.x + 0.4, 0.03, KOLHU_POS.z);
    s.add(this.kolhuRing);
    this.obstacles.push({ x: KOLHU_POS.x, z: KOLHU_POS.z, r: 1.2 });

    // Haat stall, villagers wait on its far side
    const stall = haatStall();
    stall.position.copy(HAAT_POS);
    stall.rotation.y = Math.PI / 2;
    s.add(stall);
    this.haatRing.position.set(HAAT_ZONE.x, 0.03, HAAT_ZONE.z);
    s.add(this.haatRing);
    // One box for the stall and the villagers behind it, out to the edge, so the farmer can't get wedged back there.
    const back = BOUNDS.maxX + 1;
    this.obstacles.push({ x: (HAAT_POS.x - 0.7 + back) / 2, z: HAAT_POS.z - 0.3, r: 0, hw: (back - HAAT_POS.x + 0.7) / 2, hd: 2.3 });
    for (let i = 0; i < MAX_ORDERS; i++) {
      this.villagers.push(person({ top: '#ccc', bottom: '#ccc', head: '#333', headKind: 'hair' }));
      this.villagerKeys.push('');
    }

    // Dadi's house and the well
    const h = house();
    h.position.set(-3, 0, -9.5);
    s.add(h);
    this.obstacles.push({ x: -4, z: -9.5, r: 2.1 }, { x: -2, z: -9.5, r: 2.1 });
    const w = well();
    w.position.set(3.6, 0, -8.6);
    s.add(w);
    this.obstacles.push({ x: 3.6, z: -8.6, r: 1 });

    // Trees, palms, bushes around the edge
    const trees: [number, number, 'tree' | 'palm'][] = [
      [-10.5, -6, 'tree'], [-11, 4.5, 'tree'], [7.5, -9.5, 'tree'], [-7.5, -11, 'palm'], [10.5, 3.6, 'palm'],
      [10.8, -4.5, 'palm'], [-10.8, -1.6, 'palm'], [0.8, -11.6, 'tree'], [6.5, 6.8, 'tree'], [-7.2, 7.4, 'tree'],
    ];
    trees.forEach(([x, z, kind], i) => {
      const t = kind === 'tree' ? tree(i) : palm(i);
      t.position.set(x, 0, z);
      t.rotation.y = i;
      s.add(t);
      this.obstacles.push({ x, z, r: kind === 'tree' ? 0.7 : 0.4 });
    });
    const smalls: [number, number, boolean][] = [
      [-6, -5, true], [5.6, -5.4, true], [-5.5, 4.6, false], [5.7, 4.2, true], [2, 9, false], [-3.8, 9, true],
      [9.4, 7.8, false], [-11.4, 8.4, true],
    ];
    smalls.forEach(([x, z, isBush]) => {
      const o = isBush ? bush() : rock();
      o.position.set(x, 0, z);
      s.add(o);
    });

    this.farmer = person({ top: PALETTE.white, bottom: PALETTE.white, head: PALETTE.red, headKind: 'turban' });
    this.farmer.root.position.set(0, 0, 6.6);
    this.farmer.root.rotation.y = 0;
    s.add(this.farmer.root);
  }

  /** Sync meshes to the game state; cheap when nothing changed. */
  update(state: GameState, now: number, t: number, moving: boolean): void {
    animateWalk(this.farmer, t, moving);

    state.plots.forEach((p, i) => {
      const v = this.plots[i];
      const progress = growProgress(p, now);
      const ripe = isRipe(p, now);
      const stage = !p.unlocked ? 'locked' : !p.crop ? 'empty' : ripe ? 'ripe' : progress < 0.35 ? 'sprout' : 'growing';
      const key = `${stage}:${p.crop}`;
      if (key !== v.key) {
        v.key = key;
        v.root.clear();
        v.root.add(stage === 'locked' ? lockedPlot(PLOT) : soilPlot(PLOT));
        v.content = null;
        if (p.crop && stage !== 'empty') {
          v.content = cropModel(stage === 'sprout' ? 'sprout' : p.crop);
          v.content.position.y = 0.12;
          v.root.add(v.content);
        }
      }
      if (v.content) {
        if (stage === 'growing') v.content.scale.setScalar(0.45 + 0.45 * progress);
        else if (stage === 'ripe') v.content.scale.setScalar(1 + Math.sin(t * 5 + i) * 0.04);
        else v.content.scale.setScalar(1);
      }
    });

    // Kolhu turns while pressing
    const k = kolhuStatus(state, now);
    if (k === 'pressing') this.kolhuModel.beam.rotation.y -= 0.02;
    this.kolhuRing.visible = k !== 'locked';
    this.pulse(this.kolhuRing, t, k === 'ready' || (k === 'idle' && state.inventory.sugarcane >= 2));
    this.kolhuModel.root.visible = true;

    // Villagers at the haat
    for (let i = 0; i < MAX_ORDERS; i++) {
      const o = state.orders[i];
      const key = o ? `${o.id}` : '';
      if (key !== this.villagerKeys[i]) {
        this.scene.remove(this.villagers[i].root);
        this.villagerKeys[i] = key;
        if (o) {
          const v = person(villagerLook(o.who));
          v.root.position.set(HAAT_POS.x + 1.9, 0, HAAT_POS.z - 1.6 + i * 1.6);
          v.root.rotation.y = -Math.PI / 2;
          this.villagers[i] = v;
          this.scene.add(v.root);
        }
      }
      if (o) {
        const v = this.villagers[i];
        v.root.position.y = Math.abs(Math.sin(t * 2 + i)) * 0.04;
        v.armR.rotation.z = Math.sin(t * 3 + i) * 0.2 + 0.2;
      }
    }
    const canDeliver = state.orders.some((o) => o.lines.every((l) => state.inventory[l.item] >= l.qty));
    this.pulse(this.haatRing, t, canDeliver);

    // Carry stack on the farmer's back
    const items = ITEM_ORDER.flatMap((id) => Array<string>(state.inventory[id]).fill(id));
    const carryKey = items.slice(0, 14).join(',');
    if (carryKey !== this.carryKey) {
      this.carryKey = carryKey;
      this.farmer.carry.clear();
      items.slice(0, 14).forEach((item, n) => {
        const m = carryItem(item);
        m.position.set(0, n * 0.14, 0);
        m.rotation.y = (n % 2) * 0.15;
        this.farmer.carry.add(m);
      });
    }

    if (state.celebrated && !this.festive) this.makeFestive();
    if (this.festive) {
      this.festive.children.forEach((c, n) => {
        const flame = c.getObjectByName('flame');
        if (flame) flame.scale.y = 1 + Math.sin(t * 9 + n) * 0.25;
      });
    }
  }

  private pulse(ring: THREE.Mesh, t: number, active: boolean): void {
    const m = ring.material as THREE.MeshBasicMaterial;
    m.color.set(active ? '#ffd166' : '#ffffff');
    m.opacity = active ? 0.65 + Math.sin(t * 6) * 0.3 : 0.45;
  }

  /** Diwali evening: warm dusk light, diyas on the paths and lamps on the house. */
  private makeFestive(): void {
    this.festive = new THREE.Group();
    this.scene.background = new THREE.Color('#3b2a5c');
    this.scene.fog = new THREE.Fog('#3b2a5c', 28, 55);
    this.hemi.color.set('#ffc98a');
    this.hemi.groundColor.set('#3a3020');
    this.hemi.intensity = 1.35;
    this.sun.color.set('#ff9d5c');
    this.sun.intensity = 1.4;
    const spots: [number, number][] = [];
    for (let x = -10; x <= 10; x += 2) spots.push([x, 5.7]);
    for (let z = -4.8; z <= 4.8; z += 2.4) spots.push([-5.3, z], [5.3, z]);
    spots.push([-4.4, -7.6], [-1.6, -7.6], [-3, -7.6]);
    for (const [x, z] of spots) {
      const d = diya();
      d.position.set(x, 0, z);
      this.festive.add(d);
    }
    const colors = ['#ff5e5e', '#ffd166', '#7ae582', '#5ec8ff'];
    for (let n = 0; n < 16; n++) {
      const l = lamp(colors[n % colors.length]);
      const a = n / 15;
      l.position.set(-5 + a * 4, 2.3 - Math.sin(a * Math.PI) * 0.3, -8.05);
      this.festive.add(l);
    }
    const glow = new THREE.PointLight('#ffb347', 30, 14);
    glow.position.set(0, 3, 0);
    this.festive.add(glow);
    this.scene.add(this.festive);
  }
}

function villagerLook(name: string) {
  const i = Math.max(0, VILLAGERS.findIndex((v) => v.name === name));
  const looks = [
    { top: '#f5f5f5', bottom: '#f5f5f5', head: '#ff8c1a', headKind: 'turban' as const },
    { top: '#2a9d8f', bottom: '#2a9d8f', head: '#1d1d1d', headKind: 'hair' as const, saree: true },
    { top: '#e9e4da', bottom: '#8d6e63', head: '#e9e4da', headKind: 'cap' as const },
    { top: '#c2185b', bottom: '#c2185b', head: '#9e9e9e', headKind: 'hair' as const, saree: true },
    { top: '#3a86ff', bottom: '#f5f5f5', head: '#1d1d1d', headKind: 'hair' as const },
    { top: '#ffbe0b', bottom: '#5c4033', head: '#1d1d1d', headKind: 'hair' as const },
    { top: '#ffffff', bottom: '#ffffff', head: '#ffffff', headKind: 'cap' as const },
  ];
  if (name === 'City trader') return { top: '#264653', bottom: '#264653', head: '#1d1d1d', headKind: 'cap' as const };
  return looks[i % looks.length];
}

export { CROPS };
