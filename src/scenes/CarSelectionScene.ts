import Phaser from "phaser";
import { createCarTexture, preloadCarTextures, getCarDisplayScale, CarType } from "../graphics/CarSprites";

interface CarOption {
  type: CarType;
  name: string;
  tagline: string;
}

const CARS: CarOption[] = [
  { type: "silver", name: "SILVER SEDAN",  tagline: "Balanced & reliable" },
  { type: "red",    name: "RED COUPE",     tagline: "High-revving powerhouse" },
  { type: "green",  name: "GREEN SUPER",   tagline: "Aerodynamic specialist" },
];

const SLOT_X = [160, 400, 640];
const SLOT_Y = 200;
const CARD_W = 210;
const CARD_H = 110;

export class CarSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private nameText!:    Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;

  constructor() { super({ key: "CarSelectionScene" }); }

  preload(): void {
    preloadCarTextures(this);
  }

  create(): void {
    const { width: W, height: H } = this.scale;
    const cx = W / 2;

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(cx - 4, 55 + i * 65, 8, 40, 0x1c1c1c);
    }

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 36, "SELECT YOUR CAR", {
      fontSize: "36px", fontFamily: "monospace",
      color: "#ff4400", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, 70, "← →  BROWSE     ENTER  RACE", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // ── Car cards ─────────────────────────────────────────────────────────
    CARS.forEach((car, i) => {
      const x = SLOT_X[i];

      const card = this.add.rectangle(x, SLOT_Y, CARD_W, CARD_H, 0x111111)
        .setStrokeStyle(2, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.cards.push(card);

      const key = createCarTexture(this, car.type);
      const scale = getCarDisplayScale(this, key, 190);
      this.add.image(x, SLOT_Y - 12, key).setScale(scale);

      this.add.text(x, SLOT_Y + 50, `0${i + 1}`, {
        fontSize: "11px", fontFamily: "monospace", color: "#333333",
      }).setOrigin(0.5);

      card.on("pointerdown", () => this.selectCar(i));
      card.on("pointerover", () => {
        if (this.selectedIndex !== i) card.setFillStyle(0x181818);
      });
      card.on("pointerout", () => {
        if (this.selectedIndex !== i) card.setFillStyle(0x111111);
      });
    });

    // ── Nav arrows ────────────────────────────────────────────────────────
    const arrowLeft = this.add.text(SLOT_X[0] - 110, SLOT_Y, "◄", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const arrowRight = this.add.text(SLOT_X[2] + 110, SLOT_Y, "►", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    arrowLeft.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + CARS.length - 1) % CARS.length));
    arrowRight.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + 1) % CARS.length));

    // ── Info panel ────────────────────────────────────────────────────────
    this.add.rectangle(cx, 310, 500, 48, 0x111111).setStrokeStyle(1, 0x2a2a2a);
    this.nameText = this.add.text(cx, 299, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.taglineText = this.add.text(cx, 322, "", {
      fontSize: "13px", fontFamily: "monospace", color: "#777777",
    }).setOrigin(0.5);

    // ── Race button ───────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, 382, 220, 46, 0xff4400)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, 382, "RACE!", {
      fontSize: "24px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    btnBg.on("pointerover", () => btnBg.setFillStyle(0xff6622));
    btnBg.on("pointerout",  () => btnBg.setFillStyle(0xff4400));
    btnBg.on("pointerdown", () => this.startRace());

    this.tweens.add({
      targets: [btnBg, btnText],
      scaleX: 1.04, scaleY: 1.04,
      yoyo: true, repeat: -1, duration: 700, ease: "Sine.easeInOut",
    });

    // ── Back link ─────────────────────────────────────────────────────────
    const backText = this.add.text(cx, 428, "← BACK TO MENU", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backText.on("pointerover", () => backText.setColor("#888888"));
    backText.on("pointerout",  () => backText.setColor("#444444"));
    backText.on("pointerdown", () => this.scene.start("MenuScene"));

    // ── Keyboard ──────────────────────────────────────────────────────────
    const kbd = this.input.keyboard!;
    kbd.on("keydown-LEFT",  () =>
      this.selectCar((this.selectedIndex + CARS.length - 1) % CARS.length));
    kbd.on("keydown-RIGHT", () =>
      this.selectCar((this.selectedIndex + 1) % CARS.length));
    kbd.on("keydown-ENTER", () => this.startRace());
    kbd.on("keydown-ESC",   () => this.scene.start("MenuScene"));

    this.selectCar(0);
  }

  private selectCar(index: number): void {
    this.cards[this.selectedIndex]
      .setFillStyle(0x111111)
      .setStrokeStyle(2, 0x2a2a2a);

    this.selectedIndex = index;

    this.cards[index]
      .setFillStyle(0x1a0800)
      .setStrokeStyle(3, 0xff4400);

    this.nameText.setText(CARS[index].name);
    this.taglineText.setText(CARS[index].tagline);
  }

  private startRace(): void {
    this.scene.start("RaceScene", { carType: CARS[this.selectedIndex].type });
  }
}
