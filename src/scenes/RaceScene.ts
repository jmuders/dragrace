import Phaser from "phaser";
import { RaceSimulation } from "../simulation/RaceSimulation";
import { RacePhase, ShiftGrade, LaunchGrade } from "../types";
import {
  QUARTER_MILE_METERS, MAX_RPM, NITRO_DURATION,
  LAUNCH_RPM_GOOD_LOW, LAUNCH_RPM_GOOD_HIGH,
  LAUNCH_RPM_PERFECT_LOW, LAUNCH_RPM_PERFECT_HIGH,
} from "../constants";

// ─── Small helper: colour a grade string ──────────────────────────────────────

function gradeColour(grade: ShiftGrade | LaunchGrade): string {
  switch (grade) {
    case ShiftGrade.Perfect:
    case LaunchGrade.Perfect:  return "#00ff88";
    case ShiftGrade.Good:
    case LaunchGrade.Good:     return "#aaff00";
    case ShiftGrade.Early:
    case LaunchGrade.Bog:      return "#ffaa00";
    case ShiftGrade.Late:
    case LaunchGrade.Wheelspin: return "#ff3300";
  }
}

export class RaceScene extends Phaser.Scene {
  // simulation
  private sim!: RaceSimulation;

  // keyboard
  private keyThrottle!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;
  private keyNitro!: Phaser.Input.Keyboard.Key;
  private keyThrottleAlt!: Phaser.Input.Keyboard.Key;
  private shiftEdge = false; // true only on the frame the key was freshly pressed

  // touch controls
  private touchThrottle = false;
  private touchNitro = false;
  private touchShiftEdge = false;

  // ── scene objects ─────────────────────────────────────────────────────────

  // Road
  private roadLines: Phaser.GameObjects.Rectangle[] = [];
  private roadLineOffset = 0;

  // Cars (simple rectangles + decorations)
  private playerCar!: Phaser.GameObjects.Container;

  // Track progress bar area
  private playerDot!: Phaser.GameObjects.Arc;
  private opponentDot!: Phaser.GameObjects.Arc;

  // Countdown tree
  private treeContainer!: Phaser.GameObjects.Container;
  private amberLights: Phaser.GameObjects.Arc[] = [];
  private greenLight!: Phaser.GameObjects.Arc;
  private redLight!: Phaser.GameObjects.Arc;
  private startBtn!: Phaser.GameObjects.Container;

  // HUD elements
  private rpmFill!: Phaser.GameObjects.Rectangle;
  private rpmNeedle!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private gearText!: Phaser.GameObjects.Text;
  private timerText!: Phaser.GameObjects.Text;
  private nitroFill!: Phaser.GameObjects.Rectangle;
  private feedbackText!: Phaser.GameObjects.Text;

  // Transient feedback
  private feedbackTimer = 0;

