import Phaser from "phaser";
import { createCarTexture, preloadCarTextures, getCarDisplayScale, CarType } from "../graphics/CarSprites";
import { DIFFICULTIES, DEFAULT_DIFFICULTY_INDEX } from "../constants";

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
const SLOT_Y   = 200;
const CARD_W   = 210;
const CARD_H   = 118;
const VISIBLE  = 3; // cards shown at once

// Difficulty button layout (4 buttons, centred in 800 px canvas)
const DIFF_BTN_W  = 154;
const DIFF_BTN_H  = 26;
const DIFF_BTN_GAP = 10;
const DIFF_TOTAL_W = 4 * DIFF_BTN_W + 3 * DIFF_BTN_GAP; // 646
const DIFF_START_X = (800 - DIFF_TOTAL_W) / 2;            // 77
const DIFF_BTN_Y   = 378;

export class CarSelectionScene extends Phaser.Scene {
  private selectedIndex = 0;
  private viewOffset    = 0;

  private selectedDifficultyIndex = DEFAULT_DIFFICULTY_INDEX;

  // Slot display objects (reused, textures swapped on scroll)
  private slotCards:   Phaser.GameObjects.Rectangle[]  = [];
  private slotImages:  Phaser.GameObjects.Image[]       = [];
  private slotNumbers: Phaser.GameObjects.Text[]        = [];

  private nameText!:        Phaser.GameObjects.Text;
  private taglineText!:     Phaser.GameObjects.Text;
  private counterText!:     Phaser.GameObjects.Text;
  private diffDescText!:    Phaser.GameObjects.Text;
  private diffBtnBgs:       Phaser.GameObjects.Rectangle[] = [];
  private diffBtnLabels:    Phaser.GameObjects.Text[]      = [];

  constructor() { super({ key: "CarSelectionScene" }); }

  preload(): void {
    preloadCarTextures(this);
  }

  create(): void {
    this.slotCards        = [];
    this.slotImages       = [];
    this.slotNumbers      = [];
    this.diffBtnBgs       = [];
    this.diffBtnLabels    = [];
    this.selectedDifficultyIndex = DEFAULT_DIFFICULTY_INDEX;

    const { width: W, height: H } = this.scale;
    const cx = W / 2;

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

    this.add.text(cx, 68, "← →  BROWSE     ENTER  RACE", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // ── Car slots ─────────────────────────────────────────────────────────
    for (let slot = 0; slot < VISIBLE; slot++) {
      const x = SLOT_X[slot];

      const card = this.add.rectangle(x, SLOT_Y, CARD_W, CARD_H, 0x111111)
        .setStrokeStyle(2, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.slotCards.push(card);

      const img = this.add.image(x, SLOT_Y - 14, "__DEFAULT");
      this.slotImages.push(img);

      const numText = this.add.text(x, SLOT_Y + 50, "", {
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

    // ── Info panel (car name / tagline) ───────────────────────────────────
    this.add.rectangle(cx, 315, 500, 44, 0x111111).setStrokeStyle(1, 0x2a2a2a);
    this.nameText = this.add.text(cx, 305, "", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);
    this.taglineText = this.add.text(cx, 326, "", {
      fontSize: "13px", fontFamily: "monospace", color: "#777777",
    }).setOrigin(0.5);

    // ── Car counter ───────────────────────────────────────────────────────
    this.counterText = this.add.text(cx, 345, "", {
      fontSize: "11px", fontFamily: "monospace", color: "#333333",
    }).setOrigin(0.5);

    // ── Difficulty selector ───────────────────────────────────────────────
    this.add.text(cx, 360, "DIFFICULTY", {
      fontSize: "11px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0.5);

    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const cfg  = DIFFICULTIES[i];
      const btnX = DIFF_START_X + i * (DIFF_BTN_W + DIFF_BTN_GAP) + DIFF_BTN_W / 2;

      const bg = this.add.rectangle(btnX, DIFF_BTN_Y, DIFF_BTN_W, DIFF_BTN_H, 0x111111)
        .setStrokeStyle(2, 0x333333)
        .setInteractive({ useHandCursor: true });
      this.diffBtnBgs.push(bg);

      const label = this.add.text(btnX, DIFF_BTN_Y, cfg.label, {
        fontSize: "13px", fontFamily: "monospace",
        color: "#555555", fontStyle: "bold",
      }).setOrigin(0.5);
      this.diffBtnLabels.push(label);

      bg.on("pointerdown", () => this.selectDifficulty(i));
      bg.on("pointerover", () => {
        if (i !== this.selectedDifficultyIndex) bg.setFillStyle(0x1a1a1a);
      });
      bg.on("pointerout", () => {
        if (i !== this.selectedDifficultyIndex) bg.setFillStyle(0x111111);
      });
    }

    this.diffDescText = this.add.text(cx, 398, "", {
      fontSize: "11px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0.5);

    // Apply initial difficulty highlight
    this.selectDifficulty(this.selectedDifficultyIndex);

    // ── Race button ───────────────────────────────────────────────────────
    const btnBg = this.add.rectangle(cx, 422, 220, 40, 0xff4400)
      .setInteractive({ useHandCursor: true });
    const btnText = this.add.text(cx, 422, "RACE!", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
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
    const backText = this.add.text(cx, 443, "← BACK TO MENU", {
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

  private selectDifficulty(index: number): void {
    this.selectedDifficultyIndex = index;

    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const cfg   = DIFFICULTIES[i];
      const isSelected = i === index;

      this.diffBtnBgs[i]
        .setFillStyle(isSelected ? cfg.color : 0x111111)
        .setStrokeStyle(2, isSelected ? cfg.color : 0x333333);

      this.diffBtnLabels[i].setColor(isSelected ? "#000000" : cfg.colorStr);
    }

    this.diffDescText.setText(DIFFICULTIES[index].description);
  }

  private startRace(): void {
    this.scene.start("RaceScene", {
      carType:    CARS[this.selectedIndex].type,
      difficulty: DIFFICULTIES[this.selectedDifficultyIndex].key,
    });
  }
}
