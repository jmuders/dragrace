import Phaser from "phaser";
import { DIFFICULTIES, DEFAULT_DIFFICULTY_INDEX } from "../constants";
import { MusicManager } from "../audio/MusicManager";

const CARD_W    = 620;
const CARD_H    = 56;
const CARD_GAP  = 10;
const CARD_Y0   = 105; // top edge of first card

export class DifficultyScene extends Phaser.Scene {
  private cardBgs:    Phaser.GameObjects.Rectangle[] = [];
  private cardLabels: Phaser.GameObjects.Text[]      = [];
  private hoverIndex  = -1;
  private selectedIndex = DEFAULT_DIFFICULTY_INDEX;

  constructor() { super({ key: "DifficultyScene" }); }

  create(): void {
    // Restore current selection from registry
    const saved = this.game.registry.get("difficulty") as string | undefined;
    const savedIdx = DIFFICULTIES.findIndex(d => d.key === saved);
    this.selectedIndex = savedIdx >= 0 ? savedIdx : DEFAULT_DIFFICULTY_INDEX;

    this.cardBgs    = [];
    this.cardLabels = [];

    const { width: W } = this.scale;
    const cx = W / 2;

    // ── Music ─────────────────────────────────────────────────────────────
    MusicManager.get().start(0.55);
    this.input.on("pointerdown", () => MusicManager.get().handleUserGesture());

    // ── Background ────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, W, 450, 0x0a0a0a).setOrigin(0, 0);
    for (let i = 0; i < 5; i++) {
      this.add.rectangle(cx - 4, 55 + i * 65, 8, 40, 0x1c1c1c);
    }

    // ── Title ─────────────────────────────────────────────────────────────
    this.add.text(cx, 34, "SELECT DIFFICULTY", {
      fontSize: "34px", fontFamily: "monospace",
      color: "#ff4400", stroke: "#000", strokeThickness: 5,
    }).setOrigin(0.5);

    this.add.text(cx, 68, "↑↓ navigate   ENTER confirm   ESC back", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5);

    // ── Difficulty cards ──────────────────────────────────────────────────
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const cfg   = DIFFICULTIES[i];
      const cardY = CARD_Y0 + i * (CARD_H + CARD_GAP) + CARD_H / 2;

      // Card background (interactive)
      const bg = this.add.rectangle(cx, cardY, CARD_W, CARD_H, 0x111111)
        .setStrokeStyle(1, 0x2a2a2a)
        .setInteractive({ useHandCursor: true });
      this.cardBgs.push(bg);

      // Left color accent bar (non-interactive, drawn above bg)
      this.add.rectangle(cx - CARD_W / 2 + 3, cardY, 6, CARD_H, cfg.color)
        .setOrigin(0.5, 0.5);

      // Difficulty label
      const label = this.add.text(cx - CARD_W / 2 + 18, cardY - 9, cfg.label, {
        fontSize: "19px", fontFamily: "monospace",
        color: cfg.colorStr, fontStyle: "bold",
      }).setOrigin(0, 0.5);
      this.cardLabels.push(label);

      // AI target ET (smaller, below label)
      this.add.text(cx - CARD_W / 2 + 18, cardY + 11, `AI target: ~${cfg.targetET.toFixed(1)}s  ±${cfg.variance.toFixed(2)}s`, {
        fontSize: "11px", fontFamily: "monospace", color: "#444444",
      }).setOrigin(0, 0.5);

      // Description (right-aligned)
      this.add.text(cx + CARD_W / 2 - 14, cardY, cfg.description, {
        fontSize: "12px", fontFamily: "monospace", color: "#555555",
      }).setOrigin(1, 0.5);

      // Events
      const idx = i;
      bg.on("pointerover",  () => { this.hoverIndex = idx; this.refreshCards(); });
      bg.on("pointerout",   () => { this.hoverIndex = -1;  this.refreshCards(); });
      bg.on("pointerdown",  () => this.confirmDifficulty(idx));
    }

    this.refreshCards();

    // ── Keyboard ──────────────────────────────────────────────────────────
    const kbd = this.input.keyboard!;
    kbd.on("keydown-UP",   () => { this.selectedIndex = (this.selectedIndex + DIFFICULTIES.length - 1) % DIFFICULTIES.length; this.refreshCards(); });
    kbd.on("keydown-DOWN", () => { this.selectedIndex = (this.selectedIndex + 1) % DIFFICULTIES.length; this.refreshCards(); });
    kbd.on("keydown-ENTER",() => this.confirmDifficulty(this.selectedIndex));
    kbd.on("keydown-ESC",  () => this.scene.start("MenuScene"));

    // ── Back link ─────────────────────────────────────────────────────────
    const backText = this.add.text(cx, 432, "← BACK TO MENU", {
      fontSize: "12px", fontFamily: "monospace", color: "#444444",
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    backText.on("pointerover", () => backText.setColor("#888888"));
    backText.on("pointerout",  () => backText.setColor("#444444"));
    backText.on("pointerdown", () => this.scene.start("MenuScene"));
  }

  private refreshCards(): void {
    for (let i = 0; i < DIFFICULTIES.length; i++) {
      const cfg         = DIFFICULTIES[i];
      const isSelected  = i === this.selectedIndex;
      const isHovered   = i === this.hoverIndex && !isSelected;

      let fill   = 0x111111;
      let stroke = 0x2a2a2a;
      let strokeW = 1;
      if (isSelected) { fill = cfg.color; stroke = cfg.color; strokeW = 2; }
      else if (isHovered) { fill = 0x1d1d1d; stroke = 0x444444; }

      this.cardBgs[i].setFillStyle(fill).setStrokeStyle(strokeW, stroke);
      this.cardLabels[i].setColor(isSelected ? "#000000" : cfg.colorStr);
    }
  }

  private confirmDifficulty(index: number): void {
    this.game.registry.set("difficulty", DIFFICULTIES[index].key);
    this.scene.start("MenuScene");
  }
}
