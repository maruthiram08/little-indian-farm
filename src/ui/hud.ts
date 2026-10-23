// The on-screen layer over the 3D village: coins, level, orders, seeds, labels and dialogs.
import * as THREE from 'three';
import { CROPS, CROP_ORDER, CropId, ITEMS, ITEM_ORDER, MAX_LEVEL, MAX_ORDERS } from '../game/data';
import { GameState, canFulfill, isCropUnlocked, levelProgress } from '../game/sim';

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
  private coins = el('div', 'pill coins');
  private level = el('div', 'pill level');
  private levelText = el('span');
  private xpFill = el('div', 'xp-fill');
  private orderCards: HTMLDivElement[] = [];
  private orderKeys: string[] = [];
  private seedButtons = new Map<CropId, HTMLButtonElement>();
  private seedKey = '';
  private store = el('div', 'store');
  private toastNode = el('div', 'toast');
  private toastTimer = 0;
  private labels = new Map<string, Label>();
  // World labels sit under the panels so they never cover the order chips.
  private labelLayer = el('div', 'labels');
  private v = new THREE.Vector3();
  modalOpen = false;

  constructor(private handlers: HudHandlers) {
    document.body.appendChild(this.root);

    const top = el('div', 'top');
    const xp = el('div', 'xp');
    xp.appendChild(this.xpFill);
    this.level.append(this.levelText, xp);
    const reset = el('button', 'icon-btn', '↺');
    reset.setAttribute('aria-label', 'Start over');
    reset.addEventListener('click', () => this.handlers.onReset());
    top.append(this.coins, this.level, reset);
    if (handlers.showReport) {
      const rep = el('button', 'icon-btn', '📋');
      rep.setAttribute('aria-label', 'Playtest report');
      rep.addEventListener('click', () => this.handlers.onReport());
      top.insertBefore(rep, reset);
    }

    const orders = el('div', 'orders');
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
    bottom.append(this.store, seeds);

    this.root.append(this.labelLayer, top, orders, bottom, this.toastNode);
  }

  render(state: GameState, selectedSeed: CropId): void {
    this.coins.textContent = `🪙 ${state.coins}`;
    this.levelText.textContent = state.level >= MAX_LEVEL ? `Level ${state.level} 🪔` : `Level ${state.level}`;
    this.xpFill.style.width = `${Math.round(levelProgress(state) * 100)}%`;

    for (let i = 0; i < MAX_ORDERS; i++) {
      const o = state.orders[i];
      const card = this.orderCards[i];
      const key = o ? `${o.id}:${o.lines.map((l) => state.inventory[l.item]).join(',')}` : 'empty';
      if (key === this.orderKeys[i]) continue;
      this.orderKeys[i] = key;
      card.replaceChildren();
      card.hidden = !o;
      if (!o) continue;
      const ready = canFulfill(state, o);
      card.classList.toggle('ready', ready);
      card.title = `${o.who}: 🪙 ${o.coins} · ⭐ ${o.xp}`;
      card.appendChild(el('span', 'order-icon', o.icon));
      const lines = el('span', 'order-lines');
      for (const l of o.lines) {
        const have = Math.min(state.inventory[l.item], l.qty);
        lines.appendChild(el('span', have >= l.qty ? 'line done' : 'line', `${ITEMS[l.item].icon}${have}/${l.qty}`));
      }
      card.append(lines, el('span', 'order-reward', ready ? '✓' : `🪙${o.coins}`));
      const x = el('button', 'order-x', '✕');
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
        b.replaceChildren(
          el('span', 'seed-icon', open ? crop.icon : '🔒'),
          el('span', 'seed-cost', open ? (crop.seedCost ? `🪙 ${crop.seedCost}` : 'Free') : `Level ${crop.unlockLevel}`),
        );
        b.setAttribute('aria-label', open ? `Plant ${crop.name}` : `${crop.name} unlocks at level ${crop.unlockLevel}`);
      }
    }

    const carried = ITEM_ORDER.filter((id) => state.inventory[id] > 0)
      .map((id) => `${ITEMS[id].icon} ${state.inventory[id]}`)
      .join('   ');
    this.store.textContent = carried || 'Carrying nothing';
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
    if (l.node.textContent !== text) l.node.textContent = text;
  }

  placeLabels(camera: THREE.Camera): void {
    for (const l of this.labels.values()) {
      if (l.node.hidden) continue;
      this.project(l.node, l.pos, camera);
    }
  }

  private project(node: HTMLElement, pos: THREE.Vector3, camera: THREE.Camera): void {
    this.v.copy(pos).project(camera);
    const x = (this.v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-this.v.y * 0.5 + 0.5) * window.innerHeight;
    node.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
  }

  /** A short "+1" that rises from a point in the world and fades. */
  float(text: string, pos: THREE.Vector3, camera: THREE.Camera): void {
    const node = el('div', 'float', text);
    this.labelLayer.appendChild(node);
    this.project(node, pos, camera);
    window.setTimeout(() => node.remove(), 1000);
  }

  toast(message: string): void {
    this.toastNode.textContent = message;
    this.toastNode.classList.add('show');
    window.clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastNode.classList.remove('show'), 1900);
  }

  modal(title: string, body: string, actions: { text: string; primary?: boolean; onClick?: () => void }[], festive = false): void {
    this.modalOpen = true;
    const shade = el('div', festive ? 'shade festive' : 'shade');
    const card = el('div', 'modal');
    card.setAttribute('role', 'dialog');
    card.append(el('h2', '', title), el('p', '', body));
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
