import Phaser from "phaser";
import { MenuScene } from "./scenes/MenuScene";
import { CarSelectionScene } from "./scenes/CarSelectionScene";
import { DifficultyScene } from "./scenes/DifficultyScene";
import { RaceScene } from "./scenes/RaceScene";
import { ResultsScene } from "./scenes/ResultsScene";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 800,
  height: 450,
  backgroundColor: "#0a0a0a",
  pixelArt: true,
  scene: [MenuScene, CarSelectionScene, DifficultyScene, RaceScene, ResultsScene],
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 800,
    height: 450,
    expandParent: false,
  },
  input: {
    activePointers: 3, // support throttle + shift + nitro simultaneously
  },
  audio: {
    disableWebAudio: true, // Phaser audio unused; we use Web Audio API directly via MusicManager
  },
};

const game = new Phaser.Game(config);

// iOS Safari: recalculate canvas bounds when viewport shifts (address bar show/hide)
window.addEventListener('resize', () => game.scale.refresh(), { passive: true });
// Trigger one refresh on first touch in case bounds are stale at game load
document.addEventListener('touchstart', () => game.scale.refresh(), { passive: true, once: true });
