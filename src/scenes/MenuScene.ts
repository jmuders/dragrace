import Phaser from "phaser";
import { BEST_TIME_KEY, DIFFICULTIES, DEFAULT_DIFFICULTY_INDEX } from "../constants";

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: "MenuScene" });
  }

  create(): void {
    // ── Initialise registry defaults on first visit ───────────────────────
    if (!this.game.registry.get("carType")) {
      this.game.registry.set("carType", "silver");
      this.game.registry.set("carName", "SILBER DREIER");
    }
    if (!this.game.registry.get("difficulty")) {
      this.game.registry.set("difficulty", DIFFICULTIES[DEFAULT_DIFFICULTY_INDEX].key);
    }

    const carName  = (this.game.registry.get("carName")    as string | undefined) ?? "SILBER DREIER";
    const diffKey  = (this.game.registry.get("difficulty") as string | undefined) ?? DIFFICULTIES[DEFAULT_DIFFICULTY_INDEX].key;
    const diffCfg  = DIFFICULTIES.find(d => d.key === diffKey) ?? DIFFICULTIES[DEFAULT_DIFFICULTY_INDEX];

    const { width: W, height: H } = this.scale;
    const cx = W / 2;

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(cx - 4, 55 + i * 65, 8, 40, 0x444444);
    }

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 60, "DRAG RACE", {
      fontSize: "60px", fontFamily: "monospace",
      color: "#ff4400", stroke: "#000", strokeThickness: 6,
    }).setOrigin(0.5);

    this.add.text(cx, 112, "QUARTER MILE", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffaa00",
    }).setOrigin(0.5);

    // ── Current selection badge ───────────────────────────────────────────
    this.add.rectangle(cx, 154, 560, 34, 0x111111).setStrokeStyle(1, 0x2a2a2a);

    // Car side
    this.add.text(cx - 266, 154, "CAR:", {
      fontSize: "11px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0, 0.5);
    this.add.text(cx - 236, 154, carName, {
      fontSize: "13px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0, 0.5);

    // Divider
    this.add.rectangle(cx + 42, 154, 1, 20, 0x333333);

    // Difficulty side
    this.add.text(cx + 52, 154, "DIFFICULTY:", {
      fontSize: "11px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0, 0.5);
    this.add.text(cx + 160, 154, diffCfg.label, {
      fontSize: "13px", fontFamily: "monospace",
      color: diffCfg.colorStr, fontStyle: "bold",
    }).setOrigin(0, 0.5);

    // ── Navigation buttons ────────────────────────────────────────────────
    const BTN_W = 270;
    const BTN_H = 44;

    // SELECT CAR
    const carBtnBg = this.add.rectangle(cx, 218, BTN_W, BTN_H, 0x1a1a1a)
      .setStrokeStyle(2, 0x444444).setInteractive({ useHandCursor: true });
    this.add.text(cx, 218, "SELECT CAR  ►", {
      fontSize: "17px", fontFamily: "monospace", color: "#cccccc",
    }).setOrigin(0.5);
    carBtnBg.on("pointerover",  () => carBtnBg.setFillStyle(0x2a2a2a));
    carBtnBg.on("pointerout",   () => carBtnBg.setFillStyle(0x1a1a1a));
    carBtnBg.on("pointerdown",  () => this.scene.start("CarSelectionScene"));

    // SELECT DIFFICULTY
    const diffBtnBg = this.add.rectangle(cx, 274, BTN_W, BTN_H, 0x1a1a1a)
      .setStrokeStyle(2, 0x444444).setInteractive({ useHandCursor: true });
    this.add.text(cx, 274, "SELECT DIFFICULTY  ►", {
      fontSize: "17px", fontFamily: "monospace", color: "#cccccc",
    }).setOrigin(0.5);
    diffBtnBg.on("pointerover",  () => diffBtnBg.setFillStyle(0x2a2a2a));
    diffBtnBg.on("pointerout",   () => diffBtnBg.setFillStyle(0x1a1a1a));
    diffBtnBg.on("pointerdown",  () => this.scene.start("DifficultyScene"));

    // START RACE  (big orange)
    const raceBtnBg = this.add.rectangle(cx, 350, BTN_W, 52, 0xff4400)
      .setInteractive({ useHandCursor: true });
    const raceBtnText = this.add.text(cx, 350, "START RACE  ▶", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    raceBtnBg.on("pointerover",  () => raceBtnBg.setFillStyle(0xff6622));
    raceBtnBg.on("pointerout",   () => raceBtnBg.setFillStyle(0xff4400));
    raceBtnBg.on("pointerdown",  () => this.startRace());

    this.tweens.add({
      targets: [raceBtnBg, raceBtnText],
      scaleX: 1.03, scaleY: 1.03,
      yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut",
    });

    // ── Best time ─────────────────────────────────────────────────────────
    const stored = localStorage.getItem(BEST_TIME_KEY);
    this.add.text(cx, 413, stored
      ? `BEST TIME: ${parseFloat(stored).toFixed(3)}s`
      : "NO BEST TIME YET", {
      fontSize: "14px", fontFamily: "monospace",
      color: stored ? "#00ff88" : "#666666",
    }).setOrigin(0.5);

    // ── Keyboard ──────────────────────────────────────────────────────────
    this.input.keyboard!.on("keydown-ENTER", () => this.startRace());
    this.input.keyboard!.on("keydown-SPACE", () => this.startRace());
  }

  private startRace(): void {
    const carType   = (this.game.registry.get("carType")    as string | undefined) ?? "silver";
    const difficulty = (this.game.registry.get("difficulty") as string | undefined) ?? DIFFICULTIES[DEFAULT_DIFFICULTY_INDEX].key;
    this.scene.start("RaceScene", { carType, difficulty });
  }
}
