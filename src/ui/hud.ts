// The on-screen layer over the 3D village: coins, level, orders, seeds, labels and dialogs.
import * as THREE from 'three';
import { CROPS, CROP_ORDER, CropId, ITEMS, ITEM_ORDER, LEVEL_XP, MAX_LEVEL, MAX_ORDERS } from '../game/data';
import { GameState, isCropUnlocked, levelProgress, orderProgress } from '../game/sim';
import { villagerLook } from '../three/world';
import { avatarHtml, icon, installIcons, setRich } from './icons';

const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export interface HudHandlers {
  onSeed: (crop: CropId) => void;
  onDismiss: (orderId: number) => void;
  onReset: () => void;
  onReport: () => void;
  /** Shows the playtest report button, for builds shared with testers. */
  showReport: boolean;
}

interface Label {
  node: HTMLDivElement;
  pos: THREE.Vector3;
}

export class Hud {
  private root = el('div', 'hud');
  private coins = el('span', 'counter-num');
  private levelNum = el('span', 'star-num');
  private xpFill = el('div', 'bar-fill');
  private xpText = el('span', 'bar-text');
  private ride = el('div', 'counter ride');
  private rideText = el('span', 'counter-num');
  private orderCards: HTMLDivElement[] = [];
  private orderKeys: string[] = [];
  private seedButtons = new Map<CropId, HTMLButtonElement>();
  private seedKey = '';
  private basket = el('div', 'basket');
  private basketKey = '-';
  private goal = el('div', 'goal');
  private toastNode = el('div', 'toast');
  private toastTimer = 0;
  private labels = new Map<string, Label>();
  private floats = new Map<string, Label>();
  // World labels sit under the panels so they never cover the order chips.
  private labelLayer = el('div', 'labels');
  private v = new THREE.Vector3();
  modalOpen = false;

  constructor(private handlers: HudHandlers) {
    installIcons();
    document.body.appendChild(this.root);

    const top = el('div', 'top');
    const coins = el('div', 'counter');
    coins.append(icon('coin', 'counter-icon'), this.coins);
    const level = el('div', 'level');
    const star = el('div', 'star');
    star.append(icon('star'), this.levelNum);
    const bar = el('div', 'bar');
    bar.append(this.xpFill, this.xpText);
    level.append(bar, star);
    this.ride.append(icon('horse', 'counter-icon'), this.rideText);
    this.ride.hidden = true;
    const buttons = el('div', 'top-buttons');
    if (handlers.showReport) buttons.appendChild(this.squareButton('report', 'Playtest report', () => this.handlers.onReport()));
    buttons.appendChild(this.squareButton('restart', 'Start over', () => this.handlers.onReset()));
    top.append(coins, level, buttons);

    const orders = el('div', 'orders');
    orders.appendChild(this.ride);
    for (let i = 0; i < MAX_ORDERS; i++) {
      const card = el('div', 'order');
      orders.appendChild(card);
      this.orderCards.push(card);
      this.orderKeys.push('');
    }

    const bottom = el('div', 'bottom');
    const seeds = el('div', 'seeds');
    for (const id of CROP_ORDER) {
      const b = el('button', 'seed');
      b.addEventListener('click', () => this.handlers.onSeed(id));
      seeds.appendChild(b);
      this.seedButtons.set(id, b);
    }
    bottom.append(this.goal, this.basket, seeds);

    this.root.append(this.labelLayer, top, orders, bottom, this.toastNode);
  }

  private squareButton(name: string, label: string, onClick: () => void): HTMLButtonElement {
    const b = el('button', 'square-btn');
    b.setAttribute('aria-label', label);
    b.appendChild(icon(name));
    b.addEventListener('click', onClick);
    return b;
  }

