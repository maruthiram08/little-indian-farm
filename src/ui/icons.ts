// Drawn icons for the HUD, so the interface doesn't lean on emoji that look different on every phone.
// They live in one hidden SVG sprite; each icon is a small <svg><use></svg> pointing at a symbol.

const OUTLINE = '#3b1d0b';

const SYMBOLS: Record<string, string> = {
  coin: `
    <circle cx="32" cy="34" r="26" fill="#b9700f" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="32" cy="31" r="26" fill="url(#g-gold)" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="32" cy="31" r="18" fill="none" stroke="#c98510" stroke-width="3"/>
    <path d="M24 20h17M24 26h17M24 20c13 0 13 13 0 13l15 13" fill="none" stroke="#a8660a" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M14 22a20 20 0 0 1 12-10" fill="none" stroke="#fff6c8" stroke-width="4" stroke-linecap="round"/>`,
  star: `
    <path d="M32 5l8 17 18 2-13 13 4 19-17-9-17 9 4-19L6 24l18-2z" fill="url(#g-star)" stroke="${OUTLINE}" stroke-width="3.5" stroke-linejoin="round"/>
    <path d="M24 26l6-1 2-6" fill="none" stroke="#fff6c8" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>`,
  wheat: `
    <path d="M32 62C32 46 31 30 32 12" fill="none" stroke="${OUTLINE}" stroke-width="7" stroke-linecap="round"/>
    <path d="M32 62C32 46 31 30 32 12" fill="none" stroke="#c98a2a" stroke-width="3" stroke-linecap="round"/>
    <g fill="url(#g-wheat)" stroke="${OUTLINE}" stroke-width="3">
      <ellipse cx="32" cy="11" rx="6" ry="9"/>
      <ellipse cx="23" cy="22" rx="6" ry="9.5" transform="rotate(-35 23 22)"/>
      <ellipse cx="41" cy="22" rx="6" ry="9.5" transform="rotate(35 41 22)"/>
      <ellipse cx="22" cy="36" rx="6" ry="9.5" transform="rotate(-35 22 36)"/>
      <ellipse cx="42" cy="36" rx="6" ry="9.5" transform="rotate(35 42 36)"/>
    </g>
    <path d="M30 7c-1 2-1 5 0 7" fill="none" stroke="#fff6c8" stroke-width="2.5" stroke-linecap="round"/>`,
  marigold: `
    <g stroke="${OUTLINE}" stroke-width="2.5">
      ${[0, 45, 90, 135, 180, 225, 270, 315].map((a) => `<ellipse cx="32" cy="14" rx="9" ry="11" fill="#e8780c" transform="rotate(${a} 32 32)"/>`).join('')}
      ${[22, 67, 112, 157, 202, 247, 292, 337].map((a) => `<ellipse cx="32" cy="20" rx="7" ry="9" fill="#f9a21b" transform="rotate(${a} 32 32)"/>`).join('')}
    </g>
    <circle cx="32" cy="32" r="9" fill="url(#g-gold)" stroke="${OUTLINE}" stroke-width="2.5"/>
    <circle cx="29" cy="29" r="2.5" fill="#fff6c8"/>`,
  sugarcane: `
    <g stroke="${OUTLINE}" stroke-width="2.5" stroke-linejoin="round">
      <path d="M40 14c10-6 16-4 20-2-8 1-13 4-17 9z" fill="#5aa83a"/>
      <rect x="20" y="10" width="10" height="50" rx="4" fill="#8bc34a" transform="rotate(-10 25 35)"/>
      <rect x="34" y="12" width="10" height="48" rx="4" fill="#6aa84f" transform="rotate(8 39 36)"/>
      <path d="M22 12C14 4 8 6 4 8c8 2 12 6 15 11z" fill="#5aa83a"/>
    </g>
    <g stroke="#3d6e26" stroke-width="3" stroke-linecap="round">
      <path d="M19 26l11-2M17 40l11-2M33 28l10 1M31 44l10 1"/>
    </g>`,
  jaggery: `
    <path d="M10 24l22-12 22 12v20L32 56 10 44z" fill="#7a3f12" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M10 24l22 12 22-12-22-12z" fill="#b8692a" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M32 36v20" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M10 24v20l22 12V36z" fill="#94501b" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M22 20l10-5" stroke="#e7a364" stroke-width="3.5" stroke-linecap="round"/>`,
  lock: `
    <path d="M20 28v-7a12 12 0 0 1 24 0v7" fill="none" stroke="${OUTLINE}" stroke-width="9"/>
    <path d="M20 28v-7a12 12 0 0 1 24 0v7" fill="none" stroke="#b9b2a6" stroke-width="4"/>
    <rect x="12" y="27" width="40" height="30" rx="7" fill="url(#g-gold)" stroke="${OUTLINE}" stroke-width="3"/>
    <circle cx="32" cy="39" r="4" fill="${OUTLINE}"/><path d="M32 41v8" stroke="${OUTLINE}" stroke-width="4" stroke-linecap="round"/>`,
  horse: `
    <path d="M14 58c0-12 4-20 10-26-4-2-9-2-13 0-4-5-2-11 3-14 4-2 8-4 12-9l2-5 4 6c10 1 18 8 20 20 2 9 0 20-2 28z" fill="#a0612c" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M30 10c8 2 14 8 17 15l3 33" fill="none" stroke="#3b1d0b" stroke-width="7" stroke-linecap="round"/>
    <path d="M30 10c8 2 14 8 17 15l3 33" fill="none" stroke="#5a2e10" stroke-width="3" stroke-linecap="round"/>
    <circle cx="24" cy="21" r="2.6" fill="${OUTLINE}"/>
    <path d="M24 32c6 2 12 0 16-4" fill="none" stroke="#e23b3b" stroke-width="4" stroke-linecap="round"/>
    <circle cx="40" cy="28" r="3" fill="#ffd34d" stroke="${OUTLINE}" stroke-width="1.5"/>`,
  report: `
    <rect x="12" y="10" width="40" height="48" rx="6" fill="#fff8e8" stroke="${OUTLINE}" stroke-width="3"/>
    <rect x="22" y="5" width="20" height="11" rx="4" fill="url(#g-gold)" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M20 28h24M20 37h24M20 46h14" stroke="#b5482a" stroke-width="4" stroke-linecap="round"/>`,
  restart: `
    <path d="M48 34a16 16 0 1 1-6-13" fill="none" stroke="${OUTLINE}" stroke-width="10" stroke-linecap="round"/>
    <path d="M48 34a16 16 0 1 1-6-13" fill="none" stroke="#fff8e8" stroke-width="5" stroke-linecap="round"/>
    <path d="M36 12l12 2-3 12z" fill="#fff8e8" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>`,
  close: `<path d="M18 18l28 28M46 18L18 46" stroke="currentColor" stroke-width="8" stroke-linecap="round"/>`,
  check: `
    <circle cx="32" cy="32" r="26" fill="url(#g-leaf)" stroke="${OUTLINE}" stroke-width="3"/>
    <path d="M20 33l8 8 16-17" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`,
  timer: `
    <path d="M18 6h28M18 58h28" stroke="${OUTLINE}" stroke-width="5" stroke-linecap="round"/>
    <path d="M20 8c0 14 24 14 24 24S20 46 20 56h24c0-10-24-14-24-24S44 22 44 8z" fill="#fff8e8" stroke="${OUTLINE}" stroke-width="3" stroke-linejoin="round"/>
    <path d="M26 52c2-4 10-4 12 0zM27 16h10c-1 4-9 4-10 0z" fill="#f2a31f"/>`,
};

