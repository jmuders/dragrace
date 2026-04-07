import Phaser from "phaser";
import { createCarTexture, preloadCarTextures, getCarDisplayScale, CarType } from "../graphics/CarSprites";

interface CarOption {
  type: CarType;
  name: string;
  tagline: string;
}

const CARS: CarOption[] = [
  { type: "silver",        name: "SILVER SEDAN",    tagline: "Balanced & reliable" },
  { type: "red",           name: "RED COUPE",        tagline: "High-revving powerhouse" },
  { type: "green",         name: "GREEN SUPER",      tagline: "Aerodynamic specialist" },
  { type: "orange",        name: "ORANGE SUPER",     tagline: "Raw turbocharged power" },
  { type: "blue_cobra",    name: "BLUE COBRA",       tagline: "Classic American roadster" },
  { type: "black_hyper",   name: "BLACK HYPER",      tagline: "Bugatti-style top speed" },
  { type: "gray_roadster", name: "GRAY ROADSTER",    tagline: "Open-air precision drive" },
  { type: "dark_hyper",    name: "DARK HYPER",       tagline: "Koenigsegg-level fury" },
  { type: "red_f40",       name: "RED F40",          tagline: "Legendary Ferrari icon" },
  { type: "orange_supra",  name: "ORANGE SUPRA",     tagline: "JDM tuner's dream" },
  { type: "white_proto",   name: "WHITE PROTO",      tagline: "Track-bred prototype" },
  { type: "red_roadster",  name: "RED ROADSTER",     tagline: "Italian open-top style" },
  { type: "yellow_lotus",  name: "YELLOW LOTUS",     tagline: "Lightweight corner king" },
  { type: "orange_mclaren",name: "ORANGE McLAREN",   tagline: "F1-bred street machine" },
  { type: "red_rx7",       name: "RED RX-7",         tagline: "Rotary-powered legend" },
  { type: "blue_viper",    name: "BLUE VIPER",       tagline: "American muscle serpent" },
  { type: "lime_super",    name: "LIME SUPER",       tagline: "Lamborghini attack mode" },
  { type: "red_hyper",     name: "RED HYPER",        tagline: "LaFerrari hybrid beast" },
  { type: "blue_gt40",     name: "BLUE GT40",        tagline: "Le Mans classic racer" },
  { type: "blue_porsche",  name: "BLUE PORSCHE",     tagline: "Precision German sport" },
  { type: "yellow_muscle", name: "YELLOW MUSCLE",    tagline: "Camaro V8 bruiser" },
];

const SLOT_X   = [160, 400, 640];
const SLOT_Y   = 210;
const CARD_W   = 210;
const CARD_H   = 120;
const VISIBLE  = 3; // cards shown at once

export class CarSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private viewOffset    = 0; // index of leftmost visible car

  // Slot display objects (reused, textures swapped on scroll)
  private slotCards:   Phaser.GameObjects.Rectangle[]  = [];
  private slotImages:  Phaser.GameObjects.Image[]       = [];
  private slotNumbers: Phaser.GameObjects.Text[]        = [];

  private nameText!:    Phaser.GameObjects.Text;
  private taglineText!: Phaser.GameObjects.Text;
  private counterText!: Phaser.GameObjects.Text;

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

    // ── Car slots ─────────────────────────────────────────────────────────
    for (let slot = 0; slot < VISIBLE; slot++) {
      const x = SLOT_X[slot];

      const card = this.add.rectangle(x, SLOT_Y, CARD_W, CARD_H, 0x111111)
        .setStrokeStyle(2, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.slotCards.push(card);

      // Placeholder image — texture set in refreshSlots()
      const img = this.add.image(x, SLOT_Y - 15, "__DEFAULT");
      this.slotImages.push(img);

      const numText = this.add.text(x, SLOT_Y + 52, "", {
        fontSize: "11px", fontFamily: "monospace", color: "#333333",
      }).setOrigin(0.5);
      this.slotNumbers.push(numText);

      card.on("pointerdown", () => {
        const carIdx = (this.viewOffset + slot) % CARS.length;
        this.selectCar(carIdx);
      });
      card.on("pointerover", () => {
        const carIdx = (this.viewOffset + slot) % CARS.length;
        if (this.selectedIndex !== carIdx) card.setFillStyle(0x181818);
      });
      card.on("pointerout", () => {
        const carIdx = (this.viewOffset + slot) % CARS.length;
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
      this.selectCar((this.selectedIndex + CARS.length - 1) % CARS.length));
    arrowRight.on("pointerdown", () =>
      this.selectCar((this.selectedIndex + 1) % CARS.length));

    // ── Info panel ────────────────────────────────────────────────────────
    this.add.rectangle(cx, 330, 500, 48, 0x111111).setStrokeStyle(1, 0x2a2a2a);
    this.nameText = this.add.text(cx, 319, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.taglineText = this.add.text(cx, 342, "", {
      fontSize: "13px", fontFamily: "monospace", color: "#777777",
    }).setOrigin(0.5);

    // ── Car counter ───────────────────────────────────────────────────────
    this.counterText = this.add.text(cx, 363, "", {
      fontSize: "11px", fontFamily: "monospace", color: "#333333",
    }).setOrigin(0.5);

    // ── Race button ───────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, 400, 220, 46, 0xff4400)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, 400, "RACE!", {
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
    const backText = this.add.text(cx, 446, "← BACK TO MENU", {
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

  /** Update the 3 visible slots to match the current viewOffset. */
  private refreshSlots(): void {
    for (let slot = 0; slot < VISIBLE; slot++) {
      const carIdx = (this.viewOffset + slot) % CARS.length;
      const car    = CARS[carIdx];

      this.slotCards[slot].setVisible(true);
      this.slotImages[slot].setVisible(true);
      this.slotNumbers[slot].setVisible(true);

      const key   = createCarTexture(this, car.type);
      const scale = getCarDisplayScale(this, key, 190);
      this.slotImages[slot].setTexture(key).setScale(scale);

      this.slotNumbers[slot].setText(String(carIdx + 1).padStart(2, "0"));

      // Highlight selected vs. unselected
      if (carIdx === this.selectedIndex) {
        this.slotCards[slot].setFillStyle(0x1a0800).setStrokeStyle(3, 0xff4400);
      } else {
        this.slotCards[slot].setFillStyle(0x111111).setStrokeStyle(2, 0x2a2a2a);
      }
    }
  }

  private selectCar(index: number): void {
    this.selectedIndex = index;

    // Keep selected car in the center slot, with wrap-around
    this.viewOffset = (index - 1 + CARS.length) % CARS.length;

    this.refreshSlots();

    const car = CARS[index];
    this.nameText.setText(car.name);
    this.taglineText.setText(car.tagline);
    this.counterText.setText(`${index + 1} / ${CARS.length}`);
  }

  private startRace(): void {
    this.scene.start("RaceScene", { carType: CARS[this.selectedIndex].type });
  }
}
