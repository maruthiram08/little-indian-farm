import Phaser from 'phaser';
import {
  CROPS,
  CROP_ORDER,
  CropId,
  GRID_SIZE,
  ITEMS,
  ITEM_ORDER,
  KOLHU,
  LEVEL_UNLOCK_TEXT,
  MAX_LEVEL,
  MAX_ORDERS,
} from '../game/data';
import {
  GameState,
  buyPlot,
  canFulfill,
  collectPress,
  dismissOrder,
  fulfill,
  growProgress,
  harvest,
  isCropUnlocked,
  isRipe,
  kolhuProgress,
  kolhuStatus,
  levelProgress,
  nextPlotCost,
  plant,
  startPress,
  tick,
} from '../game/sim';
import { clearSave, loadGame, saveGame } from '../game/save';

export const WIDTH = 720;
export const HEIGHT = 1280;

const FONT =
  'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji"';

const C = {
  sky: 0xf6e7c1,
  bar: 0xb5482a,
  card: 0xfff8e8,
  cardEdge: 0xd9a55b,
  soil: 0x8a5a33,
  soilDark: 0x6e4425,
  grass: 0x93b957,
  grassDark: 0x7a9c45,
  saffron: 0xf29c1f,
  green: 0x3f8f3a,
  muted: 0xcbbba0,
  ink: '#4a2c12',
  inkSoft: '#8a6a48',
  white: '#ffffff',
};

const GRID_CELL = 140;
const GRID_GAP = 12;
const GRID_X = (WIDTH - (GRID_CELL * GRID_SIZE + GRID_GAP * (GRID_SIZE - 1))) / 2;
const GRID_Y = 440;

const ORDER_W = 218;
const ORDER_H = 250;
const ORDER_Y = 140;

const BOTTOM_Y = GRID_Y + GRID_CELL * GRID_SIZE + GRID_GAP * (GRID_SIZE - 1) + 18;

interface PlotView {
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  key: string;
}

interface OrderView {
  bg: Phaser.GameObjects.Graphics;
  icon: Phaser.GameObjects.Text;
  who: Phaser.GameObjects.Text;
  lines: Phaser.GameObjects.Text;
  reward: Phaser.GameObjects.Text;
  give: Phaser.GameObjects.Container;
  giveBg: Phaser.GameObjects.Graphics;
  giveLabel: Phaser.GameObjects.Text;
  close: Phaser.GameObjects.Text;
  waiting: Phaser.GameObjects.Text;
  orderId: number | null;
  key: string;
}

export class VillageScene extends Phaser.Scene {
  private state!: GameState;
  private selectedSeed: CropId = 'wheat';
  private plots: PlotView[] = [];
  private orders: OrderView[] = [];
  private coinsText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private xpBar!: Phaser.GameObjects.Graphics;
  private title!: Phaser.GameObjects.Text;
  private invText!: Phaser.GameObjects.Text;
  private kolhuStatusText!: Phaser.GameObjects.Text;
  private kolhuBar!: Phaser.GameObjects.Graphics;
  private kolhuBtnBg!: Phaser.GameObjects.Graphics;
  private kolhuBtnLabel!: Phaser.GameObjects.Text;
  private kolhuLock!: Phaser.GameObjects.Container;
  private seedButtons: { id: CropId; bg: Phaser.GameObjects.Graphics; icon: Phaser.GameObjects.Text; label: Phaser.GameObjects.Text }[] = [];
  private toastText!: Phaser.GameObjects.Text;
  private modalOpen = false;
  private lastSave = 0;

  constructor() {
    super('village');
  }

