import Phaser from "phaser";
import { RaceSimulation } from "../simulation/RaceSimulation";
import { RacePhase, ShiftGrade, LaunchGrade } from "../types";
import {
  QUARTER_MILE_METERS, MAX_RPM, NITRO_DURATION,
  LAUNCH_RPM_GOOD_LOW, LAUNCH_RPM_GOOD_HIGH,
  LAUNCH_RPM_PERFECT_LOW, LAUNCH_RPM_PERFECT_HIGH,
  SHIFT_RPM_IDEAL, SHIFT_RPM_PERFECT_WINDOW, SHIFT_RPM_GOOD_WINDOW, REV_LIMITER_WINDOW,
} from "../constants";
import { createCarTexture, preloadCarTextures, getCarDisplayScale, CarType } from "../graphics/CarSprites";
import { MusicManager } from "../audio/MusicManager";
import { EngineSound, CAR_ENGINE_TYPE, estimateCpuRpm } from "../audio/EngineSound";

function gradeColour(grade: ShiftGrade | LaunchGrade): string {
  switch (grade) {
    case ShiftGrade.Perfect:
    case LaunchGrade.Perfect:   return "#00ff88";
    case ShiftGrade.Good:
    case LaunchGrade.Good:      return "#aaff00";
    case ShiftGrade.Early:
    case LaunchGrade.Bog:       return "#ffaa00";
    case ShiftGrade.Late:
    case LaunchGrade.Wheelspin: return "#ff3300";
  }
}

const TRACK_START_X = 60;
const TRACK_END_X   = 740;
const TRACK_WIDTH   = TRACK_END_X - TRACK_START_X;
const PLAYER_LANE_Y = 155;
const CPU_LANE_Y    = 275;

export class RaceScene extends Phaser.Scene {
  private sim!: RaceSimulation;
  private carType: CarType = "silver";
  private opponentCarType: CarType = "orange";
  private difficulty = "STREET";

  private keyThrottle!:    Phaser.Input.Keyboard.Key;
  private keyThrottleAlt!: Phaser.Input.Keyboard.Key;
  private keyShift!:       Phaser.Input.Keyboard.Key;
  private keyNitro!:       Phaser.Input.Keyboard.Key;
  private shiftEdge = false;

  private touchThrottle  = false;
  private touchNitro     = false;
  private touchShiftEdge = false;

  private playerSprite!: Phaser.GameObjects.Image;
  private cpuSprite!:    Phaser.GameObjects.Image;

  private bgClouds:     Phaser.GameObjects.Rectangle[] = [];
  private bgTrees:      Phaser.GameObjects.Rectangle[] = [];
  private laneMarkings: Phaser.GameObjects.Rectangle[] = [];
  private laneOffset = 0;

  private speedLines:    Phaser.GameObjects.Rectangle[] = [];
  private cpuSpeedLines: Phaser.GameObjects.Rectangle[] = [];

  private amberLights:    Phaser.GameObjects.Arc[] = [];
  private greenLight!:    Phaser.GameObjects.Arc;
  private redLight!:      Phaser.GameObjects.Arc;
  private treeContainer!: Phaser.GameObjects.Container;
  private startBtn!:      Phaser.GameObjects.Container;

  private rpmGauge!:     Phaser.GameObjects.Graphics;
  private speedGauge!:   Phaser.GameObjects.Graphics;
  private rpmValText!:   Phaser.GameObjects.Text;
  private speedText!:    Phaser.GameObjects.Text;
  private gearText!:     Phaser.GameObjects.Text;
  private timerText!:    Phaser.GameObjects.Text;
  private nitroFill!:    Phaser.GameObjects.Rectangle;
  private feedbackText!: Phaser.GameObjects.Text;
  private feedbackTimer = 0;
  private gaugeY!: number;
  private spdGaugeX!: number;
  private rpmGaugeX!: number;

  private finishLineGfx!: Phaser.GameObjects.Graphics;
  private treeHideTriggered = false;

  // ── Audio ──────────────────────────────────────────────────────────────────
  private audioCtx:    AudioContext | null = null;
  private playerSound: EngineSound  | null = null;
  private cpuSound:    EngineSound  | null = null;
  private audioStarted = false;

  constructor() { super({ key: "RaceScene" }); }

  preload(): void {
    preloadCarTextures(this);
  }

