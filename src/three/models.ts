// Low-poly models built from primitives, so the game ships with no art files.
import * as THREE from 'three';
import type { CropId } from '../game/data';

const materials = new Map<string, THREE.Material>();

export function mat(color: string, emissive?: string): THREE.MeshLambertMaterial {
  const key = `${color}|${emissive ?? ''}`;
  let m = materials.get(key) as THREE.MeshLambertMaterial | undefined;
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color, flatShading: true });
    if (emissive) {
      m.emissive = new THREE.Color(emissive);
      m.emissiveIntensity = 1;
    }
    materials.set(key, m);
  }
  return m;
}

export const PALETTE = {
  grass: '#8cc152',
  grassDark: '#6fa33f',
  soil: '#8a5a33',
  soilDark: '#6b4224',
  path: '#d9b77e',
  wood: '#8b5a2b',
  woodDark: '#5e3a1a',
  mud: '#d39a5c',
  mudLight: '#e8c08a',
  thatch: '#c9a14a',
  stone: '#a7a29a',
  skin: '#b97a4a',
  saffron: '#f29c1f',
  white: '#f8f3e6',
  red: '#c0392b',
  leaf: '#4f9a3a',
  leafDark: '#3c7a2c',
  wheat: '#e3b23c',
  marigold: '#f59e0b',
  cane: '#6aa84f',
  flame: '#ffb347',
};

type Shape = THREE.BufferGeometry;

export function mesh(geo: Shape, color: string, x = 0, y = 0, z = 0, shadow = true): THREE.Mesh {
  const m = new THREE.Mesh(geo, mat(color));
  m.position.set(x, y, z);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 8) => new THREE.CylinderGeometry(rt, rb, h, seg);

// ---------- people ----------

export interface Person {
  root: THREE.Group;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  carry: THREE.Group;
}

export interface PersonLook {
  top: string;
  bottom: string;
  head: string;
  headKind: 'turban' | 'hair' | 'cap';
  saree?: boolean;
}

export function person(look: PersonLook): Person {
  const root = new THREE.Group();
  const legL = new THREE.Group();
  const legR = new THREE.Group();
  if (look.saree) {
    root.add(mesh(cyl(0.26, 0.42, 0.75, 10), look.bottom, 0, 0.38, 0));
  } else {
    legL.add(mesh(box(0.17, 0.55, 0.17), look.bottom, 0, -0.27, 0));
    legR.add(mesh(box(0.17, 0.55, 0.17), look.bottom, 0, -0.27, 0));
    legL.position.set(-0.12, 0.6, 0);
    legR.position.set(0.12, 0.6, 0);
    root.add(legL, legR);
  }
  root.add(mesh(cyl(0.27, 0.32, 0.62, 10), look.top, 0, 0.92, 0));
  const armL = new THREE.Group();
  const armR = new THREE.Group();
  armL.add(mesh(box(0.13, 0.5, 0.13), look.top, 0, -0.22, 0));
  armR.add(mesh(box(0.13, 0.5, 0.13), look.top, 0, -0.22, 0));
  armL.add(mesh(box(0.12, 0.12, 0.12), PALETTE.skin, 0, -0.5, 0));
  armR.add(mesh(box(0.12, 0.12, 0.12), PALETTE.skin, 0, -0.5, 0));
  armL.position.set(-0.36, 1.18, 0);
  armR.position.set(0.36, 1.18, 0);
  root.add(armL, armR);
  root.add(mesh(new THREE.IcosahedronGeometry(0.25, 1), PALETTE.skin, 0, 1.47, 0));
  // Eyes face +z, the direction the person walks.
  root.add(mesh(box(0.05, 0.05, 0.02), '#2b1a10', -0.09, 1.5, 0.23, false));
  root.add(mesh(box(0.05, 0.05, 0.02), '#2b1a10', 0.09, 1.5, 0.23, false));
  if (look.headKind === 'turban') {
    root.add(mesh(cyl(0.27, 0.25, 0.2, 10), look.head, 0, 1.66, 0));
    root.add(mesh(new THREE.IcosahedronGeometry(0.14, 0), look.head, 0.05, 1.78, -0.04));
    root.add(mesh(box(0.16, 0.04, 0.03), '#2b1a10', 0, 1.39, 0.24, false));
  } else if (look.headKind === 'cap') {
    root.add(mesh(cyl(0.22, 0.25, 0.14, 10), look.head, 0, 1.66, 0));
  } else {
    root.add(mesh(new THREE.IcosahedronGeometry(0.26, 1), look.head, 0, 1.55, -0.06));
    root.add(mesh(new THREE.IcosahedronGeometry(0.11, 0), look.head, 0, 1.5, -0.3));
  }
  const carry = new THREE.Group();
  carry.position.set(0, 0.95, -0.42);
  root.add(carry);
  return { root, legL, legR, armL, armR, carry };
}

