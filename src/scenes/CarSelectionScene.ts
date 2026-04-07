import Phaser from "phaser";
import { createCarTexture, preloadCarTextures, getCarDisplayScale, CarType } from "../graphics/CarSprites";

interface CarOption {
  type: CarType;
  name: string;
  tagline: string;
}

const CARS: CarOption[] = [
  { type: "silver",        name: "SILBER DREIER",    tagline: "The Bavarian sport sedan" },
  { type: "red",           name: "SCARLET ACHT",     tagline: "Mid-engine Germanic fury" },
  { type: "green",         name: "VERDE GALLETTO",   tagline: "Baby bull with a big bite" },
  { type: "orange",        name: "AMBER EXTREMA",    tagline: "Track weapon, zero compromise" },
  { type: "blue_cobra",    name: "AZURE MAMBA",      tagline: "Classic American serpent" },
  { type: "black_hyper",   name: "PHANTOM SEIZE",    tagline: "W16 French hypermachine" },
  { type: "gray_roadster", name: "PEWTER SPYDER",    tagline: "Open-air Stuttgart precision" },
  { type: "dark_hyper",    name: "NORDIC WRAITH",    tagline: "Scandinavian speed phantom" },
  { type: "red_f40",       name: "ROSSO QUARANTA",   tagline: "Twin-turbo Italian legend" },
  { type: "orange_supra",  name: "TANGERINE SHOGUN", tagline: "Inline-six JDM warrior" },
  { type: "white_proto",   name: "IVORY VALKYRE",    tagline: "Aero-sculpted track demon" },
  { type: "red_roadster",  name: "CRIMSON BARCHETTA",tagline: "Italian open-top elegance" },
  { type: "yellow_lotus",  name: "CITRINE ELARA",    tagline: "Featherweight corner scalpel" },
  { type: "orange_mclaren",name: "COPPER APEX ONE",  tagline: "F1-derived speed icon" },
  { type: "red_rx7",       name: "CRIMSON HELIX 7",  tagline: "Rotary-spinning JDM icon" },
  { type: "blue_viper",    name: "COBALT ANACONDA",  tagline: "V10 American predator" },
  { type: "lime_super",    name: "ACID TORO",        tagline: "Raging V12 Italian bull" },
  { type: "red_hyper",     name: "ROSSO CAVALLO HY", tagline: "Hybrid prancing horse" },
  { type: "blue_gt40",     name: "INDIGO APEX 40",   tagline: "Le Mans endurance legend" },
  { type: "blue_porsche",  name: "COBALT BOXER GT",  tagline: "Flat-six Stuttgart hypercar" },
  { type: "yellow_muscle", name: "SOLAR PONY",       tagline: "American V8 pony car" },
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
        const carIdx = this.viewOffset + slot;
        if (carIdx < CARS.length) this.selectCar(carIdx);
      });
      card.on("pointerover", () => {
        const carIdx = this.viewOffset + slot;
        if (this.selectedIndex !== carIdx) card.setFillStyle(0x181818);
      });
      card.on("pointerout", () => {
        const carIdx = this.viewOffset + slot;
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
      const carIdx = this.viewOffset + slot;
      const car    = CARS[carIdx];

      if (!car) {
        // Hide slot if out of range (shouldn't happen with wrap-around)
        this.slotCards[slot].setVisible(false);
        this.slotImages[slot].setVisible(false);
        this.slotNumbers[slot].setVisible(false);
        continue;
      }

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

    // Scroll view so selected car is always visible
    if (index < this.viewOffset) {
      this.viewOffset = index;
    } else if (index >= this.viewOffset + VISIBLE) {
      this.viewOffset = index - VISIBLE + 1;
    }

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