  create(data?: { carType?: CarType; opponentCarType?: CarType; difficulty?: string }): void {
    this.carType = data?.carType ?? "silver";
    this.difficulty = data?.difficulty ?? "STREET";
    this.sim = new RaceSimulation(data?.difficulty, data?.carType);

    // Fade music to a quiet background level during the race
    MusicManager.get().setVolume(0.15, 1.5);
    this.shiftEdge = false;
    this.feedbackTimer = 0;
    this.laneOffset = 0;
    this.treeHideTriggered = false;
    this.bgClouds = [];
    this.bgTrees = [];
    this.laneMarkings = [];
    this.speedLines    = [];
    this.cpuSpeedLines = [];
    this.amberLights = [];

    const { width: W, height: H } = this.scale;
    const playerKey = createCarTexture(this, this.carType);
    const allCarTypes: CarType[] = [
      "silver", "orange", "red", "green",
      "blue_cobra", "black_hyper", "gray_roadster", "dark_hyper",
      "red_f40", "orange_supra", "white_proto", "red_roadster",
      "yellow_lotus", "orange_mclaren", "red_rx7", "blue_viper",
      "lime_super", "red_hyper", "blue_gt40", "blue_porsche",
      "yellow_muscle",
    ];
    const opponentChoices = allCarTypes.filter(t => t !== this.carType);
    const cpuCarType = data?.opponentCarType ?? opponentChoices[Math.floor(Math.random() * opponentChoices.length)];
    this.opponentCarType = cpuCarType;
    const cpuKey    = createCarTexture(this, cpuCarType);

    this.buildBackground(W, H);
    this.buildTrack(W, H);
    this.buildFinishLine(H);
    this.buildSpeedLines(playerKey, cpuKey);
    this.buildCars(playerKey, cpuKey);
    this.buildCountdownTree(W, H);
    this.buildHUD(W, H);
    this.buildStartButton(W, H);
    this.buildTouchControls(W, H);

    const kbd = this.input.keyboard!;
    this.keyThrottle    = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyThrottleAlt = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyShift       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyNitro       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.N);

