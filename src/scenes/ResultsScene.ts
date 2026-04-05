import Phaser from "phaser";
import { RaceResult, ShiftGrade, LaunchGrade } from "../types";
import { CarType } from "../graphics/CarSprites";

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

function gradeLabel(grade: LaunchGrade): string {
  switch (grade) {
    case LaunchGrade.Perfect:   return "PERFECT LAUNCH";
    case LaunchGrade.Good:      return "GOOD LAUNCH";
    case LaunchGrade.Bog:       return "BOG (too slow)";
    case LaunchGrade.Wheelspin: return "WHEELSPIN (too hot)";
  }
}

export class ResultsScene extends Phaser.Scene {
  constructor() {
    super({ key: "ResultsScene" });
  }

  create(data: { result: RaceResult; carType?: CarType }): void {
    const { result, carType = "silver" } = data;
    const { width, height } = this.scale;
    const cx = width / 2;

    // ── Background ─────────────────────────────────────────────────────────
    this.add.rectangle(0, 0, width, height, 0x0a0a0a).setOrigin(0, 0);

    // ── Win / Loss banner ──────────────────────────────────────────────────
    const bannerColour = result.playerWon ? 0xff8800 : 0x330000;
    this.add.rectangle(cx, 60, width, 100, bannerColour).setAlpha(0.5);

    const winText = result.playerWon ? "WINNER!" : "DEFEAT";
    const winColour = result.playerWon ? "#ffdd00" : "#ff4444";

    this.add.text(cx, 60, winText, {
      fontSize: "56px",
      fontFamily: "monospace",
      color: winColour,
      fontStyle: "bold",
      stroke: "#000",
      strokeThickness: 6,
    }).setOrigin(0.5);

    // ── Times ──────────────────────────────────────────────────────────────
    let y = 140;

    const timeColour = result.playerWon ? "#00ff88" : "#ffffff";
    this.add.text(cx, y, `YOUR TIME:  ${result.playerTime > 0 ? result.playerTime.toFixed(3) + "s" : "DNF"}`, {
      fontSize: "26px", fontFamily: "monospace", color: timeColour,
    }).setOrigin(0.5);

    y += 36;
    this.add.text(cx, y, `CPU TIME:   ${result.opponentTime > 0 ? result.opponentTime.toFixed(3) + "s" : "DNF"}`, {
      fontSize: "20px", fontFamily: "monospace", color: "#aaaaaa",
    }).setOrigin(0.5);

    y += 30;
    if (result.isNewBest) {
      this.add.text(cx, y, `NEW BEST TIME!`, {
        fontSize: "22px", fontFamily: "monospace", color: "#ffff00",
        fontStyle: "bold",
      }).setOrigin(0.5);
      // Sparkle tween
      this.tweens.add({
        targets: this.children.last as Phaser.GameObjects.Text,
        alpha: { from: 0.4, to: 1 },
        yoyo: true, repeat: -1, duration: 400,
      });
    } else {
      this.add.text(cx, y, `BEST TIME:  ${result.bestTime < Infinity ? result.bestTime.toFixed(3) + "s" : "N/A"}`, {
        fontSize: "18px", fontFamily: "monospace", color: "#666666",
      }).setOrigin(0.5);
    }

    // ── Divider ────────────────────────────────────────────────────────────
    y += 44;
    this.add.rectangle(cx, y, width * 0.7, 2, 0x444444);

    // ── Launch grade ──────────────────────────────────────────────────────
    y += 24;
    this.add.text(cx, y, "LAUNCH", {
      fontSize: "14px", fontFamily: "monospace", color: "#888888",
    }).setOrigin(0.5);

    y += 24;
    this.add.text(cx, y, gradeLabel(result.launchGrade), {
      fontSize: "20px", fontFamily: "monospace",
      color: gradeColour(result.launchGrade),
      fontStyle: "bold",
    }).setOrigin(0.5);

    // ── Shift grades ──────────────────────────────────────────────────────
    y += 38;
    this.add.text(cx, y, "SHIFTS", {
      fontSize: "14px", fontFamily: "monospace", color: "#888888",
    }).setOrigin(0.5);

    if (result.shiftEvents.length === 0) {
      y += 24;
      this.add.text(cx, y, "No shifts recorded", {
        fontSize: "16px", fontFamily: "monospace", color: "#555555",
      }).setOrigin(0.5);
    } else {
      result.shiftEvents.forEach((ev) => {
        y += 26;
        const shiftLabel = `Gear ${ev.gear}  –  ${Math.round(ev.rpm)} RPM  –  ${ev.grade}`;
        this.add.text(cx, y, shiftLabel, {
          fontSize: "16px", fontFamily: "monospace",
          color: gradeColour(ev.grade),
        }).setOrigin(0.5);
      });
    }

    // ── Buttons ────────────────────────────────────────────────────────────
    const btnY = height - 70;

    // Retry
    const retryBg = this.add.rectangle(cx - 90, btnY, 160, 48, 0xff4400)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx - 90, btnY, "RETRY", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    retryBg.on("pointerover", () => retryBg.setFillStyle(0xff6622));
    retryBg.on("pointerout",  () => retryBg.setFillStyle(0xff4400));
    retryBg.on("pointerdown", () => this.scene.start("RaceScene", { carType }));

    // Menu
    const menuBg = this.add.rectangle(cx + 90, btnY, 160, 48, 0x224488)
      .setInteractive({ useHandCursor: true });
    this.add.text(cx + 90, btnY, "MENU", {
      fontSize: "22px", fontFamily: "monospace", color: "#ffffff", fontStyle: "bold",
    }).setOrigin(0.5);

    menuBg.on("pointerover", () => menuBg.setFillStyle(0x336699));
    menuBg.on("pointerout",  () => menuBg.setFillStyle(0x224488));
    menuBg.on("pointerdown", () => this.scene.start("CarSelectionScene"));

    // Keyboard shortcuts
    this.input.keyboard!.once("keydown-R",   () => this.scene.start("RaceScene", { carType }));
    this.input.keyboard!.once("keydown-ESC", () => this.scene.start("CarSelectionScene"));

    // Hint
    this.add.text(cx, height - 20, "R = Retry   ESC = Menu", {
      fontSize: "13px", fontFamily: "monospace", color: "#555555",
    }).setOrigin(0.5);
  }
}
