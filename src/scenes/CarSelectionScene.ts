import Phaser from "phaser";
import { createCarTexture, CarType } from "../graphics/CarSprites";

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

// Slot geometry is computed in create() from actual canvas dimensions.

export class CarSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private cards: Phaser.GameObjects.Rectangle[] = [];
  private nameText!:    Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;

  constructor() { super({ key: "CarSelectionScene" }); }

  create(): void {
    const { width: W, height: H } = this.scale;
    const cx = W / 2;

    // Slot geometry scaled to current canvas dimensions
    const slotY = Math.round(H * 0.38);
    const cardW = Math.round(W * 0.265);
    const cardH = Math.round(H * 0.185);
    const slotX = [
      Math.round(W * 0.2),
      Math.round(W * 0.5),
      Math.round(W * 0.8),
    ];
    const infoY    = Math.round(H * 0.60);
    const raceY    = Math.round(H * 0.75);
    const backY    = Math.round(H * 0.87);

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, H, 0x0a0a0a).setOrigin(0, 0);
    for (let i = 0; i < 8; i++) {
      this.add.rectangle(cx - 4, 80 + i * 80, 8, 50, 0x1c1c1c);
    }

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 55, "SELECT YOUR CAR", {
      fontSize: "44px", fontFamily: "monospace",
      color: "#ff4400", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, 102, "← →  BROWSE     ENTER  RACE", {
      fontSize: "13px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // ── Car cards ─────────────────────────────────────────────────────────
    CARS.forEach((car, i) => {
      const x = slotX[i];

      const card = this.add.rectangle(x, slotY, cardW, cardH, 0x111111)
        .setStrokeStyle(2, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.cards.push(card);

      const key = createCarTexture(this, car.type);
      this.add.image(x, slotY - 12, key).setScale(1.1);

      this.add.text(x, slotY + Math.round(cardH * 0.38), `0${i + 1}`, {
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
    const arrowLeft = this.add.text(Math.round(W * 0.04), slotY, "◄", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    const arrowRight = this.add.text(Math.round(W * 0.96), slotY, "►", {
      fontSize: "28px", fontFamily: "monospace", color: "#ff4400",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });

    arrowLeft.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + CARS.length - 1) % CARS.length));
    arrowRight.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + 1) % CARS.length));

    // ── Info panel ────────────────────────────────────────────────────────
    this.add.rectangle(cx, infoY, Math.round(W * 0.9), 56, 0x111111).setStrokeStyle(1, 0x2a2a2a);
    this.nameText = this.add.text(cx, infoY - 12, "", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.taglineText = this.add.text(cx, infoY + 14, "", {
      fontSize: "14px", fontFamily: "monospace", color: "#777777",
    }).setOrigin(0.5);

    // ── Race button ───────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, raceY, 240, 54, 0xff4400)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, raceY, "RACE!", {
      fontSize: "28px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
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
    const backText = this.add.text(cx, backY, "← BACK TO MENU", {
      fontSize: "13px", fontFamily: "monospace", color: "#444444",
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
