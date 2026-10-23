# Little Village Story

A small, relaxed farming game set in an Indian village. Grow wheat, marigold and
sugarcane, press sugarcane into jaggery at the kolhu, fill orders for the villagers
at the haat, and clear more land until the village lights up for Diwali.

This is phase one: a weekend-sized, mobile-first browser game in low-poly 3D. Drag
anywhere to walk the farmer (or use WASD / arrow keys): step on soil to plant, walk over
ripe crops to harvest, drop sugarcane at the kolhu, and visit the haat to hand over
orders. Progress saves on the device, and the game can be added to a phone's home screen.

## Play

Every push to `main` is tested and published to GitHub Pages:
https://maruthiram08.github.io/little-indian-farm/

## Develop

```bash
npm install
npm run dev      # local server; open the printed address on your phone (same Wi-Fi)
npm test         # economy tests, including a bot that plays to the final level
npm run build    # production build in dist/
npm run build:single  # one self-contained HTML file in dist-single/
```

## Where things live

| Path | What it holds |
| --- | --- |
| `src/game/data.ts` | All tunable content: crops, prices, timers, levels, villagers |
| `src/game/sim.ts` | Game rules with no rendering, driven by timestamps so crops grow while the game is closed |
| `src/game/save.ts` | Saving to the browser's localStorage |
| `src/three/models.ts` | Low-poly models built from primitives: farmer, villagers, crops, kolhu, haat, house, trees |
| `src/three/world.ts` | The village layout, lighting and Diwali night, kept in sync with the game state |
| `src/three/controls.ts` | Thumb joystick and keyboard movement |
| `src/ui/hud.ts` | Coins, level, order cards, seed picker, labels over the world, dialogs |
| `src/main.ts` | The game loop: movement, what happens where you stand, camera |
| `tests/sim.test.ts` | Tests for the rules and pacing |
| `public/` | Home-screen manifest, icon and offline service worker |

Balancing the game means editing `src/game/data.ts` and running `npm test`; the pacing
test fails if a perfect player finishes faster than 5 minutes or slower than 30.
