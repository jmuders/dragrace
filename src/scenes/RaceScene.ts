import Phaser from "phaser";
import { RaceSimulation } from "../simulation/RaceSimulation";
import { RacePhase, ShiftGrade, LaunchGrade } from "../types";
import {
  QUARTER_MILE_METERS, MAX_RPM, NITRO_DURATION,
  LAUNCH_RPM_GOOD_LOW, LAUNCH_RPM_GOOD_HIGH,
  LAUNCH_RPM_PERFECT_LOW, LAUNCH_RPM_PERFECT_HIGH,
} from "../constants";
import { createCarTexture } from "../graphics/CarSprites";

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
const PLAYER_LANE_Y = 210;
const CPU_LANE_Y    = 380;

export class RaceScene extends Phaser.Scene {
  private sim!: RaceSimulation;

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

  private speedLines: Phaser.GameObjects.Rectangle[] = [];

  private amberLights:    Phaser.GameObjects.Arc[] = [];
  private greenLight!:    Phaser.GameObjects.Arc;
  private redLight!:      Phaser.GameObjects.Arc;
  private treeContainer!: Phaser.GameObjects.Container;
  private startBtn!:      Phaser.GameObjects.Container;

  private rpmFill!:      Phaser.GameObjects.Rectangle;
  private rpmNeedle!:    Phaser.GameObjects.Text;
  private speedText!:    Phaser.GameObjects.Text;
  private gearText!:     Phaser.GameObjects.Text;
  private timerText!:    Phaser.GameObjects.Text;
  private nitroFill!:    Phaser.GameObjects.Rectangle;
  private feedbackText!: Phaser.GameObjects.Text;
  private feedbackTimer = 0;

  private finishLineGfx!: Phaser.GameObjects.Graphics;

  constructor() { super({ key: "RaceScene" }); }

