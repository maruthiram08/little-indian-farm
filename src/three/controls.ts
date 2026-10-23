// Thumb joystick (touch or mouse drag anywhere on the world) plus WASD / arrow keys.
export class Controls {
  private origin: { x: number; y: number } | null = null;
  private pointerId: number | null = null;
  private stick = { x: 0, y: 0 };
  private keys = new Set<string>();
  private base: HTMLDivElement;
  private knob: HTMLDivElement;

  constructor(surface: HTMLElement) {
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'stick-knob';
    this.base.appendChild(this.knob);
    this.base.hidden = true;
    document.body.appendChild(this.base);

    surface.addEventListener('pointerdown', (e) => {
      if (this.pointerId !== null) return;
      this.pointerId = e.pointerId;
      this.origin = { x: e.clientX, y: e.clientY };
      this.base.hidden = false;
      this.base.style.left = `${e.clientX}px`;
      this.base.style.top = `${e.clientY}px`;
      this.move(e.clientX, e.clientY);
      surface.setPointerCapture(e.pointerId);
    });
    surface.addEventListener('pointermove', (e) => {
      if (e.pointerId === this.pointerId) this.move(e.clientX, e.clientY);
    });
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.pointerId) return;
      this.pointerId = null;
      this.origin = null;
      this.stick = { x: 0, y: 0 };
      this.base.hidden = true;
    };
    surface.addEventListener('pointerup', end);
    surface.addEventListener('pointercancel', end);
    window.addEventListener('keydown', (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => this.keys.clear());
  }

  private move(x: number, y: number): void {
    if (!this.origin) return;
    const max = 50;
    let dx = x - this.origin.x;
    let dy = y - this.origin.y;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    this.knob.style.transform = `translate(${dx}px, ${dy}px)`;
    this.stick = len < 6 ? { x: 0, y: 0 } : { x: dx / max, y: dy / max };
  }

  /** Direction on the ground plane: x to the right, z towards the camera. Length 0..1. */
  direction(): { x: number; z: number } {
    let x = this.stick.x;
    let z = this.stick.y;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) z -= 1;
    if (k.has('s') || k.has('arrowdown')) z += 1;
    const len = Math.hypot(x, z);
    return len > 1 ? { x: x / len, z: z / len } : { x, z };
  }
}
