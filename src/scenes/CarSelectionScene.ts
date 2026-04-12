import Phaser from "phaser";
import { createCarTexture, preloadCarTextures, getCarDisplayScale } from "../graphics/CarSprites";
import { CAR_DATA } from "../data/CarData";
import { CarStats } from "../types";
import { MusicManager } from "../audio/MusicManager";

// ─── Layout constants ─────────────────────────────────────────────────────────

const SLOT_X   = [160, 400, 640];
const SLOT_Y   = 195;
const CARD_W   = 210;
const CARD_H   = 110;
const VISIBLE  = 3;

// Stat bar layout (5 groups in a single row, centred @ 800px canvas width)
const STAT_NAMES     = ["PWR", "WGT", "GRP", "SHF", "AER"] as const;
const STAT_BLOCK_W   = 12;
const STAT_BLOCK_H   =  8;
const STAT_BLOCK_GAP =  2;
const STAT_LABEL_W   = 25;   // reserved width for the 3-char label text
const STAT_LABEL_GAP =  4;   // gap between label and first block
const STAT_BLOCKS_W  = 5 * STAT_BLOCK_W + 4 * STAT_BLOCK_GAP;   // 68px
const STAT_GROUP_W   = STAT_LABEL_W + STAT_LABEL_GAP + STAT_BLOCKS_W; // 97px
const STAT_GROUP_GAP = 13;
const STAT_TOTAL_W   = 5 * STAT_GROUP_W + 4 * STAT_GROUP_GAP;   // ~537px
const STAT_START_X   = Math.round((800 - STAT_TOTAL_W) / 2);
const STAT_BAR_Y     = 364;  // top edge of the bar blocks

/** Colours for filled blocks (index = stat value - 1) */
const STAT_COLORS = [0xe03300, 0xff7700, 0xffcc00, 0x88ee00, 0x00cc55] as const;
const STAT_EMPTY  = 0x2a2a2a;

// ─── Scene ───────────────────────────────────────────────────────────────────

