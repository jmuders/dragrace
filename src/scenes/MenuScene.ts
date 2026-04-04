import Phaser from "phaser";
import { BEST_TIME_KEY } from "../constants";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    const { width, height } = this.scale;
    const cx = width / 2;

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // Road stripe decoration
    for (let i = 0; i < 8; i++) {
      this.add.rectangle(cx - 4, 80 + i * 80, 8, 50, 0x444444);
    }

    // ── Title ────────────────────────────────────────────────────────────
    this.add.text(cx, 100, "DRAG RACE", {
      fontSize: "72px",
      fontFamily: "monospace",
      color: "#ff4400",
      stroke: "#000",
      strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, 170, "QUARTER MILE", {
      fontSize: "24px",
      fontFamily: "monospace",
      color: "#ffaa00",
    }).setOrigin(0.5);

    // ── Controls reference ────────────────────────────────────────────────
    const controlLines = [
      "CONTROLS",
      "",
      "SPACE / W  –  hold throttle",
      "S          –  shift up",
      "N          –  nitrous",
      "",
      "Rev to the launch window,",
      "then nail it on green!",
    ];

    controlLines.forEach((line, i) => {
      this.add.text(cx, 250 + i * 30, line, {
        fontSize: line === "CONTROLS" ? "20px" : "16px",
        fontFamily: "monospace",
        color: line === "CONTROLS" ? "#ffdd00" : "#cccccc",
      }).setOrigin(0.5);
    });

    // ── Best time ─────────────────────────────────────────────────────────
    const stored = localStorage.getItem(BEST_TIME_KEY);
    const bestText = stored
      ? `BEST TIME: ${parseFloat(stored).toFixed(3)}s`
      : "NO BEST TIME YET";

    this.add.text(cx, height - 130, bestText, {
      fontSize: "20px",
      fontFamily: "monospace",
      color: stored ? "#00ff88" : "#666666",
    }).setOrigin(0.5);

    // ── Start button ──────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, height - 80, 260, 56, 0xff4400)
      .setInteractive({ useHandCursor: true });

    const btnText = this.add.text(cx, height - 80, "START RACE", {
      fontSize: "24px",
      fontFamily: "monospace",
      color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5);

    btnBg.on("pointerover", () => btnBg.setFillStyle(0xff6622));
    btnBg.on("pointerout",  () => btnBg.setFillStyle(0xff4400));
    btnBg.on("pointerdown", () => this.scene.start("RaceScene"));

    // Also allow Enter / Space to start
    this.input.keyboard!.on("keydown-ENTER", () => this.scene.start("RaceScene"));
    this.input.keyboard!.on("keydown-SPACE", () => this.scene.start("RaceScene"));

    // Pulse the button
    this.tweens.add({
      targets: [btnBg, btnText],
      scaleX: 1.04, scaleY: 1.04,
      yoyo: true,
      repeat: -1,
      duration: 700,
      ease: "Sine.easeInOut",
    });
  }
}