  render(state: GameState, selectedSeed: CropId, goal: string, rideLeftMs: number): void {
    setRich(this.goal, goal);
    const progress = orderProgress(state);
    const coins = String(state.coins);
    if (this.coins.textContent !== coins) this.coins.textContent = coins;
    const lvl = String(state.level);
    if (this.levelNum.textContent !== lvl) this.levelNum.textContent = lvl;
    const max = state.level >= MAX_LEVEL;
    this.xpFill.style.width = `${Math.round((max ? 1 : levelProgress(state)) * 100)}%`;
    const xpText = max ? 'Diwali!' : `${state.xp - LEVEL_XP[state.level - 1]} / ${LEVEL_XP[state.level] - LEVEL_XP[state.level - 1]}`;
    if (this.xpText.textContent !== xpText) this.xpText.textContent = xpText;

    this.ride.hidden = rideLeftMs <= 0;
    if (rideLeftMs > 0) {
      const secs = `0:${String(Math.ceil(rideLeftMs / 1000)).padStart(2, '0')}`;
      if (this.rideText.textContent !== secs) this.rideText.textContent = secs;
    }

    for (let i = 0; i < MAX_ORDERS; i++) {
      const o = state.orders[i];
      const card = this.orderCards[i];
      const key = o ? `${o.id}:${progress[i].have.join(',')}` : 'empty';
      if (key === this.orderKeys[i]) continue;
      this.orderKeys[i] = key;
      card.replaceChildren();
      card.hidden = !o;
      if (!o) continue;
      const ready = progress[i].ready;
      card.classList.toggle('ready', ready);
      card.title = `${o.who}: ${o.coins} coins, ${o.xp} xp`;
      const face = el('span', 'order-face');
      face.innerHTML = avatarHtml(villagerLook(o.who));
      card.appendChild(face);
      for (const [n, l] of o.lines.entries()) {
        const have = progress[i].have[n];
        const line = el('span', have >= l.qty ? 'line done' : 'line');
        line.append(icon(l.item), el('span', '', `${have}/${l.qty}`));
        card.appendChild(line);
      }
      const reward = el('span', 'order-reward');
      if (ready) reward.appendChild(icon('check'));
      else reward.append(icon('coin'), el('span', '', String(o.coins)));
      card.appendChild(reward);
      const x = el('button', 'order-x');
      x.appendChild(icon('close'));
      x.setAttribute('aria-label', `Send ${o.who} away`);
      x.addEventListener('click', () => this.handlers.onDismiss(o.id));
      card.appendChild(x);
    }

    const seedKey = `${state.level}:${selectedSeed}`;
    if (seedKey !== this.seedKey) {
      this.seedKey = seedKey;
      for (const [id, b] of this.seedButtons) {
        const crop = CROPS[id];
        const open = isCropUnlocked(state, id);
        b.classList.toggle('selected', id === selectedSeed);
        b.classList.toggle('locked', !open);
        const tag = el('span', crop.seedCost || !open ? 'tag' : 'tag free');
        if (!open) tag.textContent = `Lv ${crop.unlockLevel}`;
        else if (crop.seedCost) tag.append(icon('coin'), el('span', '', String(crop.seedCost)));
        else tag.textContent = 'Free';
        b.replaceChildren(icon(id, 'seed-icon'), tag);
        if (!open) b.appendChild(icon('lock', 'seed-lock'));
        b.setAttribute('aria-label', open ? `Plant ${crop.name}` : `${crop.name} unlocks at level ${crop.unlockLevel}`);
      }
    }

    const carried = ITEM_ORDER.filter((id) => state.inventory[id] > 0);
    const basketKey = carried.map((id) => `${id}${state.inventory[id]}`).join(',');
    if (basketKey !== this.basketKey) {
      this.basketKey = basketKey;
      this.basket.replaceChildren();
      this.basket.classList.toggle('empty', carried.length === 0);
      if (!carried.length) this.basket.textContent = 'Basket empty';
      for (const id of carried) {
        const slot = el('span', 'slot');
        slot.append(icon(id), el('span', 'slot-num', String(state.inventory[id])));
        slot.title = ITEMS[id].name;
        this.basket.appendChild(slot);
      }
    }
  }