export function animateWalk(p: Person, t: number, moving: boolean): void {
  const swing = moving ? Math.sin(t * 12) * 0.6 : 0;
  p.legL.rotation.x = swing;
  p.legR.rotation.x = -swing;
  p.armL.rotation.x = -swing * 0.7;
  p.armR.rotation.x = swing * 0.7;
  p.root.position.y = moving ? Math.abs(Math.sin(t * 12)) * 0.06 : 0;
}

// ---------- fields and crops ----------

export function soilPlot(size: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(size, 0.16, size), PALETTE.soil, 0, 0.08, 0, false));
  for (let i = -1; i <= 1; i++) {
    g.add(mesh(box(size * 0.86, 0.08, 0.16), PALETTE.soilDark, 0, 0.19, (i * size) / 3.4, false));
  }
  return g;
}

export function lockedPlot(size: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(size, 0.08, size), PALETTE.grassDark, 0, 0.04, 0, false));
  g.add(mesh(new THREE.IcosahedronGeometry(0.35, 0), PALETTE.leafDark, -0.5, 0.3, 0.4));
  g.add(mesh(new THREE.IcosahedronGeometry(0.28, 0), PALETTE.leaf, 0.55, 0.25, -0.35));
  g.add(mesh(new THREE.DodecahedronGeometry(0.22, 0), PALETTE.stone, 0.3, 0.15, 0.5));
  g.add(mesh(box(0.08, 0.7, 0.08), PALETTE.woodDark, 0, 0.35, -0.1));
  g.add(mesh(box(0.6, 0.36, 0.06), PALETTE.wood, 0, 0.7, -0.06));
  return g;
}

function sprout(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45], [0, 0]]) {
    g.add(mesh(new THREE.ConeGeometry(0.09, 0.3, 5), PALETTE.leaf, x, 0.3, z, false));
  }
  return g;
}

function wheat(): THREE.Group {
  const g = new THREE.Group();
  for (let i = -1; i <= 1; i++)
    for (let j = -1; j <= 1; j++) {
      const x = i * 0.48 + (j % 2) * 0.08;
      const z = j * 0.48;
      g.add(mesh(cyl(0.025, 0.035, 0.6, 4), '#c8a24a', x, 0.45, z));
      g.add(mesh(new THREE.ConeGeometry(0.09, 0.32, 5), PALETTE.wheat, x, 0.86, z));
    }
  return g;
}

function marigold(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.45, -0.4], [0.45, -0.45], [-0.4, 0.45], [0.5, 0.4], [0, 0]]) {
    g.add(mesh(new THREE.IcosahedronGeometry(0.22, 0), PALETTE.leafDark, x, 0.35, z));
    g.add(mesh(new THREE.IcosahedronGeometry(0.16, 0), PALETTE.marigold, x, 0.62, z));
    g.add(mesh(new THREE.IcosahedronGeometry(0.1, 0), '#e8590c', x + 0.15, 0.55, z + 0.1));
  }
  return g;
}

function sugarcane(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-0.45, -0.45], [0.45, -0.4], [-0.4, 0.45], [0.45, 0.45], [0, 0], [0, -0.5]]) {
    for (let s = 0; s < 3; s++) g.add(mesh(cyl(0.06, 0.07, 0.42, 6), s % 2 ? PALETTE.cane : '#7fbf5f', x, 0.4 + s * 0.42, z));
    const leaf = mesh(box(0.06, 0.03, 0.7), PALETTE.leaf, x + 0.2, 1.3, z);
    leaf.rotation.set(0.5, x * 3, 0.4);
    g.add(leaf);
  }
  return g;
}

export function cropModel(crop: CropId | 'sprout'): THREE.Group {
  if (crop === 'sprout') return sprout();
  if (crop === 'wheat') return wheat();
  if (crop === 'marigold') return marigold();
  return sugarcane();
}