const DEFS = `
  <linearGradient id="g-gold" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe680"/><stop offset="0.55" stop-color="#ffc21a"/><stop offset="1" stop-color="#f29a05"/></linearGradient>
  <linearGradient id="g-star" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff07a"/><stop offset="1" stop-color="#ffab00"/></linearGradient>
  <linearGradient id="g-wheat" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset="1" stop-color="#e3a52a"/></linearGradient>
  <linearGradient id="g-leaf" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fd65a"/><stop offset="1" stop-color="#3f9a2c"/></linearGradient>`;

export type IconName = keyof typeof SYMBOLS;

/** Adds the sprite to the page once. */
export function installIcons(): void {
  if (document.getElementById('icon-sprite')) return;
  const holder = document.createElement('div');
  holder.innerHTML = `<svg id="icon-sprite" xmlns="http://www.w3.org/2000/svg" style="position:absolute;width:0;height:0" aria-hidden="true"><defs>${DEFS}</defs>${Object.entries(
    SYMBOLS,
  )
    .map(([name, body]) => `<symbol id="i-${name}" viewBox="0 0 64 64">${body}</symbol>`)
    .join('')}</svg>`;
  document.body.prepend(holder.firstElementChild!);
}

export function iconHtml(name: string, cls = ''): string {
  return `<svg class="ic ${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;
}

export function icon(name: string, cls = ''): SVGSVGElement {
  const t = document.createElement('template');
  t.innerHTML = iconHtml(name, cls);
  return t.content.firstElementChild as SVGSVGElement;
}

// Game text still uses emoji as shorthand; these are swapped for drawn icons when shown.
const EMOJI: Record<string, IconName> = {
  '🪙': 'coin',
  '⭐': 'star',
  '🌾': 'wheat',
  '🌼': 'marigold',
  '🎋': 'sugarcane',
  '🟫': 'jaggery',
  '🔒': 'lock',
  '🐎': 'horse',
  '⏳': 'timer',
};
const EMOJI_RE = new RegExp(Object.keys(EMOJI).join('|'), 'gu');

const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Escapes text and swaps known emoji for icons. */
export function iconize(text: string): string {
  return escape(text).replace(EMOJI_RE, (e) => iconHtml(EMOJI[e]));
}

/** Sets an element's text with icons, skipping the DOM work when nothing changed. */
export function setRich(node: HTMLElement, text: string): void {
  if (node.dataset.text === text) return;
  node.dataset.text = text;
  node.innerHTML = iconize(text);
}

export interface AvatarLook {
  top: string;
  head: string;
  headKind: 'turban' | 'cap' | 'hair';
  saree?: boolean;
}

/** A round portrait of a villager, drawn from the same colours as their 3D model. */
export function avatarHtml(look: AvatarLook): string {
  const skin = '#c58a58';
  const hair =
    look.headKind === 'turban'
      ? `<path d="M14 26c0-12 8-18 18-18s18 6 18 18c-6-3-30-3-36 0z" fill="${look.head}" stroke="${OUTLINE}" stroke-width="2.5"/><circle cx="40" cy="12" r="5" fill="${look.head}" stroke="${OUTLINE}" stroke-width="2.5"/>`
      : look.headKind === 'cap'
        ? `<path d="M17 24c0-10 6-14 15-14s15 4 15 14z" fill="${look.head}" stroke="${OUTLINE}" stroke-width="2.5"/>`
        : `<path d="M15 34c-2-16 6-24 17-24s19 8 17 24c-2-8-6-12-17-12s-15 4-17 12z" fill="${look.head}" stroke="${OUTLINE}" stroke-width="2.5"/>`;
  const drape = look.saree ? `<path d="M12 64c2-14 10-20 20-20 4 0 8 1 11 3L22 64z" fill="${look.head === '#1d1d1d' ? '#f2a31f' : '#ffd34d'}" opacity="0.9"/>` : '';
  return `<svg class="avatar" viewBox="0 0 64 64" aria-hidden="true">
    <circle cx="32" cy="32" r="30" fill="#ffe7b8"/>
    <path d="M8 64c2-14 12-20 24-20s22 6 24 20z" fill="${look.top}" stroke="${OUTLINE}" stroke-width="2.5"/>${drape}
    <circle cx="32" cy="30" r="14" fill="${skin}" stroke="${OUTLINE}" stroke-width="2.5"/>
    <circle cx="27" cy="31" r="1.8" fill="${OUTLINE}"/><circle cx="37" cy="31" r="1.8" fill="${OUTLINE}"/>
    <path d="M28 37c2 2 6 2 8 0" fill="none" stroke="${OUTLINE}" stroke-width="2" stroke-linecap="round"/>
    ${hair}
  </svg>`;
}
