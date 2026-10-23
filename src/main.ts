import Phaser from 'phaser';
import { HEIGHT, VillageScene, WIDTH } from './scenes/VillageScene';

new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game',
  width: WIDTH,
  height: HEIGHT,
  backgroundColor: '#f6e7c1',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 2 },
  scene: [VillageScene],
});

if ('serviceWorker' in navigator && import.meta.env.PROD && location.protocol === 'https:') {
  navigator.serviceWorker.register('./sw.js').catch(() => {
    // Offline play is a bonus; the game works without it.
  });
}