/** A small item shown in the farmer's carry stack. */
export function carryItem(item: string): THREE.Mesh {
  const colors: Record<string, string> = {
    wheat: PALETTE.wheat,
    marigold: PALETTE.marigold,
    sugarcane: PALETTE.cane,
    jaggery: '#7a4a1e',
  };
  return mesh(box(0.42, 0.13, 0.3), colors[item] ?? PALETTE.wood, 0, 0, 0);
}

// ---------- buildings ----------

export interface Kolhu {
  root: THREE.Group;
  beam: THREE.Group;
}

export function kolhu(): Kolhu {
  const root = new THREE.Group();
  root.add(mesh(cyl(1.0, 1.15, 0.5, 12), PALETTE.stone, 0, 0.25, 0));
  root.add(mesh(cyl(0.55, 0.5, 0.35, 10), PALETTE.woodDark, 0, 0.65, 0));
  root.add(mesh(cyl(0.12, 0.14, 1.4, 6), PALETTE.wood, 0, 1.1, 0));
  const beam = new THREE.Group();
  beam.position.y = 1.15;
  beam.add(mesh(box(2.6, 0.12, 0.12), PALETTE.wood, 1.3, 0, 0));
  // An ox that walks the press round.
  const ox = new THREE.Group();
  ox.add(mesh(box(0.5, 0.45, 0.95), '#e9e4da', 0, 0, 0));
  ox.add(mesh(box(0.34, 0.34, 0.36), '#e9e4da', 0, 0.12, 0.6));
  ox.add(mesh(box(0.18, 0.12, 0.14), '#b5a89a', 0, 0.02, 0.8));
  ox.add(mesh(new THREE.ConeGeometry(0.05, 0.25, 4), '#5a4a3a', -0.15, 0.38, 0.6));
  ox.add(mesh(new THREE.ConeGeometry(0.05, 0.25, 4), '#5a4a3a', 0.15, 0.38, 0.6));
  ox.add(mesh(new THREE.IcosahedronGeometry(0.16, 0), '#b55d2a', 0, 0.3, -0.05));
  for (const [x, z] of [[-0.17, -0.32], [0.17, -0.32], [-0.17, 0.32], [0.17, 0.32]]) {
    ox.add(mesh(box(0.11, 0.45, 0.11), '#d8d1c4', x, -0.42, z));
  }
  ox.position.set(2.55, -0.35, 0);
  beam.add(ox);
  root.add(beam);
  return { root, beam };
}

export function haatStall(): THREE.Group {
  const g = new THREE.Group();
  for (const [x, z] of [[-1.3, -0.8], [1.3, -0.8], [-1.3, 0.8], [1.3, 0.8]]) {
    g.add(mesh(box(0.14, 2.2, 0.14), PALETTE.woodDark, x, 1.1, z));
  }
  g.add(mesh(box(2.8, 0.8, 1.2), PALETTE.wood, 0, 0.4, 0));
  g.add(mesh(box(2.9, 0.08, 1.3), PALETTE.mudLight, 0, 0.84, 0));
  // Striped awning
  for (let i = 0; i < 7; i++) {
    const stripe = mesh(box(0.42, 0.06, 2.0), i % 2 ? PALETTE.white : PALETTE.saffron, -1.26 + i * 0.42, 2.3, 0);
    stripe.rotation.x = 0.0;
    stripe.rotation.z = 0;
    g.add(stripe);
  }
  // Baskets of produce
  const baskets: [number, string][] = [[-0.9, PALETTE.wheat], [-0.3, PALETTE.marigold], [0.3, PALETTE.cane], [0.9, '#7a4a1e']];
  for (const [x, c] of baskets) {
    g.add(mesh(cyl(0.24, 0.18, 0.2, 8), '#a0702f', x, 0.98, 0));
    g.add(mesh(new THREE.IcosahedronGeometry(0.2, 0), c, x, 1.1, 0));
  }
  return g;
}

