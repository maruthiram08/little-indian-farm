# Little Village Story

A small, relaxed farming game set in an Indian village. Grow wheat, marigold and
sugarcane, press sugarcane into jaggery at the kolhu, fill orders for the villagers
at the haat, and clear more land until the village lights up for Diwali.

This is phase one: a weekend-sized, mobile-first browser game. It saves progress on
the device and can be added to a phone's home screen.

## Play

Every push to `main` is tested and published to GitHub Pages:
https://maruthiram08.github.io/little-indian-farm/

## Develop

```bash
npm install
npm run dev      # local server; open the printed address on your phone (same Wi-Fi)
npm test         # economy tests, including a bot that plays to the final level
npm run build    # production build in dist/
```

## Where things live

| Path | What it holds |
| --- | --- |
| `src/game/data.ts` | All tunable content: crops, prices, timers, levels, villagers |
| `src/game/sim.ts` | Game rules with no rendering, driven by timestamps so crops grow while the game is closed |
| `src/game/save.ts` | Saving to the browser's localStorage |
| `src/scenes/VillageScene.ts` | The Phaser screen: fields, haat orders, kolhu, seeds, store room |
| `tests/sim.test.ts` | Tests for the rules and pacing |
| `public/` | Home-screen manifest, icon and offline service worker |

Balancing the game means editing `src/game/data.ts` and running `npm test`; the pacing
test fails if a perfect player finishes faster than 5 minutes or slower than 30.