  create(): void {
    this.sim = new RaceSimulation();
    this.shiftEdge = false;
    this.feedbackTimer = 0;
    this.laneOffset = 0;
    this.bgClouds = [];
    this.bgTrees = [];
    this.laneMarkings = [];
    this.speedLines = [];
    this.amberLights = [];

    const { width: W, height: H } = this.scale;
    const playerKey = createCarTexture(this, "silver");
    const cpuKey    = createCarTexture(this, "orange");

    this.buildBackground(W, H);
    this.buildTrack(W, H);
    this.buildFinishLine(H);
    this.buildCars(playerKey, cpuKey);
    this.buildSpeedLines();
    this.buildCountdownTree(W, H);
    this.buildHUD(W, H);
    this.buildStartButton(W, H);
    this.buildTouchControls(W, H);

    const kbd = this.input.keyboard!;
    this.keyThrottle    = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keyThrottleAlt = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.W);
    this.keyShift       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.S);
    this.keyNitro       = kbd.addKey(Phaser.Input.Keyboard.KeyCodes.N);
  }

  update(_t: number, deltaMs: number): void {
    const dt = Math.min(deltaMs / 1000, 0.05);

    const shiftJust = Phaser.Input.Keyboard.JustDown(this.keyShift);
    if (shiftJust || this.touchShiftEdge) this.shiftEdge = true;
    this.touchShiftEdge = false;

    const throttle = this.keyThrottle.isDown || this.keyThrottleAlt.isDown || this.touchThrottle;
    const nitro    = this.keyNitro.isDown || this.touchNitro;

    const simShifted = this.sim.update({ throttle, shift: this.shiftEdge, nitro }, dt);
    this.shiftEdge = false;

    const state = this.sim.getState();
    const p = state.player;
    const c = state.opponent;

    this.playerSprite.x = TRACK_START_X + (p.distance / QUARTER_MILE_METERS) * TRACK_WIDTH;
    this.cpuSprite.x    = TRACK_START_X + (c.distance / QUARTER_MILE_METERS) * TRACK_WIDTH;

    if (state.phase === RacePhase.Racing && throttle) {
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

    const showLines = state.phase === RacePhase.Racing && p.speed > 20;
    this.speedLines.forEach((r, i) => {
      r.setVisible(showLines);
      if (showLines) {
        const len = p.speed * 3 + (p.nitroActive ? 80 : 0);
        r.width = len;
        r.x = this.playerSprite.x - len - 10 - (i % 3) * 20;
        r.alpha = 0.25 + Math.random() * 0.2;
      }
    });

    if (p.nitroActive) {
      this.playerSprite.x += (Math.random() - 0.5) * 2;
      this.playerSprite.y += (Math.random() - 0.5) * 1.5;
    } else {
      this.playerSprite.y = PLAYER_LANE_Y;
    }

    this.updateTree(state.countdown.ambersLit, state.countdown.greenLit, state.phase);
    this.updateHUD(state, p);

    if (simShifted && this.sim.lastShiftEvent) {
      const ev = this.sim.lastShiftEvent;
      this.showFeedback(`SHIFT  ${ev.grade}`, gradeColour(ev.grade));
    }
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedbackText.setVisible(false);
    }

    if (this.sim.isFinished()) {
      this.scene.start("ResultsScene", { result: this.sim.buildResult() });
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
    const trackH = 280;
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
      .setOrigin(0.5, 0.7).setScale(1.8);
    this.cpuSprite = this.add.image(TRACK_START_X, CPU_LANE_Y, cpuKey)
      .setOrigin(0.5, 0.7).setScale(1.8);
  }

  private buildSpeedLines(): void {
    for (const dy of [-22, -10, 2, 14, -28, 20]) {
      this.speedLines.push(
        this.add.rectangle(0, PLAYER_LANE_Y + dy, 60, 2, 0xffffff, 0.35)
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
    const bg = this.add.rectangle(0, 0, 220, 42, 0x006600)
      .setInteractive({ useHandCursor: true });
    const txt = this.add.text(0, 0, "STAGE & START", {
      fontSize: "18px", fontFamily: "monospace", color: "#ffffff",
    }).setOrigin(0.5);
    bg.on("pointerover",  () => bg.setFillStyle(0x009900));
    bg.on("pointerout",   () => bg.setFillStyle(0x006600));
    bg.on("pointerdown",  () => this.sim.startCountdown());
    this.startBtn.add([bg, txt]);
    this.input.keyboard!.once("keydown-ENTER", () => this.sim.startCountdown());
  }

  private buildHUD(W: number, H: number): void {
    const hudY = H - 46;
    this.add.rectangle(0, H - 80, W, 80, 0x000000, 0.7).setOrigin(0, 0);
    this.add.rectangle(0, H - 80, W, 2, 0x444444).setOrigin(0, 0);

    this.add.text(20, H - 76, "RPM", { fontSize: "12px", fontFamily: "monospace", color: "#888888" });
    this.add.rectangle(20, hudY - 10, 220, 16, 0x222222).setOrigin(0, 0.5);

    const barW = 220;
    const goodLow  = (LAUNCH_RPM_GOOD_LOW  / MAX_RPM) * barW;
    const goodHigh = (LAUNCH_RPM_GOOD_HIGH / MAX_RPM) * barW;
    const perfLow  = (LAUNCH_RPM_PERFECT_LOW  / MAX_RPM) * barW;
    const perfHigh = (LAUNCH_RPM_PERFECT_HIGH / MAX_RPM) * barW;
    this.add.rectangle(20 + goodLow, hudY - 10, goodHigh - goodLow, 16, 0x448800, 0.35).setOrigin(0, 0.5);
    this.add.rectangle(20 + perfLow, hudY - 10, perfHigh - perfLow, 16, 0x00ff44, 0.45).setOrigin(0, 0.5);

    this.rpmFill = this.add.rectangle(20, hudY - 10, 0, 12, 0xff4400).setOrigin(0, 0.5);
    this.rpmNeedle = this.add.text(248, hudY - 10, "0 RPM", {
      fontSize: "13px", fontFamily: "monospace", color: "#ffaa00",
    }).setOrigin(0, 0.5);

    this.gearText = this.add.text(W / 2, hudY - 16, "GEAR  1", {
      fontSize: "20px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5, 0.5);
    this.speedText = this.add.text(W / 2, hudY + 8, "0 MPH", {
      fontSize: "16px", fontFamily: "monospace", color: "#88ddff",
    }).setOrigin(0.5, 0.5);

    this.timerText = this.add.text(W - 20, hudY - 14, "0.000", {
      fontSize: "26px", fontFamily: "monospace", color: "#ffff44", fontStyle: "bold",
    }).setOrigin(1, 0.5);

    this.add.text(W - 20, hudY + 12, "NITRO", { fontSize: "11px", fontFamily: "monospace", color: "#aaaaaa" }).setOrigin(1, 0.5);
    this.add.rectangle(W - 100, hudY + 26, 80, 8, 0x222222).setOrigin(0, 0.5);
    this.nitroFill = this.add.rectangle(W - 100, hudY + 26, 80, 6, 0x00ccff).setOrigin(0, 0.5);

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
    const rpmFrac = Math.min(p.rpm / MAX_RPM, 1);
    this.rpmFill.width = rpmFrac * 220;
    this.rpmFill.setFillStyle(p.rpm > 7500 ? 0xff0000 : p.rpm > 5500 ? 0xff8800 : 0xff4400);
    this.rpmNeedle.setText(`${Math.round(p.rpm)} RPM`);
    this.speedText.setText(`${Math.round(p.speed * 2.237)} MPH`);
    this.gearText.setText(`GEAR  ${p.gear}`);
    if (state.phase === RacePhase.Racing) {
      this.timerText.setText(state.elapsed.toFixed(3));
    } else if (state.phase === RacePhase.Finished) {
      this.timerText.setText(p.finishTime > 0 ? p.finishTime.toFixed(3) : "DNF");
    }
    this.nitroFill.width = (p.nitroRemaining / NITRO_DURATION) * 80;
    this.nitroFill.setFillStyle(p.nitroActive ? 0x00ffff : 0x0088cc);
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
    const makeBtn = (
      x: number, y: number, bw: number, bh: number,
      colour: number, label: string, sublabel: string,
    ): Phaser.GameObjects.Rectangle => {
      const bg = this.add.rectangle(x, y, bw, bh, colour)
        .setAlpha(0.18).setInteractive().setDepth(depth);
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
    const throttleBg = makeBtn(75, h * 0.82, 140, h * 0.28, 0x2255ff, "THROTTLE", "HOLD");
    throttleBg.on("pointerdown", () => { this.touchThrottle = true;  throttleBg.setAlpha(0.4); });
    throttleBg.on("pointerup",   () => { this.touchThrottle = false; throttleBg.setAlpha(0.18); });
    throttleBg.on("pointerout",  () => { this.touchThrottle = false; throttleBg.setAlpha(0.18); });
    const shiftBg = makeBtn(w - 75, h * 0.72, 140, h * 0.14, 0xffaa00, "SHIFT", "TAP");
    shiftBg.on("pointerdown", () => {
      this.touchShiftEdge = true;
      shiftBg.setAlpha(0.55);
      this.time.delayedCall(130, () => shiftBg.setAlpha(0.18));
    });
    const nitroBg = makeBtn(w - 75, h * 0.88, 140, h * 0.14, 0x00ccff, "NITRO", "HOLD");
    nitroBg.on("pointerdown", () => { this.touchNitro = true;  nitroBg.setAlpha(0.4); });
    nitroBg.on("pointerup",   () => { this.touchNitro = false; nitroBg.setAlpha(0.18); });
    nitroBg.on("pointerout",  () => { this.touchNitro = false; nitroBg.setAlpha(0.18); });
  }
}