export function house(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(box(4.2, 0.25, 3.2), PALETTE.stone, 0, 0.12, 0));
  g.add(mesh(box(3.8, 2.0, 2.8), PALETTE.mud, 0, 1.2, 0));
  g.add(mesh(box(3.84, 0.25, 2.84), PALETTE.mudLight, 0, 0.4, 0));
  const roof = mesh(new THREE.ConeGeometry(3.3, 1.8, 4), PALETTE.thatch, 0, 3.1, 0);
  roof.rotation.y = Math.PI / 4;
  roof.scale.set(1.15, 1, 0.85);
  g.add(roof);
  g.add(mesh(box(0.8, 1.3, 0.1), PALETTE.woodDark, 0, 0.9, 1.42));
  g.add(mesh(box(0.6, 0.5, 0.08), '#3a2a1a', -1.2, 1.4, 1.42));
  g.add(mesh(box(0.6, 0.5, 0.08), '#3a2a1a', 1.2, 1.4, 1.42));
  // Tulsi planter by the door
  g.add(mesh(box(0.5, 0.6, 0.5), PALETTE.mudLight, 1.4, 0.55, 1.9));
  g.add(mesh(new THREE.IcosahedronGeometry(0.28, 0), PALETTE.leaf, 1.4, 1.05, 1.9));
  return g;
}

export function well(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.8, 0.85, 0.7, 10), PALETTE.stone, 0, 0.35, 0));
  g.add(mesh(cyl(0.6, 0.6, 0.72, 10), '#2f4f6f', 0, 0.37, 0, false));
  g.add(mesh(box(0.1, 1.6, 0.1), PALETTE.woodDark, -0.75, 1.1, 0));
  g.add(mesh(box(0.1, 1.6, 0.1), PALETTE.woodDark, 0.75, 1.1, 0));
  g.add(mesh(box(1.7, 0.1, 0.1), PALETTE.wood, 0, 1.85, 0));
  g.add(mesh(cyl(0.15, 0.12, 0.22, 8), '#7a8a99', 0, 1.3, 0));
  return g;
}

export function tree(seed: number): THREE.Group {
  const g = new THREE.Group();
  const h = 1.2 + (seed % 3) * 0.3;
  g.add(mesh(cyl(0.16, 0.22, h, 6), PALETTE.woodDark, 0, h / 2, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(1.1, 0), seed % 2 ? PALETTE.leaf : PALETTE.leafDark, 0, h + 0.6, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.75, 0), PALETTE.leaf, 0.5, h + 1.1, 0.2));
  return g;
}

export function palm(seed: number): THREE.Group {
  const g = new THREE.Group();
  let x = 0;
  for (let i = 0; i < 6; i++) {
    x += 0.06 * (seed % 2 ? 1 : -1);
    g.add(mesh(cyl(0.13, 0.16, 0.55, 6), i % 2 ? '#9b7a4f' : '#87683f', x, 0.27 + i * 0.52, 0));
  }
  const top = 3.3;
  for (let i = 0; i < 7; i++) {
    const leaf = mesh(box(0.28, 0.05, 1.7), PALETTE.leaf, 0, 0, 0.8);
    const holder = new THREE.Group();
    holder.position.set(x, top, 0);
    holder.rotation.set(0, (i / 7) * Math.PI * 2, 0);
    leaf.rotation.x = 0.45;
    holder.add(leaf);
    g.add(holder);
  }
  g.add(mesh(new THREE.IcosahedronGeometry(0.14, 0), '#6b4a2a', x + 0.15, top - 0.15, 0.1));
  g.add(mesh(new THREE.IcosahedronGeometry(0.14, 0), '#6b4a2a', x - 0.12, top - 0.18, 0.12));
  return g;
}

export function bush(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.IcosahedronGeometry(0.5, 0), PALETTE.leafDark, 0, 0.35, 0));
  g.add(mesh(new THREE.IcosahedronGeometry(0.35, 0), PALETTE.leaf, 0.4, 0.3, 0.1));
  return g;
}

export function rock(): THREE.Mesh {
  return mesh(new THREE.DodecahedronGeometry(0.4, 0), PALETTE.stone, 0, 0.2, 0);
}

export function diya(): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl(0.16, 0.09, 0.1, 8), '#b5532a', 0, 0.05, 0, false));
  const flame = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.18, 6), mat(PALETTE.flame, '#ff9a1f'));
  flame.position.y = 0.2;
  flame.name = 'flame';
  g.add(flame);
  return g;
}

export function lamp(color: string): THREE.Mesh {
  return new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), mat(color, color));
}

/** A flat ring on the ground that marks where to stand. */
export function zoneRing(radius: number): THREE.Mesh {
  const m = new THREE.Mesh(
    new THREE.RingGeometry(radius - 0.12, radius, 32),
    new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7 }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.y = 0.03;
  return m;
}