  /** A text label that follows a point in the world. */
  label(id: string, text: string | null, pos: THREE.Vector3, cls = ''): void {
    let l = this.labels.get(id);
    if (text === null) {
      if (l) l.node.hidden = true;
      return;
    }
    if (!l) {
      l = { node: el('div', `label ${cls}`), pos: pos.clone() };
      this.labelLayer.appendChild(l.node);
      this.labels.set(id, l);
    }
    l.node.hidden = false;
    l.pos.copy(pos);
    setRich(l.node, text);
  }

  placeLabels(camera: THREE.Camera): void {
    for (const l of this.labels.values()) {
      if (l.node.hidden) continue;
      this.project(l.node, l.pos, camera);
    }
    // Floats stay pinned to their spot in the world while the camera glides.
    for (const f of this.floats.values()) this.project(f.node, f.pos, camera);
  }

  private project(node: HTMLElement, pos: THREE.Vector3, camera: THREE.Camera): void {
    this.v.copy(pos).project(camera);
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  /** A short "+1" that rises from a point in the world and fades. */
  float(text: string, pos: THREE.Vector3, camera: THREE.Camera): void {
    // One float per spot at a time: a newer one replaces the older, so they never stack into a jumble.
    const key = `${pos.x.toFixed(1)},${pos.z.toFixed(1)}`;
    this.floats.get(key)?.node.remove();
    const node = el('div', 'float');
    setRich(node, text);
    this.labelLayer.appendChild(node);
    const f = { node, pos: pos.clone() };
    this.floats.set(key, f);
    this.project(node, f.pos, camera);
    window.setTimeout(() => {
      node.remove();
      if (this.floats.get(key) === f) this.floats.delete(key);
    }, 1500);
  }

  toast(message: string): void {
    setRich(this.toastNode, message);
    this.toastNode.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastNode.classList.remove('show'), 1900);
  }

  modal(title: string, body: string, actions: { text: string; primary?: boolean; onClick?: () => void }[], festive = false): void {
    this.modalOpen = true;
    const shade = el('div', festive ? 'shade festive' : 'shade');
    const card = el('div', 'modal');
    card.setAttribute('role', 'dialog');
    const h = el('h2');
    setRich(h, title);
    const p = el('p');
    setRich(p, body);
    card.append(h, p);
    const row = el('div', 'modal-actions');
    for (const a of actions) {
      const b = el('button', a.primary ? 'btn primary' : 'btn', a.text);
      b.addEventListener('click', () => {
        shade.remove();
        this.modalOpen = false;
        a.onClick?.();
      });
      row.appendChild(b);
    }
    card.appendChild(row);
    shade.appendChild(card);
    this.root.appendChild(shade);
    (row.lastElementChild as HTMLButtonElement | null)?.focus();
  }

  /** The playtest report, with a button that copies it for pasting into a chat. */
  report(text: string): void {
    this.modalOpen = true;
    const shade = el('div', 'shade');
    const card = el('div', 'modal report');
    card.setAttribute('role', 'dialog');
    const box = el('textarea', 'report-text');
    box.value = text;
    box.readOnly = true;
    box.rows = text.split('\n').length;
    card.append(el('h2', '', 'Playtest report'), el('p', '', 'Copy this and send it back. Thank you for playing!'), box);
    const row = el('div', 'modal-actions');
    const close = el('button', 'btn', 'Close');
    close.addEventListener('click', () => {
      shade.remove();
      this.modalOpen = false;
    });
    const copy = el('button', 'btn primary', 'Copy report');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(text);
        copy.textContent = 'Copied ✓';
      } catch {
        // Clipboard can be blocked inside frames; leave the text selected for a manual copy.
        box.focus();
        box.select();
        copy.textContent = 'Selected, press copy';
      }
    });
    row.append(close, copy);
    card.appendChild(row);
    shade.appendChild(card);
    this.root.appendChild(shade);
    copy.focus();
  }
}