    this.initAudio(this.carType, cpuCarType);
  }

  private initAudio(playerType: CarType, cpuType: CarType): void {
    try {
      this.audioCtx = new AudioContext();
      const pEngineType = CAR_ENGINE_TYPE[playerType] ?? 'inline6';
      const cEngineType = CAR_ENGINE_TYPE[cpuType]    ?? 'inline6';
      this.playerSound = new EngineSound(this.audioCtx, pEngineType, 0,    1.0);
      this.cpuSound    = new EngineSound(this.audioCtx, cEngineType, 0.15, 0.45);

      // Resume + start immediately — succeeds post-user-gesture (previous scene clicks)
      this.audioCtx.resume().then(() => {
        this.playerSound?.start();
        this.cpuSound?.start();
        this.audioStarted = true;
      }).catch(() => { /* will retry on first input */ });

      // Clean up when this scene shuts down
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroyAudio());
    } catch {
      // Web Audio not available (e.g. some old mobile browsers) — silently skip
    }
  }

  private destroyAudio(): void {
    this.playerSound?.destroy();
    this.cpuSound?.destroy();
    this.playerSound = null;
    this.cpuSound    = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);

    const shiftJust = Phaser.Input.Keyboard.JustDown(this.keyShift);
    if (shiftJust || this.touchShiftEdge) this.shiftEdge = true;
    this.touchShiftEdge = false;

    const throttle = this.keyThrottle.isDown || this.keyThrottleAlt.isDown || this.touchThrottle;
    const nitro    = this.keyNitro.isDown || this.touchNitro;

    // Pressing throttle during staging auto-starts the countdown sequence
    if (this.sim.isStaging() && throttle) {
      this.sim.startCountdown();
    }

    const simShifted = this.sim.update({ throttle, shift: this.shiftEdge, nitro }, dt);
    this.shiftEdge = false;

    const state = this.sim.getState();
    const p = state.player;
    const c = state.opponent;

    this.playerSprite.x = TRACK_START_X + (p.distance / QUARTER_MILE_METERS) * TRACK_WIDTH;
    this.cpuSprite.x    = TRACK_START_X + (c.distance / QUARTER_MILE_METERS) * TRACK_WIDTH;

    // Scroll world based on car speed – always active once moving, giving proper momentum feel
    if (state.phase === RacePhase.Racing && p.speed > 0.5) {
      const scroll = p.speed * 40;
      this.bgClouds.forEach(r => {
        r.x -= scroll * dt * 0.15;
        if (r.x < -r.width / 2) r.x += this.scale.width + r.width;
      });
      this.bgTrees.forEach(r => {
        r.x -= scroll * dt * 0.4;
        if (r.x < -r.width / 2) r.x += this.scale.width + r.width;
      });
      this.laneOffset = (this.laneOffset + scroll * dt * 0.9) % 120;
      this.laneMarkings.forEach((r, i) => {
        r.x = (i * 60 - this.laneOffset + 1200) % 1200 - 60 + TRACK_START_X;
      });
    }

    // Speed lines – visible whenever moving fast enough (not just when throttling)
    const showLines = state.phase === RacePhase.Racing && p.speed > 20;
    const pRearX = this.playerSprite.x - this.playerSprite.displayWidth / 2;
    this.speedLines.forEach((r, i) => {
      r.setVisible(showLines);
      if (showLines) {
        const len = p.speed * 3 + (p.nitroActive ? 80 : 0);
        r.width = len;
        r.x = pRearX - (i % 3) * 15;
        r.alpha = 0.25 + Math.random() * 0.2;
      }
    });

    const showCpuLines = state.phase === RacePhase.Racing && c.speed > 20;
    const cRearX = this.cpuSprite.x - this.cpuSprite.displayWidth / 2;
    this.cpuSpeedLines.forEach((r, i) => {
      r.setVisible(showCpuLines);
      if (showCpuLines) {
        const len = c.speed * 3 + (c.nitroActive ? 80 : 0);
        r.width = len;
        r.x = cRearX - (i % 3) * 15;
        r.alpha = 0.25 + Math.random() * 0.2;
      }
    });

    // Car shake: nitro gives big shake, rev limiter gives a stiff micro-stutter
    if (p.nitroActive) {
      this.playerSprite.x += (Math.random() - 0.5) * 2;
      this.playerSprite.y += (Math.random() - 0.5) * 1.5;
    } else if (p.revLimiterActive) {
      this.playerSprite.x += (Math.random() - 0.5) * 0.8;
      this.playerSprite.y = PLAYER_LANE_Y + (Math.random() - 0.5) * 0.6;
    } else {
      this.playerSprite.y = PLAYER_LANE_Y;
    }

    this.updateTree(state.countdown.ambersLit, state.countdown.greenLit, state.phase);

    if (state.phase === RacePhase.Racing && state.elapsed >= 2.5 && !this.treeHideTriggered) {
      this.treeHideTriggered = true;
      this.tweens.add({
        targets: this.treeContainer,
        alpha: { from: 1, to: 0 },
        duration: 600,
        ease: "Linear",
      });
    }

    this.updateHUD(state, p);

    if (simShifted && this.sim.lastShiftEvent) {
      const ev = this.sim.lastShiftEvent;
      this.showFeedback(`SHIFT  ${ev.grade}`, gradeColour(ev.grade));
      this.playerSound?.shiftCut();
    }
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedbackText.setVisible(false);
    }

    // ── Audio update ─────────────────────────────────────────────────────────
    if (this.audioCtx && !this.audioStarted && (throttle || nitro)) {
      // Retry resume on first user input if initial resume was blocked
      this.audioCtx.resume().then(() => {
        this.playerSound?.start();
        this.cpuSound?.start();
        this.audioStarted = true;
      }).catch(() => {});
    }
    if (this.audioStarted) {
      this.playerSound?.update(p.rpm, p.nitroActive);
      const cpuRpm = c.rpm > 0 ? c.rpm : estimateCpuRpm(c.speed);
      this.cpuSound?.update(cpuRpm, c.nitroActive);
    }

    if (this.sim.isFinished()) {
      this.playerSound?.stop();
      this.cpuSound?.stop();
      this.scene.start("ResultsScene", { result: this.sim.buildResult(), carType: this.carType, opponentCarType: this.opponentCarType, difficulty: this.difficulty });
    }
  }

  private buildBackground(W: number, H: number): void {
    this.add.rectangle(0, 0, W, H * 0.55, 0x1a1a3a).setOrigin(0, 0);
    this.add.rectangle(0, H * 0.25, W, H * 0.3, 0x202050).setOrigin(0, 0);
    this.add.rectangle(0, H * 0.5, W, 4, 0x334466).setOrigin(0, 0.5);

    const cloudY = [60, 100, 80, 55, 90];
    const cloudW = [120, 80, 150, 90, 110];
    for (let i = 0; i < 8; i++) {
      this.bgClouds.push(this.add.rectangle(
        (i * 160 + 40) % W, cloudY[i % 5], cloudW[i % 5], 14, 0x2a2a55, 0.6,
      ));
    }
    for (let i = 0; i < 14; i++) {
      const th = 30 + Math.random() * 20;
      this.bgTrees.push(this.add.rectangle(
        i * 90 + Math.random() * 40, H * 0.52 - th / 2,
        18 + Math.random() * 16, th, 0x1a3322,
      ));
    }
    this.add.rectangle(0, H * 0.52, W, H * 0.48, 0x111111).setOrigin(0, 0);
  }

  private buildTrack(W: number, H: number): void {
    const trackH = 200;
    this.add.rectangle(W / 2, H * 0.52, W, trackH, 0x1e1e1e);

    this.add.rectangle(W / 2, PLAYER_LANE_Y, W, 90, 0x222222);
    this.add.rectangle(W / 2, PLAYER_LANE_Y - 45, W, 3, 0x444444);
    this.add.rectangle(W / 2, PLAYER_LANE_Y + 45, W, 3, 0x333333);

    const medianY = (PLAYER_LANE_Y + CPU_LANE_Y) / 2;
    this.add.rectangle(W / 2, medianY, W, 12, 0x333333);
    this.add.rectangle(W / 2, medianY, W, 3, 0xaaaa00).setAlpha(0.7);

    this.add.rectangle(W / 2, CPU_LANE_Y, W, 90, 0x1e1e1e);
    this.add.rectangle(W / 2, CPU_LANE_Y - 45, W, 3, 0x333333);
    this.add.rectangle(W / 2, CPU_LANE_Y + 45, W, 3, 0x444444);

    for (let i = 0; i < 24; i++) {
      const x = TRACK_START_X + i * 60;
      this.laneMarkings.push(
        this.add.rectangle(x, PLAYER_LANE_Y, 30, 3, 0x555555).setOrigin(0, 0.5),
        this.add.rectangle(x, CPU_LANE_Y,    30, 3, 0x444444).setOrigin(0, 0.5),
      );
    }

    this.add.rectangle(TRACK_START_X, H * 0.52, 4, trackH, 0xffffff).setAlpha(0.5);
    this.add.text(TRACK_START_X + 8, PLAYER_LANE_Y - 52, "START", {
      fontSize: "11px", fontFamily: "monospace", color: "#888888",
    });
    this.add.text(12, PLAYER_LANE_Y - 10, "PLAYER", {
      fontSize: "11px", fontFamily: "monospace", color: "#4488ff",
    }).setOrigin(0, 0.5);
    this.add.text(12, CPU_LANE_Y - 10, "CPU", {
      fontSize: "11px", fontFamily: "monospace", color: "#ff6622",
    }).setOrigin(0, 0.5);

    this.buildBarrier(W, PLAYER_LANE_Y - 52, 0x888888);
    this.buildBarrier(W, CPU_LANE_Y + 52,    0x777777);

    this.add.rectangle(W * 0.5, PLAYER_LANE_Y - 70, 100, 22, 0x003366);
    this.add.text(W * 0.5, PLAYER_LANE_Y - 70, "QUARTER MILE", {
      fontSize: "9px", fontFamily: "monospace", color: "#88aaff",
    }).setOrigin(0.5, 0.5);
  }

  private buildBarrier(W: number, y: number, col: number): void {
    this.add.rectangle(W / 2, y, W, 5, col);
    for (let i = 0; i < 20; i++) {
      this.add.rectangle(i * (W / 18), y, 4, 12, 0x444444);
    }
  }

  private buildFinishLine(H: number): void {
    this.finishLineGfx = this.add.graphics();
    const g = this.finishLineGfx;
    const trackH = 280;
    const top = H * 0.52 - trackH / 2;
    const tileH = 14, tileW = 8, cols = 2;
    const rows = Math.ceil(trackH / tileH);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        g.fillStyle((r + c) % 2 === 0 ? 0xffffff : 0x000000, 1);
        g.fillRect(TRACK_END_X + c * tileW, top + r * tileH, tileW, tileH);
      }
    }
    this.add.text(TRACK_END_X + 20, H * 0.52, "FINISH", {
      fontSize: "11px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0, 0.5);
  }

  private buildCars(playerKey: string, cpuKey: string): void {
    this.playerSprite = this.add.image(TRACK_START_X, PLAYER_LANE_Y, playerKey)
      .setOrigin(0.5, 0.7).setScale(getCarDisplayScale(this, playerKey, 288));
    this.cpuSprite = this.add.image(TRACK_START_X, CPU_LANE_Y, cpuKey)
      .setOrigin(0.5, 0.7).setScale(getCarDisplayScale(this, cpuKey, 288));
  }

  private buildSpeedLines(playerKey: string, cpuKey: string): void {
    // Fractions of sprite height from the top where each speed-line sits.
    // Range 0.08–0.65 covers the car body (roof → lower door panel), above the wheels.
    const fractions = [0.08, 0.18, 0.28, 0.40, 0.52, 0.63];
    const originY = 0.7; // must match setOrigin used in buildCars

    const computeDispH = (key: string): number => {
      const tex = this.textures.get(key);
      const texH = tex.source[0].height;
      const scale = getCarDisplayScale(this, key, 288);
      return texH * scale;
    };

    const pDispH = computeDispH(playerKey);
    const cDispH = computeDispH(cpuKey);

    for (const frac of fractions) {
      const pDy = (frac - originY) * pDispH;
      const cDy = (frac - originY) * cDispH;
      this.speedLines.push(
        this.add.rectangle(0, PLAYER_LANE_Y + pDy, 60, 2, 0xffffff, 0.35)
          .setOrigin(1, 0.5).setVisible(false),
      );
      this.cpuSpeedLines.push(
        this.add.rectangle(0, CPU_LANE_Y + cDy, 60, 2, 0xff8844, 0.35)
          .setOrigin(1, 0.5).setVisible(false),
      );
    }
  }

  private buildCountdownTree(W: number, H: number): void {
    this.treeContainer = this.add.container(W * 0.5, H * 0.10);
    const housing = this.add.rectangle(0, 20, 38, 140, 0x1a1a1a).setStrokeStyle(1, 0x333333);
    this.treeContainer.add(housing);
    this.treeContainer.add(
      this.add.text(0, -22, "CHRISTMAS TREE", {
        fontSize: "9px", fontFamily: "monospace", color: "#555555",
      }).setOrigin(0.5),
    );
    this.redLight = this.add.circle(0, -8, 10, 0x330000);
    this.treeContainer.add(this.redLight);
    for (let i = 0; i < 3; i++) {
      const a = this.add.circle(0, 12 + i * 22, 10, 0x332200);
      this.amberLights.push(a);
      this.treeContainer.add(a);
    }
    this.greenLight = this.add.circle(0, 80, 10, 0x003300);
    this.treeContainer.add(this.greenLight);
  }

  private buildStartButton(W: number, H: number): void {
    this.startBtn = this.add.container(W * 0.5, H * 0.93);
    const bg = this.add.rectangle(0, 0, 260, 42, 0x006600)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, -6, "HOLD THROTTLE TO START", {
      fontSize: "14px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);
    const sub = this.add.text(0, 10, "or click here / press ENTER", {
      fontSize: "10px", fontFamily: "monospace", color: "#aaffaa",
    }).setOrigin(0.5);
    bg.on("pointerover",  () => bg.setFillStyle(0x009900));
    bg.on("pointerout",   () => bg.setFillStyle(0x006600));
    bg.on("pointerdown",  () => this.sim.startCountdown());
    this.startBtn.add([bg, txt, sub]);
    this.input.keyboard!.on("keydown-ENTER", () => this.sim.startCountdown());
  }

  // ── Gauge geometry constants ──────────────────────────────────────────────
  private static readonly G_START = (150 * Math.PI) / 180;  // 8-o'clock start
  private static readonly G_SWEEP = (240 * Math.PI) / 180;  // 240° arc sweep
  private static readonly ARC_R   = 38;  // arc centre radius (px)
  private static readonly ARC_W   = 11;  // arc stroke width (px)
  private static readonly MAX_MPH = 200; // speedometer max

  /** Draw the static (non-updating) face of a round gauge. */
  private buildGaugeFace(
    cx: number, cy: number,
    numTicks: number,
    zones?: Array<{ low: number; high: number; color: number; alpha: number }>,
    arcR = RaceScene.ARC_R, arcW = RaceScene.ARC_W,
  ): void {
    const { G_START, G_SWEEP } = RaceScene;
    const ARC_R = arcR, ARC_W = arcW;
    const G_END = G_START + G_SWEEP;
    const g = this.add.graphics();

    // Subtle outer bezel ring
    g.lineStyle(2, 0x555555, 0.7);
    g.strokeCircle(cx, cy, ARC_R + 7);

    // Thin inner ring
    g.lineStyle(1, 0x333333, 0.5);
    g.strokeCircle(cx, cy, ARC_R - ARC_W - 3);

    // Background arc track
    g.lineStyle(ARC_W, 0x1c1c1c, 1);
    g.beginPath();
    g.arc(cx, cy, ARC_R, G_START, G_END, false);
    g.strokePath();

    // Coloured zone bands (e.g. launch windows on tach)
    if (zones) {
      for (const z of zones) {
        const aLow  = G_START + z.low  * G_SWEEP;
        const aHigh = G_START + z.high * G_SWEEP;
        g.lineStyle(ARC_W, z.color, z.alpha);
        g.beginPath();
        g.arc(cx, cy, ARC_R, aLow, aHigh, false);
        g.strokePath();
      }
    }

    // Tick marks (inside the arc track)
    for (let i = 0; i <= numTicks; i++) {
      const angle  = G_START + (i / numTicks) * G_SWEEP;
      const cos    = Math.cos(angle);
      const sin    = Math.sin(angle);
      const major  = (i % 2 === 0);
      const rInner = ARC_R - ARC_W + (major ? 1 : 3);
      const rOuter = ARC_R - 2;
      g.lineStyle(major ? 2 : 1, major ? 0xcccccc : 0x666666, 1);
      g.beginPath();
      g.moveTo(cx + cos * rInner, cy + sin * rInner);
      g.lineTo(cx + cos * rOuter, cy + sin * rOuter);
      g.strokePath();
    }

    // Small centre pivot dot
    g.fillStyle(0x444444, 1);
    g.fillCircle(cx, cy, 5);
    g.fillStyle(0x888888, 1);
    g.fillCircle(cx, cy, 2.5);
  }

  /** Redraw a gauge's fill arc each frame. */
  private drawGaugeFill(
    gfx: Phaser.GameObjects.Graphics,
    cx: number, cy: number,
    value: number, maxValue: number,
    color: number,
    arcR = RaceScene.ARC_R, arcW = RaceScene.ARC_W,
  ): void {
    const { G_START, G_SWEEP } = RaceScene;
    const ARC_R = arcR, ARC_W = arcW;
    gfx.clear();
    if (value <= 0) return;
    const frac     = Math.min(value / maxValue, 1);
    const endAngle = G_START + frac * G_SWEEP;
    // Soft glow ring
    gfx.lineStyle(ARC_W + 5, color, 0.18);
    gfx.beginPath();
    gfx.arc(cx, cy, ARC_R, G_START, endAngle, false);
    gfx.strokePath();
    // Main fill arc
    gfx.lineStyle(ARC_W, color, 1);
    gfx.beginPath();
    gfx.arc(cx, cy, ARC_R, G_START, endAngle, false);
    gfx.strokePath();
  }

  private buildHUD(W: number, H: number): void {
    const HUD_H = 110;
    this.gaugeY  = H - 60;
    const SPD_ARC_R = 50;
    const SPD_ARC_W = 13;
    // Shift button left edge = W - 80 - 155/2 = W - 157.5; place tachometer just left of it
    const TACH_BEZEL_R = SPD_ARC_R + 7; // 57px – same size as speedometer
    const gRpmX  = W - 157.5 - 8 - TACH_BEZEL_R;
    this.rpmGaugeX = gRpmX;
    // Throttle button right edge ≈ 80 + 155/2 = 157.5; place speedometer right next to it
    this.spdGaugeX   = 157 + 10 + SPD_ARC_R + 7; // gap + bezel radius
    const gSpdX      = this.spdGaugeX;
    const centX  = W / 2;

    // ── Panel background ──────────────────────────────────────────────────
    this.add.rectangle(0, H - HUD_H, W, HUD_H, 0x000000, 0.82).setOrigin(0, 0);
    // Top border with subtle gradient effect
    this.add.rectangle(0, H - HUD_H, W, 2, 0x333333).setOrigin(0, 0);
    this.add.rectangle(0, H - HUD_H + 2, W, 1, 0x1a1a1a).setOrigin(0, 0);

    // ── Right side gauge: RPM tachometer (just left of shift/nitro buttons) ─
    // Static zones: green = launch target, cyan/amber = shift target
    this.buildGaugeFace(gRpmX, this.gaugeY, 8, [
      // Launch zones (lower arc, ~47–73% of sweep)
      { low: LAUNCH_RPM_GOOD_LOW    / MAX_RPM, high: LAUNCH_RPM_GOOD_HIGH    / MAX_RPM, color: 0x448800, alpha: 0.45 },
      { low: LAUNCH_RPM_PERFECT_LOW / MAX_RPM, high: LAUNCH_RPM_PERFECT_HIGH / MAX_RPM, color: 0x00cc44, alpha: 0.65 },
      // Shift zones (upper arc, ~78–92% of sweep)
      { low: (SHIFT_RPM_IDEAL - SHIFT_RPM_GOOD_WINDOW)    / MAX_RPM, high: (SHIFT_RPM_IDEAL + SHIFT_RPM_GOOD_WINDOW)    / MAX_RPM, color: 0xffaa00, alpha: 0.30 },
      { low: (SHIFT_RPM_IDEAL - SHIFT_RPM_PERFECT_WINDOW) / MAX_RPM, high: (SHIFT_RPM_IDEAL + SHIFT_RPM_PERFECT_WINDOW) / MAX_RPM, color: 0x00ffcc, alpha: 0.55 },
    ], SPD_ARC_R, SPD_ARC_W);
    this.rpmGauge = this.add.graphics();

    // Gauge label
    this.add.text(gRpmX, H - 15, "TACH", {
      fontSize: "9px", fontFamily: "monospace", color: "#666666",
    }).setOrigin(0.5, 0.5);

    // Value text inside gauge
    this.rpmValText = this.add.text(gRpmX, this.gaugeY - 4, "0", {
      fontSize: "15px", fontFamily: "monospace", color: "#ff8844", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);
    this.add.text(gRpmX, this.gaugeY + 12, "RPM", {
      fontSize: "10px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0.5, 0.5);

    // ── Right gauge: speed ────────────────────────────────────────────────
    this.buildGaugeFace(gSpdX, this.gaugeY, 10, undefined, SPD_ARC_R, SPD_ARC_W);
    this.speedGauge = this.add.graphics();

    this.add.text(gSpdX, H - 15, "SPEED", {
      fontSize: "9px", fontFamily: "monospace", color: "#666666",
    }).setOrigin(0.5, 0.5);

    this.speedText = this.add.text(gSpdX, this.gaugeY - 4, "0", {
      fontSize: "15px", fontFamily: "monospace", color: "#44ccff", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);
    this.add.text(gSpdX, this.gaugeY + 12, "MPH", {
      fontSize: "10px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0.5, 0.5);

    // ── Centre: gear + timer + nitro ──────────────────────────────────────
    this.gearText = this.add.text(centX, H - 90, "GEAR  1", {
      fontSize: "14px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(0.5, 0.5);

    this.timerText = this.add.text(centX, H - 65, "0.000", {
      fontSize: "30px", fontFamily: "monospace", color: "#ffff44", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);

    // Nitro bar
    const nitroBarW = 120;
    const nitroBarX = centX - nitroBarW / 2;
    const nitroBarY = H - 30;
    this.add.text(centX - nitroBarW / 2 - 2, nitroBarY, "NITRO", {
      fontSize: "8px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(1, 0.5);
    this.add.rectangle(nitroBarX, nitroBarY, nitroBarW, 6, 0x1a1a1a).setOrigin(0, 0.5);
    this.add.rectangle(nitroBarX, nitroBarY, nitroBarW, 6, 0x003355, 0.6).setOrigin(0, 0.5);
    this.nitroFill = this.add.rectangle(nitroBarX, nitroBarY, nitroBarW, 4, 0x00aaff).setOrigin(0, 0.5);

    // ── Feedback overlay text ─────────────────────────────────────────────
    this.feedbackText = this.add.text(W / 2, H * 0.48, "", {
      fontSize: "34px", fontFamily: "monospace", color: "#ffffff",
      fontStyle: "bold", stroke: "#000", strokeThickness: 4,
    }).setOrigin(0.5).setVisible(false).setDepth(20);
  }

  private updateTree(ambersLit: number, greenLit: boolean, phase: RacePhase): void {
    this.redLight.setFillStyle(phase === RacePhase.Staging ? 0xff2200 : 0x330000);
    for (let i = 0; i < 3; i++) {
      this.amberLights[i].setFillStyle(i < ambersLit ? 0xffaa00 : 0x332200);
    }
    this.greenLight.setFillStyle(greenLit ? 0x00ff44 : 0x003300);
    if (phase !== RacePhase.Staging) this.startBtn.setVisible(false);
  }

  private updateHUD(state: ReturnType<RaceSimulation["getState"]>, p: typeof state.player): void {
    const isRacing   = state.phase === RacePhase.Racing;
    const canShift   = p.gear < 4;
    const atLimiter  = p.revLimiterActive;

    // Shift zone flags (only relevant during racing with shifts remaining)
    const shiftDelta        = Math.abs(p.rpm - SHIFT_RPM_IDEAL);
    const inPerfectShift    = isRacing && canShift && shiftDelta <= SHIFT_RPM_PERFECT_WINDOW;
    const inGoodShift       = isRacing && canShift && shiftDelta <= SHIFT_RPM_GOOD_WINDOW;
    const pastGoodShift     = isRacing && canShift && p.rpm > SHIFT_RPM_IDEAL + SHIFT_RPM_GOOD_WINDOW;

    // RPM gauge colour:
    //   Pre-launch  → launch zone colours (green = perfect, yellow-green = good, blue = too low, orange = too high)
    //   Racing      → shift zone colours  (cyan = perfect, yellow = good approach, orange/red = late/limiter)
    let rpmColor: number;
    if (atLimiter) {
      rpmColor = Math.floor(Date.now() / 80) % 2 === 0 ? 0xff0000 : 0xff6600;
    } else if (isRacing) {
      if (inPerfectShift) {
        rpmColor = 0x00ffcc;                                          // cyan  – SHIFT NOW
      } else if (inGoodShift) {
        rpmColor = p.rpm < SHIFT_RPM_IDEAL ? 0xffdd00 : 0xff9900;    // yellow approaching / amber past
      } else if (pastGoodShift) {
        rpmColor = 0xff3300;                                          // red-orange – late shift
      } else if (!canShift) {
        // Gear 4: colour builds from teal → orange as RPM rises toward limiter
        rpmColor = p.rpm > MAX_RPM - REV_LIMITER_WINDOW * 3 ? 0xff6600
          : p.rpm > 6000 ? 0x44ddaa
          : 0x44aaff;
      } else if (p.rpm > SHIFT_RPM_IDEAL - SHIFT_RPM_GOOD_WINDOW - 600) {
        rpmColor = 0xffaa00;                                          // amber – approaching good zone
      } else {
        rpmColor = 0x44aaff;                                          // blue – building RPM
      }
    } else {
      // Pre-launch: show launch window zones
      if (p.rpm >= LAUNCH_RPM_PERFECT_LOW && p.rpm <= LAUNCH_RPM_PERFECT_HIGH) {
        rpmColor = 0x00dd44;                                          // bright green – perfect launch
      } else if (p.rpm >= LAUNCH_RPM_GOOD_LOW && p.rpm <= LAUNCH_RPM_GOOD_HIGH) {
        rpmColor = 0xaadd00;                                          // yellow-green – good launch
      } else if (p.rpm > LAUNCH_RPM_GOOD_HIGH) {
        rpmColor = 0xff6600;                                          // orange – wheelspin risk
      } else {
        rpmColor = 0x4488ff;                                          // blue – too low (bog risk)
      }
    }

    this.drawGaugeFill(this.rpmGauge, this.rpmGaugeX, this.gaugeY, p.rpm, MAX_RPM, rpmColor, 50, 13);
    // Text colour matches the gauge colour for consistency
    const rpmHex = `#${rpmColor.toString(16).padStart(6, "0")}`;
    this.rpmValText.setText(`${Math.round(p.rpm)}`).setColor(rpmHex);

    const mph = Math.round(p.speed * 2.237);
    const spdColor = mph > 150 ? 0xffffff : mph > 80 ? 0x44ddff : 0x0088cc;
    this.drawGaugeFill(this.speedGauge, this.spdGaugeX, this.gaugeY, mph, RaceScene.MAX_MPH, spdColor, 50, 13);
    this.speedText.setText(`${mph}`).setColor(mph > 150 ? "#ffffff" : "#44ccff");

    // Gear text: cyan in perfect zone, yellow in good zone, red at limiter
    this.gearText.setText(`GEAR  ${p.gear}`)
      .setColor(inPerfectShift ? "#00ffcc" : inGoodShift ? "#ffdd00" : atLimiter ? "#ff4422" : "#aaaaaa");

    if (state.phase === RacePhase.Racing) {
      this.timerText.setText(state.elapsed.toFixed(3));
    } else if (state.phase === RacePhase.Finished) {
      this.timerText.setText(p.finishTime > 0 ? p.finishTime.toFixed(3) : "DNF");
    }

    const nitroBarW = 120;
    this.nitroFill.width = (p.nitroRemaining / NITRO_DURATION) * nitroBarW;
    this.nitroFill.setFillStyle(p.nitroActive ? 0x00ffff : 0x0066aa);
  }

  private showFeedback(text: string, colour: string): void {
    this.feedbackText.setText(text).setColor(colour).setVisible(true);
    this.feedbackTimer = 1.2;
    this.tweens.add({
      targets: this.feedbackText,
      scaleX: { from: 1.4, to: 1 }, scaleY: { from: 1.4, to: 1 },
      duration: 200, ease: "Back.easeOut",
    });
  }

  private buildTouchControls(w: number, h: number): void {
    if (!this.sys.game.device.input.touch) return;
    const depth = 20;

    interface BtnHandle {
      setPressed: (pressed: boolean) => void;
    }

    const makeBtn = (
      x: number, y: number, bw: number, bh: number,
      colour: number, icon: string, label: string, sublabel: string,
    ): BtnHandle => {
      const r = Math.min(24, bh * 0.3);
      const gfx = this.add.graphics().setDepth(depth);

      const draw = (pressed: boolean) => {
        gfx.clear();
        // Drop shadow
        gfx.fillStyle(0x000000, 0.35);
        gfx.fillRoundedRect(x - bw / 2 + 4, y - bh / 2 + 5, bw, bh, r);
        // Button body
        gfx.fillStyle(colour, pressed ? 0.72 : 0.32);
        gfx.fillRoundedRect(x - bw / 2, y - bh / 2, bw, bh, r);
        // Inner highlight (gloss strip)
        gfx.fillStyle(0xffffff, pressed ? 0.06 : 0.18);
        gfx.fillRoundedRect(
          x - bw / 2 + 8, y - bh / 2 + 8,
          bw - 16, bh * 0.38,
          { tl: r - 6, tr: r - 6, bl: 4, br: 4 },
        );
        // Coloured border
        gfx.lineStyle(pressed ? 3 : 2, colour, pressed ? 1.0 : 0.65);
        gfx.strokeRoundedRect(x - bw / 2, y - bh / 2, bw, bh, r);
      };

      draw(false);

      // Icon above label
      if (icon) {
        this.add.text(x, y - (sublabel ? 22 : 14), icon, {
          fontSize: "22px", fontFamily: "monospace",
        }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.9);
      }
      const labelY = icon ? y + (sublabel ? 0 : 8) : (sublabel ? y - 10 : y);
      this.add.text(x, labelY, label, {
        fontSize: "14px", fontFamily: "monospace",
        color: "#ffffff", fontStyle: "bold",
      }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.95);
      if (sublabel) {
        this.add.text(x, y + (icon ? 18 : 14), sublabel, {
          fontSize: "11px", fontFamily: "monospace", color: "#ccdeff",
        }).setOrigin(0.5).setDepth(depth + 1).setAlpha(0.7);
      }

      return { setPressed: draw };
    };

    // Left thumb: big throttle button
    const throttle = makeBtn(80, h * 0.82, 155, h * 0.3, 0x3366ff, "▲", "THROTTLE", "HOLD");

    // Right thumb: shift (top) + nitro (bottom)
    const shift = makeBtn(w - 80, h * 0.71, 155, h * 0.16, 0xffaa00, "◆", "SHIFT", "TAP");
    const nitro = makeBtn(w - 80, h * 0.89, 155, h * 0.16, 0x00ccff, "★", "NITRO", "HOLD");

    // Button hit areas in game coordinates (center x/y, width, height)
    const throttleArea = { cx: 80,      cy: h * 0.82, bw: 155, bh: h * 0.3  };
    const shiftArea    = { cx: w - 80,  cy: h * 0.71, bw: 155, bh: h * 0.16 };
    const nitroArea    = { cx: w - 80,  cy: h * 0.89, bw: 155, bh: h * 0.16 };

    const hitTest = (gx: number, gy: number, a: typeof throttleArea) =>
      gx >= a.cx - a.bw / 2 && gx <= a.cx + a.bw / 2 &&
      gy >= a.cy - a.bh / 2 && gy <= a.cy + a.bh / 2;

    // Convert a browser Touch to game-space coordinates accounting for canvas scaling
    const canvas = this.sys.game.canvas;
    const toGame = (touch: Touch): { x: number; y: number } => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: (touch.clientX - rect.left) * (w / rect.width),
        y: (touch.clientY - rect.top)  * (h / rect.height),
      };
    };

    // Track active touch identifiers per hold-button so multi-touch works correctly
    const throttleTouches = new Set<number>();
    const nitroTouches    = new Set<number>();

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        const { x, y } = toGame(t);
        if (hitTest(x, y, throttleArea)) {
          throttleTouches.add(t.identifier);
          this.touchThrottle = true;
          throttle.setPressed(true);
        }
        if (hitTest(x, y, shiftArea)) {
          this.touchShiftEdge = true;
          shift.setPressed(true);
          this.time.delayedCall(150, () => shift.setPressed(false));
        }
        if (hitTest(x, y, nitroArea)) {
          nitroTouches.add(t.identifier);
          this.touchNitro = true;
          nitro.setPressed(true);
        }
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (const t of Array.from(e.changedTouches)) {
        throttleTouches.delete(t.identifier);
        nitroTouches.delete(t.identifier);
      }
      if (throttleTouches.size === 0) { this.touchThrottle = false; throttle.setPressed(false); }
      if (nitroTouches.size === 0)    { this.touchNitro    = false; nitro.setPressed(false); }
    };

    canvas.addEventListener("touchstart",  onTouchStart, { passive: false });
    canvas.addEventListener("touchend",    onTouchEnd,   { passive: false });
    canvas.addEventListener("touchcancel", onTouchEnd,   { passive: false });

    // Remove listeners when this scene shuts down to prevent leaks
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      canvas.removeEventListener("touchstart",  onTouchStart);
      canvas.removeEventListener("touchend",    onTouchEnd);
      canvas.removeEventListener("touchcancel", onTouchEnd);
    });
  }
}