  constructor() {
    super({ key: "RaceScene" });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // create
  // ──────────────────────────────────────────────────────────────────────────

  create(): void {
    this.sim = new RaceSimulation();
    this.shiftEdge = false;
    this.feedbackTimer = 0;

    const { width, height } = this.scale;

    this.buildRoad(width, height);
    this.buildCars(width, height);
    this.buildProgressBar(width, height);
    this.buildCountdownTree(width, height);
    this.buildHUD(width, height);
    this.buildStartButton(width, height);
    this.buildTouchControls(width, height);

    // Keyboard
    const kbd = this.input.keyboard!;
    this.keyThrottle    = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyThrottleAlt = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyShift       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyNitro       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.N);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // update
  // ──────────────────────────────────────────────────────────────────────────

  update(_time: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05); // cap at 50ms to prevent spiral

    // Edge-detect the shift key (keyboard or touch)
    const shiftDown = Phaser.Input.Keyboard.JustDown(this.keyShift);
    if (shiftDown || this.touchShiftEdge) this.shiftEdge = true;
    this.touchShiftEdge = false;

    const throttleHeld = this.keyThrottle.isDown || this.keyThrottleAlt.isDown || this.touchThrottle;
    const nitroHeld    = this.keyNitro.isDown || this.touchNitro;

    const simShifted = this.sim.update(
      { throttle: throttleHeld, shift: this.shiftEdge, nitro: nitroHeld },
      dt,
    );

    // Consume the shift edge flag
    this.shiftEdge = false;

    const state = this.sim.getState();

    // ── Road scroll ──────────────────────────────────────────────────────
    if (state.phase === RacePhase.Racing) {
      const speedMps = state.player.speed;
      this.roadLineOffset = (this.roadLineOffset + speedMps * dt * 120) % 160;
      this.roadLines.forEach((r, i) => {
        r.y = ((i * 160 - this.roadLineOffset + 1600) % 1600) - 800
          + this.scale.height / 2;
      });
    }

    // ── Car lateral positions (spread around track) ─────────────────────
    // Cars stay in fixed x; vertical pos shows lane
    // Player car "moves" forward slightly at speed for feel
    if (state.phase === RacePhase.Racing) {
      const shake = state.player.nitroActive
        ? (Math.random() - 0.5) * 4
        : 0;
      this.playerCar.x = this.scale.width * 0.35 + shake;
    }

    // ── Countdown tree ───────────────────────────────────────────────────
    this.updateCountdownTree(state.countdown.ambersLit, state.countdown.greenLit,
      state.phase);

    // ── Progress bar ─────────────────────────────────────────────────────
    const barLeft  = 60;
    const barRight = this.scale.width - 60;
    const barWidth = barRight - barLeft;

    this.playerDot.x   = barLeft + (state.player.distance / QUARTER_MILE_METERS) * barWidth;
    this.opponentDot.x = barLeft + (state.opponent.distance / QUARTER_MILE_METERS) * barWidth;

    // ── HUD ──────────────────────────────────────────────────────────────
    this.updateHUD(state, throttleHeld);

    // ── Shift feedback popup ─────────────────────────────────────────────
    if (simShifted && this.sim.lastShiftEvent) {
      const ev = this.sim.lastShiftEvent;
      this.showFeedback(`SHIFT ${ev.grade}`, gradeColour(ev.grade));
    }

    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) {
        this.feedbackText.setVisible(false);
      }
    }

    // ── Transition to results ────────────────────────────────────────────
    if (this.sim.isFinished()) {
      const result = this.sim.buildResult();
      this.scene.start("ResultsScene", { result });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Build helpers
  // ──────────────────────────────────────────────────────────────────────────

  private buildRoad(w: number, h: number): void {
    // Sky
    this.add.rectangle(0, 0, w, h * 0.45, 0x1a1a2e).setOrigin(0, 0);
    // Ground / track
    this.add.rectangle(0, h * 0.45, w, h * 0.55, 0x1e1e1e).setOrigin(0, 0);

    // Track surface
    this.add.rectangle(w * 0.5, h * 0.6, w * 0.6, h * 0.35, 0x2a2a2a).setOrigin(0.5, 0.5);

    // Center dashed lines
    for (let i = 0; i < 12; i++) {
      const r = this.add.rectangle(w / 2, h * 0.45 + i * 160, 6, 80, 0x444444);
      this.roadLines.push(r);
    }

    // Track edges
    this.add.rectangle(w * 0.2, h * 0.6, 6, h * 0.35, 0xffffff).setAlpha(0.4);
    this.add.rectangle(w * 0.8, h * 0.6, 6, h * 0.35, 0xffffff).setAlpha(0.4);

    // Horizon
    this.add.rectangle(0, h * 0.45 - 2, w, 4, 0x333333).setOrigin(0, 0);
  }

  private buildCars(w: number, h: number): void {
    const carY = h * 0.72;

    // ── Player car (blue) ──────────────────────────────────────────────
    this.playerCar = this.add.container(w * 0.35, carY);
    this.drawCar(this.playerCar, 0x2255ff, 0x88aaff, true);

    // ── Opponent car (red) ─────────────────────────────────────────────
    const opponentCar = this.add.container(w * 0.65, carY);
    this.drawCar(opponentCar, 0xff2200, 0xff8866, false);
  }

  private drawCar(
    container: Phaser.GameObjects.Container,
    bodyColour: number,
    accentColour: number,
    isPlayer: boolean,
  ): void {
    // Body
    const body = this.add.rectangle(0, 0, 70, 30, bodyColour);

    // Roof
    const roof = this.add.rectangle(0, -18, 42, 20, accentColour);

    // Windows (dark)
    const windshield = this.add.rectangle(8, -18, 22, 14, 0x111133).setAlpha(0.8);
    const rearWindow = this.add.rectangle(-14, -18, 12, 14, 0x111133).setAlpha(0.8);

    // Wheels
    const wFL = this.add.circle( 28,  14, 10, 0x111111);
    const wFR = this.add.circle( 28, -14, 10, 0x111111);
    const wRL = this.add.circle(-28,  14, 10, 0x111111);
    const wRR = this.add.circle(-28, -14, 10, 0x111111);

    // Wheel rims
    [wFL, wFR, wRL, wRR].forEach(w => {
      const rim = this.add.circle(w.x, w.y, 5, 0x888888);
      container.add(rim);
    });

    // Exhaust pipe
    const exhaust = this.add.rectangle(-38, 10, 8, 4, 0x555555);

    // Label
    const label = this.add.text(0, 28, isPlayer ? "PLAYER" : "CPU", {
      fontSize: "11px",
      fontFamily: "monospace",
      color: isPlayer ? "#88aaff" : "#ff8866",
    }).setOrigin(0.5, 0);

    container.add([body, roof, windshield, rearWindow, wFL, wFR, wRL, wRR, exhaust, label]);

    // Headlights
    const hlLeft  = this.add.circle( 36,  10, 4, 0xffffaa);
    const hlRight = this.add.circle( 36, -10, 4, 0xffffaa);
    container.add([hlLeft, hlRight]);
  }

  private buildProgressBar(w: number, h: number): void {
    const barY = h - 30;
    // Background
    this.add.rectangle(w / 2, barY, w - 80, 14, 0x333333).setOrigin(0.5, 0.5);

    // Finish line marker
    this.add.rectangle(w - 60, barY, 4, 20, 0xffffff).setOrigin(0.5, 0.5);

    // Dots
    this.playerDot   = this.add.circle(60, barY, 7, 0x4488ff);
    this.opponentDot = this.add.circle(60, barY, 7, 0xff4422);

    // Labels
    this.add.text(60,  barY - 14, "P", { fontSize: "11px", fontFamily: "monospace", color: "#4488ff" }).setOrigin(0.5);
    this.add.text(w - 60, barY - 14, "¼mi", { fontSize: "11px", fontFamily: "monospace", color: "#ffffff" }).setOrigin(0.5);
  }

  private buildCountdownTree(w: number, h: number): void {
    const tx = w * 0.5;
    const ty = h * 0.22;

    this.treeContainer = this.add.container(tx, ty);

    // Pre-stage / stage (small yellow dots, always dim)
    [-12, 12].forEach(ox => {
      this.treeContainer.add(this.add.circle(ox, -50, 6, 0x444400));
    });

    // Red light (top)
    this.redLight = this.add.circle(0, -28, 12, 0x330000);
    this.treeContainer.add(this.redLight);

    // Amber lights
    for (let i = 0; i < 3; i++) {
      const a = this.add.circle(0, i * 28, 12, 0x332200);
      this.amberLights.push(a);
      this.treeContainer.add(a);
    }

    // Green light (bottom)
    this.greenLight = this.add.circle(0, 3 * 28, 12, 0x003300);
    this.treeContainer.add(this.greenLight);

    // TREE label
    this.treeContainer.add(
      this.add.text(0, -68, "TREE", {
        fontSize: "12px", fontFamily: "monospace", color: "#888888",
      }).setOrigin(0.5),
    );
  }

  private buildStartButton(w: number, h: number): void {
    this.startBtn = this.add.container(w * 0.5, h * 0.90);

    const bg = this.add.rectangle(0, 0, 220, 46, 0x006600)
      .setInteractive({ useHandCursor: true });

    const txt = this.add.text(0, 0, "STAGE & START", {
      fontSize: "18px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);

    bg.on("pointerover", () => bg.setFillStyle(0x009900));
    bg.on("pointerout",  () => bg.setFillStyle(0x006600));
    bg.on("pointerdown", () => this.sim.startCountdown());

    this.startBtn.add([bg, txt]);

    // Also allow Enter to start countdown
    this.input.keyboard!.once("keydown-ENTER", () => this.sim.startCountdown());
  }

  private buildHUD(w: number, h: number): void {
    const hudY = h * 0.88;

    // ── Left panel: RPM ───────────────────────────────────────────────────
    this.add.text(30, hudY - 40, "RPM", {
      fontSize: "13px", fontFamily: "monospace", color: "#aaaaaa",
    });

    // RPM bar background
    this.add.rectangle(30, hudY, 200, 18, 0x222222).setOrigin(0, 0.5);

    // Launch zone markers
    const zoneMarkers = this.add.container(0, 0);
    const barW = 200;
    const goodLow  = (LAUNCH_RPM_GOOD_LOW / MAX_RPM) * barW;
    const goodHigh = (LAUNCH_RPM_GOOD_HIGH / MAX_RPM) * barW;
    const perfLow  = (LAUNCH_RPM_PERFECT_LOW / MAX_RPM) * barW;
    const perfHigh = (LAUNCH_RPM_PERFECT_HIGH / MAX_RPM) * barW;

    // Good zone
    zoneMarkers.add(
      this.add.rectangle(30 + goodLow, hudY, goodHigh - goodLow, 18, 0x448800, 0.35)
        .setOrigin(0, 0.5),
    );
    // Perfect zone
    zoneMarkers.add(
      this.add.rectangle(30 + perfLow, hudY, perfHigh - perfLow, 18, 0x00ff44, 0.45)
        .setOrigin(0, 0.5),
    );

    // RPM fill
    this.rpmFill = this.add.rectangle(30, hudY, 0, 14, 0xff4400).setOrigin(0, 0.5);

    // RPM number
    this.rpmNeedle = this.add.text(240, hudY, "0 RPM", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffaa00",
    }).setOrigin(0, 0.5);

    // ── Centre panel: Gear / Speed ────────────────────────────────────────
    this.gearText = this.add.text(w / 2, hudY - 14, "GEAR  1", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff",
      fontStyle: "bold",
    }).setOrigin(0.5, 0.5);

    this.speedText = this.add.text(w / 2, hudY + 14, "0 MPH", {
      fontSize: "18px", fontFamily: "monospace", color: "#88ddff",
    }).setOrigin(0.5, 0.5);

    // ── Right panel: timer + nitro ────────────────────────────────────────
    this.timerText = this.add.text(w - 30, hudY - 20, "0.000", {
      fontSize: "28px", fontFamily: "monospace", color: "#ffff44",
      fontStyle: "bold",
    }).setOrigin(1, 0.5);

    this.add.text(w - 30, hudY + 16, "NITRO", {
      fontSize: "12px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(1, 0.5);

    this.add.rectangle(w - 30 - 80, hudY + 28, 80, 10, 0x222222).setOrigin(0, 0.5);
    this.nitroFill = this.add.rectangle(w - 30 - 80, hudY + 28, 80, 8, 0x00ccff).setOrigin(0, 0.5);

    // ── Feedback popup ────────────────────────────────────────────────────
    this.feedbackText = this.add.text(w / 2, h * 0.5, "", {
      fontSize: "36px", fontFamily: "monospace", color: "#ffffff",
      fontStyle: "bold",
      stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false).setDepth(10);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Per-frame update helpers
  // ──────────────────────────────────────────────────────────────────────────

  private updateCountdownTree(ambersLit: number, greenLit: boolean, phase: RacePhase): void {
    // Red light: on during staging
    this.redLight.setFillStyle(phase === RacePhase.Staging ? 0xff2200 : 0x330000);

    // Ambers
    for (let i = 0; i < 3; i++) {
      this.amberLights[i].setFillStyle(i < ambersLit ? 0xffaa00 : 0x332200);
    }

    // Green
    this.greenLight.setFillStyle(greenLit ? 0x00ff44 : 0x003300);

    // Hide start button once countdown has begun
    if (phase !== RacePhase.Staging) {
      this.startBtn.setVisible(false);
    }
  }

  private updateHUD(
    state: ReturnType<RaceSimulation["getState"]>,
    _throttleHeld: boolean,
  ): void {
    const p = state.player;

    // RPM fill
    const rpmFrac = Math.min(p.rpm / MAX_RPM, 1);
    const barMaxW = 200;
    this.rpmFill.width = rpmFrac * barMaxW;

    // Colour: red when near limiter
    const rpmColour = p.rpm > 7500 ? 0xff0000 : p.rpm > 5500 ? 0xff8800 : 0xff4400;
    this.rpmFill.setFillStyle(rpmColour);

    this.rpmNeedle.setText(`${Math.round(p.rpm)} RPM`);

    // Speed (m/s → mph)
    const mph = p.speed * 2.237;
    this.speedText.setText(`${Math.round(mph)} MPH`);

    // Gear
    this.gearText.setText(`GEAR  ${p.gear}`);

    // Timer
    if (state.phase === RacePhase.Racing) {
      this.timerText.setText(state.elapsed.toFixed(3));
    } else if (state.phase === RacePhase.Finished) {
      this.timerText.setText(p.finishTime > 0 ? p.finishTime.toFixed(3) : "DNF");
    }

    // Nitro bar
    const nitroFrac = p.nitroRemaining / NITRO_DURATION;
    this.nitroFill.width = nitroFrac * 80;
    const nitroColour = p.nitroActive ? 0x00ffff : 0x0088cc;
    this.nitroFill.setFillStyle(nitroColour);
  }

  private showFeedback(text: string, colour: string): void {
    this.feedbackText.setText(text).setColor(colour).setVisible(true);
    this.feedbackTimer = 1.2;

    // Pop animation
    this.tweens.add({
      targets: this.feedbackText,
      scaleX: { from: 1.4, to: 1 },
      scaleY: { from: 1.4, to: 1 },
      duration: 200,
      ease: "Back.easeOut",
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Touch controls (only added on touch-capable devices)
  // ──────────────────────────────────────────────────────────────────────────

  private buildTouchControls(w: number, h: number): void {
    if (!this.sys.game.device.input.touch) return;

    const depth = 20;

    // Helper: create a labelled touch button
    const makeBtn = (
      x: number, y: number, bw: number, bh: number,
      colour: number, label: string, sublabel: string,
    ): Phaser.GameObjects.Rectangle => {
      const bg = this.add.rectangle(x, y, bw, bh, colour)
        .setAlpha(0.18)
        .setInteractive()
        .setDepth(depth);
      this.add.text(x, sublabel ? y - 10 : y, label, {
        fontSize: "15px", fontFamily: "monospace", color: "#ffffff",
      }).setOrigin(0.5).setAlpha(0.9).setDepth(depth + 1);
      if (sublabel) {
        this.add.text(x, y + 14, sublabel, {
          fontSize: "11px", fontFamily: "monospace", color: "#aaaaaa",
        }).setOrigin(0.5).setAlpha(0.85).setDepth(depth + 1);
      }
      return bg;
    };

    // ── THROTTLE – left column ─────────────────────────────────────────────
    const throttleBg = makeBtn(75, h * 0.82, 140, h * 0.28, 0x2255ff, "THROTTLE", "HOLD");
    throttleBg.on("pointerdown", () => { this.touchThrottle = true;  throttleBg.setAlpha(0.4); });
    throttleBg.on("pointerup",   () => { this.touchThrottle = false; throttleBg.setAlpha(0.18); });
    throttleBg.on("pointerout",  () => { this.touchThrottle = false; throttleBg.setAlpha(0.18); });

    // ── SHIFT – upper right ────────────────────────────────────────────────
    const shiftBg = makeBtn(w - 75, h * 0.72, 140, h * 0.14, 0xffaa00, "SHIFT", "TAP");
    shiftBg.on("pointerdown", () => {
      this.touchShiftEdge = true;
      shiftBg.setAlpha(0.55);
      this.time.delayedCall(130, () => shiftBg.setAlpha(0.18));
    });

    // ── NITRO – lower right ────────────────────────────────────────────────
    const nitroBg = makeBtn(w - 75, h * 0.88, 140, h * 0.14, 0x00ccff, "NITRO", "HOLD");
    nitroBg.on("pointerdown", () => { this.touchNitro = true;  nitroBg.setAlpha(0.4); });
    nitroBg.on("pointerup",   () => { this.touchNitro = false; nitroBg.setAlpha(0.18); });
    nitroBg.on("pointerout",  () => { this.touchNitro = false; nitroBg.setAlpha(0.18); });
  }
}