export class CarSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private viewOffset    = 0;

  private slotCards:   Phaser.GameObjects.Rectangle[] = [];
  private slotImages:  Phaser.GameObjects.Image[]      = [];
  private slotNumbers: Phaser.GameObjects.Text[]       = [];

  private nameText!:    Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;
  private statsGfx!:    Phaser.GameObjects.Graphics;

  constructor() { super({ key: "CarSelectionScene" }); }

  preload(): void { preloadCarTextures(this); }

  create(): void {
    // Restore previously selected car from registry
    const savedType = this.game.registry.get("carType") as string | undefined;
    if (savedType) {
      const idx = CAR_DATA.findIndex(c => c.type === savedType);
      if (idx >= 0) this.selectedIndex = idx;
    }

    this.slotCards   = [];
    this.slotImages  = [];
    this.slotNumbers = [];

    const W = 800, H = 450, cx = W / 2;

    // ── Music ─────────────────────────────────────────────────────────────
    MusicManager.get().start(0.55);
    this.input.on("pointerdown", () => MusicManager.get().handleUserGesture());

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(cx - 4, 55 + i * 60, 8, 36, 0x1c1c1c);
    }

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 34, "SELECT YOUR CAR", {
      fontSize: "36px", fontFamily: "monospace",
      color: "#ff4400", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, 68, "← →  BROWSE     ENTER  CONFIRM", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // ── Car slots ─────────────────────────────────────────────────────────
    for (let slot = 0; slot < VISIBLE; slot++) {
      const x = SLOT_X[slot];

      const card = this.add.rectangle(x, SLOT_Y, CARD_W, CARD_H, 0x111111)
        .setStrokeStyle(2, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.slotCards.push(card);

      const img = this.add.image(x, SLOT_Y - 12, "__DEFAULT");
      this.slotImages.push(img);

      const numText = this.add.text(x, SLOT_Y + 46, "", {
        fontSize: "11px", fontFamily: "monospace", color: "#333333",
      }).setOrigin(0.5);
      this.slotNumbers.push(numText);

      card.on("pointerdown", () => {
        const carIdx = (this.viewOffset + slot) % CAR_DATA.length;
        this.selectCar(carIdx);
      });
      card.on("pointerover", () => {
        const carIdx = (this.viewOffset + slot) % CAR_DATA.length;
        if (this.selectedIndex !== carIdx) card.setFillStyle(0x181818);
      });
      card.on("pointerout", () => {
        const carIdx = (this.viewOffset + slot) % CAR_DATA.length;
        if (this.selectedIndex !== carIdx) card.setFillStyle(0x111111);
      });
    }

    // ── Nav arrows ────────────────────────────────────────────────────────
    const arrowLeft = this.add.text(SLOT_X[0] - 110, SLOT_Y, "◄", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const arrowRight = this.add.text(SLOT_X[2] + 110, SLOT_Y, "►", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    arrowLeft.on("pointerdown",  () =>
      this.selectCar((this.selectedIndex + CAR_DATA.length - 1) % CAR_DATA.length));
    arrowRight.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + 1) % CAR_DATA.length));

    // ── Info panel ────────────────────────────────────────────────────────
    this.add.rectangle(cx, 306, 500, 42, 0x111111).setStrokeStyle(1, 0x2a2a2a);
    this.nameText = this.add.text(cx, 297, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.taglineText = this.add.text(cx, 317, "", {
      fontSize: "13px", fontFamily: "monospace", color: "#777777",
    }).setOrigin(0.5);
    this.counterText = this.add.text(cx, 334, "", {
      fontSize: "11px", fontFamily: "monospace", color: "#333333",
    }).setOrigin(0.5);

    // ── Specs section ─────────────────────────────────────────────────────
    this.add.rectangle(cx, 345, 500, 1, 0x2a2a2a);
    this.add.text(cx, 353, "SPECS", {
      fontSize: "10px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // Static stat labels (created once, stay in place)
    for (let i = 0; i < STAT_NAMES.length; i++) {
      const gx = STAT_START_X + i * (STAT_GROUP_W + STAT_GROUP_GAP);
      this.add.text(gx + STAT_LABEL_W, STAT_BAR_Y + Math.round(STAT_BLOCK_H / 2), STAT_NAMES[i], {
        fontSize: "10px", fontFamily: "monospace", color: "#555555",
      }).setOrigin(1, 0.5);
    }

    // Graphics object that will be cleared + redrawn on every car change
    this.statsGfx = this.add.graphics();

    // ── Confirm button ────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, 405, 240, 40, 0x226644)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, 405, "CONFIRM CAR  ►", {
      fontSize: "18px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    btnBg.on("pointerover", () => btnBg.setFillStyle(0x2d8855));
    btnBg.on("pointerout",  () => btnBg.setFillStyle(0x226644));
    btnBg.on("pointerdown", () => this.confirmCar());

    this.tweens.add({
      targets: [btnBg, btnText],
      scaleX: 1.04, scaleY: 1.04,
      yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut",
    });

    // ── Back link ─────────────────────────────────────────────────────────
    const backText = this.add.text(cx, 437, "← BACK TO MENU (no change)", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backText.on("pointerover", () => backText.setColor("#888888"));
    backText.on("pointerout",  () => backText.setColor("#444444"));
    backText.on("pointerdown", () => this.scene.start("MenuScene"));

    // ── Keyboard ──────────────────────────────────────────────────────────
    const kbd = this.input.keyboard!;
    kbd.on("keydown-LEFT",  () =>
      this.selectCar((this.selectedIndex + CAR_DATA.length - 1) % CAR_DATA.length));
    kbd.on("keydown-RIGHT", () =>
      this.selectCar((this.selectedIndex + 1) % CAR_DATA.length));
    kbd.on("keydown-ENTER", () => this.confirmCar());
    kbd.on("keydown-ESC",   () => this.scene.start("MenuScene"));

    this.selectCar(this.selectedIndex);
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  private refreshSlots(): void {
    for (let slot = 0; slot < VISIBLE; slot++) {
      const carIdx = (this.viewOffset + slot) % CAR_DATA.length;
      const car    = CAR_DATA[carIdx];

      this.slotCards[slot].setVisible(true);
      this.slotImages[slot].setVisible(true);
      this.slotNumbers[slot].setVisible(true);

      const key   = createCarTexture(this, car.type);
      const scale = getCarDisplayScale(this, key, 190);
      this.slotImages[slot].setTexture(key).setScale(scale);

      this.slotNumbers[slot].setText(String(carIdx + 1).padStart(2, "0"));

      if (carIdx === this.selectedIndex) {
        this.slotCards[slot].setFillStyle(0x1a0800).setStrokeStyle(3, 0xff4400);
      } else {
        this.slotCards[slot].setFillStyle(0x111111).setStrokeStyle(2, 0x2a2a2a);
      }
    }
  }

  private selectCar(index: number): void {
    this.selectedIndex = index;
    this.viewOffset    = (index - 1 + CAR_DATA.length) % CAR_DATA.length;
    this.refreshSlots();

    const car = CAR_DATA[index];
    this.nameText.setText(car.name);
    this.taglineText.setText(car.tagline);
    this.counterText.setText(`${index + 1} / ${CAR_DATA.length}`);
    this.drawStats(car.stats);
  }

  /** Redraws the 5×5 stat bars for the currently selected car. */
  private drawStats(stats: CarStats): void {
    this.statsGfx.clear();

    const vals = [stats.power, stats.weight, stats.grip, stats.shift, stats.aero];

    for (let i = 0; i < 5; i++) {
      const val    = vals[i];
      const gx     = STAT_START_X + i * (STAT_GROUP_W + STAT_GROUP_GAP);
      const barsX  = gx + STAT_LABEL_W + STAT_LABEL_GAP;
      const color  = STAT_COLORS[val - 1];

      for (let b = 0; b < 5; b++) {
        const bx = barsX + b * (STAT_BLOCK_W + STAT_BLOCK_GAP);
        this.statsGfx.fillStyle(b < val ? color : STAT_EMPTY, 1);
        this.statsGfx.fillRect(bx, STAT_BAR_Y, STAT_BLOCK_W, STAT_BLOCK_H);
      }
    }
  }

  private confirmCar(): void {
    const car = CAR_DATA[this.selectedIndex];
    this.game.registry.set("carType", car.type);
    this.game.registry.set("carName", car.name);
    this.scene.start("MenuScene");
  }
}

