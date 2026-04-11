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
    noAudio: true, // no audio assets – keep it clean
  },
};

new Phaser.Game(config);