  create(): void {
    this.state = loadGame(Date.now());
    this.plots = [];
    this.orders = [];
    this.seedButtons = [];
    this.modalOpen = false;
    this.cameras.main.setBackgroundColor(C.sky);

    this.buildTopBar();
    this.buildOrders();
    this.buildFields();
    this.buildBottom();

    this.toastText = this.add
      .text(WIDTH / 2, GRID_Y - 24, '', this.style(26, C.white, true))
      .setOrigin(0.5)
      .setBackgroundColor('#4a2c12cc')
      .setPadding(18, 10, 18, 10)
      .setDepth(50)
      .setAlpha(0);

    const persist = () => saveGame(this.state);
    document.addEventListener('visibilitychange', persist);
    window.addEventListener('pagehide', persist);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      document.removeEventListener('visibilitychange', persist);
      window.removeEventListener('pagehide', persist);
    });

    if (this.state.xp === 0 && this.state.plots.every((p) => !p.crop)) {
      this.time.delayedCall(400, () => this.toast('Tap a field to plant wheat 🌾'));
    }
  }

  update(): void {
    const now = Date.now();
    tick(this.state, now, Math.random);
    this.renderTopBar();
    this.renderOrders();
    this.renderPlots(now);
    this.renderBottom(now);
    if (now - this.lastSave > 5_000) {
      saveGame(this.state);
      this.lastSave = now;
    }
  }

  // ---------- layout ----------

  private style(size: number, color = C.ink, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: FONT, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' };
  }

  private roundRect(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, edge?: number, r = 18) {
    g.clear();
    g.fillStyle(fill, 1);
    g.fillRoundedRect(x, y, w, h, r);
    if (edge !== undefined) {
      g.lineStyle(3, edge, 1);
      g.strokeRoundedRect(x, y, w, h, r);
    }
  }

  private button(x: number, y: number, w: number, h: number, text: string, onTap: () => void) {
    const bg = this.add.graphics();
    const label = this.add.text(w / 2, h / 2, text, this.style(24, C.white, true)).setOrigin(0.5);
    const box = this.add.container(x, y, [bg, label]);
    box.setSize(w, h);
    box.setInteractive(new Phaser.Geom.Rectangle(0, 0, w, h), Phaser.Geom.Rectangle.Contains);
    box.on('pointerdown', () => {
      if (this.modalOpen) return;
      this.tweens.add({ targets: box, scale: 0.94, duration: 60, yoyo: true });
      onTap();
    });
    this.roundRect(bg, 0, 0, w, h, C.green, undefined, 14);
    return { box, bg, label };
  }

  private buildTopBar(): void {
    const g = this.add.graphics();
    g.fillStyle(C.bar, 1);
    g.fillRect(0, 0, WIDTH, 104);
    this.title = this.add.text(24, 18, 'Little Village Story', this.style(22, '#ffe3b0', true));
    this.coinsText = this.add.text(24, 50, '', this.style(34, C.white, true));
    this.levelText = this.add.text(WIDTH - 84, 18, '', this.style(22, '#ffe3b0', true)).setOrigin(1, 0);
    this.xpBar = this.add.graphics();

    const reset = this.add.text(WIDTH - 22, 52, '↺', this.style(40, '#ffe3b0', true)).setOrigin(1, 0.5).setPadding(8);
    reset.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.confirmReset());
  }

  private buildOrders(): void {
    this.add.text(24, ORDER_Y - 6, 'Haat · villagers waiting', this.style(22, C.inkSoft, true)).setOrigin(0, 1);
    for (let i = 0; i < MAX_ORDERS; i++) {
      const x = 18 + i * (ORDER_W + 12);
      const bg = this.add.graphics();
      this.roundRect(bg, x, ORDER_Y, ORDER_W, ORDER_H, C.card, C.cardEdge);
      const cx = x + ORDER_W / 2;
      const icon = this.add.text(cx, ORDER_Y + 38, '', this.style(48)).setOrigin(0.5);
      const who = this.add.text(cx, ORDER_Y + 80, '', this.style(19, C.ink, true)).setOrigin(0.5);
      const lines = this.add.text(cx, ORDER_Y + 102, '', { ...this.style(25, C.ink, true), align: 'center' }).setOrigin(0.5, 0);
      const reward = this.add.text(cx, ORDER_Y + 168, '', this.style(19, C.inkSoft)).setOrigin(0.5);
      const btn = this.button(x + 16, ORDER_Y + ORDER_H - 58, ORDER_W - 32, 44, 'Give', () => this.onGive(i));
      const close = this.add.text(x + ORDER_W - 12, ORDER_Y + 8, '✕', this.style(22, C.inkSoft, true)).setOrigin(1, 0);
      close.setInteractive({ useHandCursor: true }).on('pointerdown', () => this.onDismiss(i));
      const waiting = this.add
        .text(cx, ORDER_Y + ORDER_H / 2, 'Someone is\ncoming…', { ...this.style(20, C.inkSoft), align: 'center' })
        .setOrigin(0.5);
      this.orders.push({
        bg, icon, who, lines, reward, give: btn.box, giveBg: btn.bg, giveLabel: btn.label, close, waiting, orderId: null, key: '',
      });
    }
  }

  private buildFields(): void {
    this.add.text(24, GRID_Y - 10, 'Your fields', this.style(22, C.inkSoft, true)).setOrigin(0, 1);
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const x = GRID_X + col * (GRID_CELL + GRID_GAP);
      const y = GRID_Y + row * (GRID_CELL + GRID_GAP);
      const bg = this.add.graphics();
      const icon = this.add.text(x + GRID_CELL / 2, y + GRID_CELL / 2 - 8, '', this.style(64)).setOrigin(0.5);
      const label = this.add.text(x + GRID_CELL / 2, y + GRID_CELL - 24, '', this.style(20, C.white, true)).setOrigin(0.5);
      const bar = this.add.graphics();
      const zone = this.add.zone(x, y, GRID_CELL, GRID_CELL).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onPlot(i));
      this.plots.push({ bg, icon, label, bar, key: '' });
    }
  }

  private buildBottom(): void {
    const y = BOTTOM_Y;
    // Kolhu (sugarcane press)
    const kw = 300;
    const kh = HEIGHT - y - 16;
    const k = this.add.graphics();
    this.roundRect(k, 18, y, kw, kh, C.card, C.cardEdge);
    this.add.text(36, y + 14, '⚙️ Kolhu', this.style(24, C.ink, true));
    this.add.text(36, y + 48, `${KOLHU.inputQty} 🎋 → 1 🟫 jaggery`, this.style(19, C.inkSoft));
    this.kolhuStatusText = this.add.text(36, y + 78, '', this.style(19, C.ink));
    this.kolhuBar = this.add.graphics();
    const btn = this.button(36, y + kh - 60, kw - 36, 46, 'Press', () => this.onKolhu());
    this.kolhuBtnBg = btn.bg;
    this.kolhuBtnLabel = btn.label;
    const lockBg = this.add.graphics();
    this.roundRect(lockBg, 18, y, kw, kh, C.card, C.cardEdge);
    const lockText = this.add
      .text(18 + kw / 2, y + kh / 2, `⚙️ Kolhu\n\n🔒 Opens at level ${KOLHU.unlockLevel}`, {
        ...this.style(22, C.inkSoft, true),
        align: 'center',
      })
      .setOrigin(0.5);
    this.kolhuLock = this.add.container(0, 0, [lockBg, lockText]);

    // Seeds
    const sx = 18 + kw + 14;
    const sw = WIDTH - sx - 18;
    this.add.text(sx, y + 2, 'Seeds', this.style(20, C.inkSoft, true));
    const bw = (sw - 16) / 3;
    CROP_ORDER.forEach((id, i) => {
      const bx = sx + i * (bw + 8);
      const by = y + 30;
      const bg = this.add.graphics();
      const icon = this.add.text(bx + bw / 2, by + 34, '', this.style(38)).setOrigin(0.5);
      const label = this.add.text(bx + bw / 2, by + 72, '', this.style(19, C.ink, true)).setOrigin(0.5);
      const zone = this.add.zone(bx, by, bw, 92).setOrigin(0).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.onSeed(id));
      bg.setData('rect', [bx, by, bw, 92]);
      this.seedButtons.push({ id, bg, icon, label });
    });

    // Inventory
    const iy = y + 134;
    const inv = this.add.graphics();
    this.roundRect(inv, sx, iy, sw, HEIGHT - iy - 16, C.card, C.cardEdge);
    this.add.text(sx + 16, iy + 10, 'Store room', this.style(18, C.inkSoft, true));
    this.invText = this.add.text(sx + sw / 2, iy + 50, '', this.style(26, C.ink, true)).setOrigin(0.5);
  }

  // ---------- rendering ----------

  private renderTopBar(): void {
    const s = this.state;
    this.coinsText.setText(`🪙 ${s.coins}`);
    this.levelText.setText(s.level >= MAX_LEVEL ? `Level ${s.level} · Max` : `Level ${s.level}`);
    this.xpBar.clear();
    this.xpBar.fillStyle(0x7d2c17, 1);
    this.xpBar.fillRoundedRect(WIDTH - 284, 58, 200, 18, 9);
    this.xpBar.fillStyle(C.saffron, 1);
    this.xpBar.fillRoundedRect(WIDTH - 284, 58, Math.max(18, 200 * levelProgress(s)), 18, 9);
    this.title.setText(s.celebrated ? '🪔 Little Village Story 🪔' : 'Little Village Story');
  }

  private renderOrders(): void {
    for (let i = 0; i < MAX_ORDERS; i++) {
      const v = this.orders[i];
      const o = this.state.orders[i];
      const ready = o ? canFulfill(this.state, o) : false;
      const key = o ? `${o.id}:${ready}:${o.lines.map((l) => this.state.inventory[l.item]).join(',')}` : 'empty';
      if (key === v.key) continue;
      v.key = key;
      v.orderId = o ? o.id : null;
      const show = !!o;
      [v.icon, v.who, v.lines, v.reward, v.give, v.close].forEach((obj) => obj.setVisible(show));
      v.waiting.setVisible(!show);
      if (!o) continue;
      v.icon.setText(o.icon);
      v.who.setText(o.who);
      v.lines.setText(
        o.lines.map((l) => `${ITEMS[l.item].icon} ${Math.min(this.state.inventory[l.item], l.qty)}/${l.qty}`).join('\n'),
      );
      v.lines.setFontSize(o.lines.length > 1 ? 22 : 28);
      v.reward.setY(ORDER_Y + (o.lines.length > 1 ? 172 : 160));
      v.reward.setText(`🪙 ${o.coins}   ⭐ ${o.xp}`);
      const bw = ORDER_W - 32;
      this.roundRect(v.giveBg, 0, 0, bw, 44, ready ? C.green : C.muted, undefined, 14);
      v.giveLabel.setText(ready ? 'Give' : 'Need more');
    }
  }

  private renderPlots(now: number): void {
    const s = this.state;
    for (let i = 0; i < s.plots.length; i++) {
      const p = s.plots[i];
      const v = this.plots[i];
      const col = i % GRID_SIZE;
      const row = Math.floor(i / GRID_SIZE);
      const x = GRID_X + col * (GRID_CELL + GRID_GAP);
      const y = GRID_Y + row * (GRID_CELL + GRID_GAP);
      const ripe = isRipe(p, now);
      const progress = growProgress(p, now);
      const stage = !p.unlocked ? 'locked' : !p.crop ? 'empty' : ripe ? 'ripe' : progress < 0.5 ? 'sprout' : 'young';
      const key = `${stage}:${p.crop}:${!p.unlocked ? nextPlotCost(s) : ''}`;

      if (key !== v.key) {
        v.key = key;
        v.icon.setScale(1);
        this.tweens.killTweensOf(v.icon);
        if (stage === 'locked') {
          this.roundRect(v.bg, x, y, GRID_CELL, GRID_CELL, C.grass, C.grassDark);
          v.icon.setText('🌿').setFontSize(48);
          v.label.setText(`🪙 ${nextPlotCost(s)}`).setColor(C.white);
        } else {
          this.roundRect(v.bg, x, y, GRID_CELL, GRID_CELL, C.soil, C.soilDark);
          // Furrows
          v.bg.lineStyle(4, C.soilDark, 0.6);
          for (let f = 1; f <= 3; f++) v.bg.lineBetween(x + 16, y + (f * GRID_CELL) / 4, x + GRID_CELL - 16, y + (f * GRID_CELL) / 4);
          if (stage === 'empty') {
            v.icon.setText('＋').setFontSize(44).setColor('#c79a6e');
            v.label.setText('');
          } else {
            const crop = CROPS[p.crop!];
            v.icon.setColor(C.ink);
            if (stage === 'sprout') v.icon.setText('🌱').setFontSize(44);
            if (stage === 'young') v.icon.setText(crop.icon).setFontSize(44);
            if (stage === 'ripe') {
              v.icon.setText(crop.icon).setFontSize(72);
              this.tweens.add({ targets: v.icon, scale: 1.1, duration: 500, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
            }
            v.label.setText(stage === 'ripe' ? 'Harvest!' : '');
          }
        }
      }

      v.bar.clear();
      if (p.crop && !ripe) {
        v.bar.fillStyle(0x000000, 0.35);
        v.bar.fillRoundedRect(x + 18, y + GRID_CELL - 30, GRID_CELL - 36, 14, 7);
        v.bar.fillStyle(C.saffron, 1);
        v.bar.fillRoundedRect(x + 18, y + GRID_CELL - 30, Math.max(14, (GRID_CELL - 36) * progress), 14, 7);
      }
    }
  }

  private renderBottom(now: number): void {
    const s = this.state;
    const status = kolhuStatus(s, now);
    this.kolhuLock.setVisible(status === 'locked');
    const y = BOTTOM_Y;
    this.kolhuBar.clear();
    if (status === 'pressing' || status === 'ready') {
      this.kolhuBar.fillStyle(C.muted, 1);
      this.kolhuBar.fillRoundedRect(36, y + 110, 264, 14, 7);
      this.kolhuBar.fillStyle(C.saffron, 1);
      this.kolhuBar.fillRoundedRect(36, y + 110, Math.max(14, 264 * kolhuProgress(s, now)), 14, 7);
    }
    const left = Math.ceil((KOLHU.pressMs - (now - (s.kolhuStartedAt ?? now))) / 1000);
    this.kolhuStatusText.setText(
      status === 'pressing' ? `Pressing… ${left}s` : status === 'ready' ? 'Jaggery is ready!' : status === 'idle' ? 'Idle' : '',
    );
    const canPress = status === 'idle' && s.inventory.sugarcane >= KOLHU.inputQty;
    const active = status === 'ready' || canPress;
    const label = status === 'ready' ? 'Collect 🟫' : status === 'pressing' ? 'Pressing…' : 'Press';
    if (this.kolhuBtnLabel.text !== label || this.kolhuBtnBg.getData('active') !== active) {
      this.kolhuBtnLabel.setText(label);
      this.kolhuBtnBg.setData('active', active);
      this.roundRect(this.kolhuBtnBg, 0, 0, 264, 46, active ? (status === 'ready' ? C.saffron : C.green) : C.muted, undefined, 14);
    }

    for (const b of this.seedButtons) {
      const [bx, by, bw, bh] = b.bg.getData('rect') as number[];
      const crop = CROPS[b.id];
      const unlocked = isCropUnlocked(s, b.id);
      const selected = this.selectedSeed === b.id;
      const key = `${unlocked}:${selected}`;
      if (b.bg.getData('key') === key) continue;
      b.bg.setData('key', key);
      this.roundRect(b.bg, bx, by, bw, bh, selected ? 0xffe3a3 : C.card, selected ? C.saffron : C.cardEdge, 14);
      b.icon.setText(unlocked ? crop.icon : '🔒').setAlpha(unlocked ? 1 : 0.6);
      b.label.setText(unlocked ? (crop.seedCost === 0 ? 'Free' : `🪙 ${crop.seedCost}`) : `Level ${crop.unlockLevel}`);
      b.label.setColor(unlocked ? C.ink : C.inkSoft);
    }

    this.invText.setText(ITEM_ORDER.map((id) => `${ITEMS[id].icon}${s.inventory[id]}`).join('  '));
  }

  // ---------- input ----------

  private onPlot(i: number): void {
    if (this.modalOpen) return;
    const now = Date.now();
    const p = this.state.plots[i];
    if (!p.unlocked) {
      const cost = nextPlotCost(this.state);
      const r = buyPlot(this.state, i);
      if (r.ok) this.floatText(i, `Cleared! −🪙${cost}`);
      else this.toast(r.reason);
      return;
    }
    if (!p.crop) {
      const r = plant(this.state, i, this.selectedSeed, now);
      if (!r.ok) {
        // Fall back to free wheat so the player is never stuck.
        if (this.selectedSeed !== 'wheat' && plant(this.state, i, 'wheat', now).ok) {
          this.toast(`${r.reason}, planted wheat instead`);
        } else this.toast(r.reason);
      }
      return;
    }
    if (isRipe(p, now)) {
      const crop = p.crop;
      harvest(this.state, i, now);
      this.floatText(i, `+1 ${CROPS[crop].icon}`);
      return;
    }
    const left = Math.ceil((CROPS[p.crop].growMs - (now - p.plantedAt)) / 1000);
    this.toast(`${CROPS[p.crop].name} ready in ${left}s`);
  }

  private onSeed(id: CropId): void {
    if (this.modalOpen) return;
    if (!isCropUnlocked(this.state, id)) {
      this.toast(`${CROPS[id].name} unlocks at level ${CROPS[id].unlockLevel}`);
      return;
    }
    this.selectedSeed = id;
    this.toast(`Planting ${CROPS[id].name} ${CROPS[id].icon}`);
  }

  private onGive(slot: number): void {
    const id = this.orders[slot].orderId;
    if (id === null) return;
    const order = this.state.orders.find((o) => o.id === id);
    const r = fulfill(this.state, id, Date.now());
    if (!r.ok) {
      this.toast(r.reason ?? 'Not yet');
      return;
    }
    const x = 18 + slot * (ORDER_W + 12) + ORDER_W / 2;
    this.float(x, ORDER_Y + 120, `+🪙${order!.coins}`);
    saveGame(this.state);
    r.levelsGained.forEach((level, n) => this.time.delayedCall(300 + n * 50, () => this.levelUp(level)));
  }

  private onDismiss(slot: number): void {
    if (this.modalOpen) return;
    const id = this.orders[slot].orderId;
    if (id !== null) dismissOrder(this.state, id, Date.now());
  }

  private onKolhu(): void {
    const now = Date.now();
    const status = kolhuStatus(this.state, now);
    if (status === 'ready') {
      collectPress(this.state, now);
      this.float(170, BOTTOM_Y + 90, '+1 🟫');
      return;
    }
    const r = startPress(this.state, now);
    if (!r.ok) this.toast(r.reason);
  }

  // ---------- feedback ----------

  private toast(message: string): void {
    this.tweens.killTweensOf(this.toastText);
    this.toastText.setText(message).setAlpha(1);
    this.tweens.add({ targets: this.toastText, alpha: 0, delay: 1400, duration: 400 });
  }

  private floatText(plotIndex: number, text: string): void {
    const col = plotIndex % GRID_SIZE;
    const row = Math.floor(plotIndex / GRID_SIZE);
    this.float(GRID_X + col * (GRID_CELL + GRID_GAP) + GRID_CELL / 2, GRID_Y + row * (GRID_CELL + GRID_GAP) + 40, text);
  }

  private float(x: number, y: number, text: string): void {
    const t = this.add.text(x, y, text, this.style(30, C.white, true)).setOrigin(0.5).setDepth(40);
    t.setStroke('#4a2c12', 6);
    this.tweens.add({ targets: t, y: y - 70, alpha: 0, duration: 900, ease: 'Cubic.out', onComplete: () => t.destroy() });
  }

  private modal(title: string, body: string, buttonText: string, festive: boolean, onClose?: () => void): void {
    this.modalOpen = true;
    const layer = this.add.container(0, 0).setDepth(100);
    const shade = this.add.rectangle(0, 0, WIDTH, HEIGHT, festive ? 0x1b0b2e : 0x000000, festive ? 0.9 : 0.55).setOrigin(0);
    shade.setInteractive();
    layer.add(shade);
    const close = (confirmed: boolean) => {
      layer.destroy();
      this.modalOpen = false;
      if (confirmed) onClose?.();
    };
    // Tapping outside a plain dialog dismisses it without confirming.
    if (!festive) shade.on('pointerdown', () => close(false));

    if (festive) {
      for (let n = 0; n < 18; n++) {
        const diya = this.add.text(40 + (n % 6) * 128, n < 6 ? 180 : n < 12 ? 1040 : 1140, '🪔', this.style(48)).setOrigin(0.5);
        this.tweens.add({ targets: diya, alpha: 0.45, duration: 300 + (n % 5) * 120, yoyo: true, repeat: -1 });
        layer.add(diya);
      }
      for (let n = 0; n < 6; n++) this.time.delayedCall(n * 450, () => this.burst(layer));
    }

    const card = this.add.graphics();
    this.roundRect(card, 60, 380, WIDTH - 120, 460, C.card, festive ? C.saffron : C.cardEdge, 28);
    layer.add(card);
    // Swallow taps on the card so they don't reach the shade.
    layer.add(this.add.zone(60, 380, WIDTH - 120, 460).setOrigin(0).setInteractive());
    layer.add(this.add.text(WIDTH / 2, 460, title, { ...this.style(40, C.ink, true), align: 'center' }).setOrigin(0.5));
    layer.add(
      this.add
        .text(WIDTH / 2, 600, body, { ...this.style(26, C.ink), align: 'center', wordWrap: { width: WIDTH - 200 } })
        .setOrigin(0.5),
    );
    const btn = this.add.container(WIDTH / 2 - 150, 740);
    const bg = this.add.graphics();
    this.roundRect(bg, 0, 0, 300, 64, festive ? C.saffron : C.green, undefined, 16);
    btn.add([bg, this.add.text(150, 32, buttonText, this.style(28, C.white, true)).setOrigin(0.5)]);
    btn.setInteractive(new Phaser.Geom.Rectangle(0, 0, 300, 64), Phaser.Geom.Rectangle.Contains);
    btn.on('pointerdown', () => close(true));
    layer.add(btn);
    layer.setAlpha(0);
    this.tweens.add({ targets: layer, alpha: 1, duration: 250 });
  }

  private burst(layer: Phaser.GameObjects.Container): void {
    if (!layer.active) return;
    const x = 120 + Math.random() * (WIDTH - 240);
    const y = 120 + Math.random() * 220;
    const colors = [0xffc93c, 0xff6b6b, 0x9bf6ff, 0xf29c1f, 0xffffff];
    for (let n = 0; n < 14; n++) {
      const a = (n / 14) * Math.PI * 2;
      const dot = this.add.circle(x, y, 6, colors[n % colors.length]);
      layer.add(dot);
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(a) * 110,
        y: y + Math.sin(a) * 110,
        alpha: 0,
        duration: 900,
        ease: 'Cubic.out',
        onComplete: () => dot.destroy(),
      });
    }
  }

  private levelUp(level: number): void {
    if (level >= MAX_LEVEL && !this.state.celebrated) {
      this.state.celebrated = true;
      saveGame(this.state);
      this.modal(
        'Shubh Deepavali! 🪔',
        'Dadi\'s fields are green again and the whole village is lit up for Diwali.\n\nThank you for playing! Villagers will keep coming if you want to keep farming.',
        'Keep farming',
        true,
      );
      return;
    }
    this.modal(`Level ${level}! ⭐`, LEVEL_UNLOCK_TEXT[level] ?? 'Well done!', 'Shabash!', false);
  }

  private confirmReset(): void {
    if (this.modalOpen) return;
    this.modal('Start over?', 'This clears your village and starts a new game.', 'Yes, start over', false, () => {
      clearSave();
      this.scene.restart();
    });
  }
}
