/**
 * Car definitions: name, tagline, stats (1-5 ratings) and the derived
 * physics configuration that those stats map to.
 *
 * Stats:
 *   power  – engine torque → raw acceleration force
 *   weight – 5 = lightest → best power-to-weight ratio
 *   grip   – launch window width + wheelspin penalty
 *   shift  – gear-shift timing forgiveness (±RPM windows)
 *   aero   – aerodynamic efficiency → lower drag at speed
 */

import { CarType } from "../graphics/CarSprites";
import { CarStats, CarPhysicsConfig } from "../types";

export interface CarEntry {
  type:    CarType;
  name:    string;
  tagline: string;
  stats:   CarStats;
  physics: CarPhysicsConfig;
}

// ─── Stat → physics lookup tables ─────────────────────────────────────────────

/** Engine torque (Nm) indexed by power stat (stat - 1) */
const POWER_TORQUE = [280, 350, 420, 520, 640] as const;

/** Car mass (kg) indexed by weight stat — higher stat = lighter car (stat - 1) */
const WEIGHT_MASS = [1600, 1450, 1200, 980, 780] as const;

/** Aerodynamic drag coefficient indexed by aero stat (stat - 1) */
const AERO_DRAG_COEFF = [0.50, 0.38, 0.28, 0.20, 0.13] as const;

/** Launch window + traction parameters indexed by grip stat (stat - 1) */
const GRIP_MAP = [
  // grip 1 – almost no traction, tiny launch window
  { perfectLow: 5000, perfectHigh: 5200, goodLow: 4600, goodHigh: 5800, wheelspinPenalty: 0.50, bogPenalty: 0.57 },
  // grip 2 – narrow window, prone to wheelspin
  { perfectLow: 4900, perfectHigh: 5400, goodLow: 4300, goodHigh: 6000, wheelspinPenalty: 0.58, bogPenalty: 0.63 },
  // grip 3 – stock baseline
  { perfectLow: 4800, perfectHigh: 5600, goodLow: 4000, goodHigh: 6200, wheelspinPenalty: 0.65, bogPenalty: 0.68 },
  // grip 4 – wide window, traction control feel
  { perfectLow: 4600, perfectHigh: 5800, goodLow: 3800, goodHigh: 6400, wheelspinPenalty: 0.73, bogPenalty: 0.74 },
  // grip 5 – very forgiving, best traction
  { perfectLow: 4400, perfectHigh: 6000, goodLow: 3600, goodHigh: 6600, wheelspinPenalty: 0.80, bogPenalty: 0.82 },
] as const;

/** Shift window (±RPM around ideal) indexed by shift stat (stat - 1) */
const SHIFT_MAP = [
  { perfectWindow:  80, goodWindow:  280 }, // shift 1 – razor narrow
  { perfectWindow: 140, goodWindow:  440 }, // shift 2 – tight
  { perfectWindow: 200, goodWindow:  600 }, // shift 3 – stock baseline
  { perfectWindow: 300, goodWindow:  800 }, // shift 4 – forgiving
  { perfectWindow: 400, goodWindow: 1050 }, // shift 5 – very forgiving
] as const;

function buildPhysics(s: CarStats): CarPhysicsConfig {
  const g = GRIP_MAP[s.grip - 1];
  const h = SHIFT_MAP[s.shift - 1];
  return {
    torqueNm:           POWER_TORQUE[s.power  - 1],
    massKg:             WEIGHT_MASS[s.weight  - 1],
    aeroDragCoeff:      AERO_DRAG_COEFF[s.aero - 1],
    wheelspinPenalty:   g.wheelspinPenalty,
    bogPenalty:         g.bogPenalty,
    launchPerfectLow:   g.perfectLow,
    launchPerfectHigh:  g.perfectHigh,
    launchGoodLow:      g.goodLow,
    launchGoodHigh:     g.goodHigh,
    shiftPerfectWindow: h.perfectWindow,
    shiftGoodWindow:    h.goodWindow,
  };
}

// ─── Car definitions ──────────────────────────────────────────────────────────

const RAW: Array<{ type: CarType; name: string; tagline: string; stats: CarStats }> = [
  // ── Balanced / Beginner-friendly ──────────────────────────────────────────
  {
    type: "silver", name: "SILBER DREIER", tagline: "The Bavarian sport sedan",
    stats: { power: 3, weight: 3, grip: 3, shift: 4, aero: 3 },
  },
  {
    type: "gray_roadster", name: "PEWTER SPYDER", tagline: "Open-air Stuttgart precision",
    stats: { power: 3, weight: 4, grip: 4, shift: 5, aero: 3 },
  },
  {
    type: "orange_supra", name: "TANGERINE SHOGUN", tagline: "Inline-six JDM warrior",
    stats: { power: 3, weight: 3, grip: 3, shift: 5, aero: 3 },
  },
  {
    type: "red_rx7", name: "CRIMSON HELIX 7", tagline: "Rotary-spinning JDM icon",
    stats: { power: 3, weight: 4, grip: 3, shift: 5, aero: 3 },
  },
  // ── Lightweight specialists ───────────────────────────────────────────────
  {
    type: "yellow_lotus", name: "CITRINE ELARA", tagline: "Featherweight corner scalpel",
    stats: { power: 2, weight: 5, grip: 5, shift: 5, aero: 2 },
  },
  {
    type: "red_roadster", name: "CRIMSON BARCHETTA", tagline: "Italian open-top elegance",
    stats: { power: 2, weight: 5, grip: 3, shift: 4, aero: 3 },
  },
  // ── Mid-engine GT ─────────────────────────────────────────────────────────
  {
    type: "red", name: "SCARLET ACHT", tagline: "Mid-engine Germanic fury",
    stats: { power: 4, weight: 3, grip: 4, shift: 4, aero: 3 },
  },
  {
    type: "red_hyper", name: "ROSSO CAVALLO HY", tagline: "Hybrid prancing horse",
    stats: { power: 5, weight: 3, grip: 4, shift: 4, aero: 4 },
  },
  {
    type: "blue_gt40", name: "INDIGO APEX 40", tagline: "Le Mans endurance legend",
    stats: { power: 4, weight: 4, grip: 3, shift: 3, aero: 4 },
  },
  {
    type: "blue_porsche", name: "COBALT BOXER GT", tagline: "Flat-six Stuttgart hypercar",
    stats: { power: 4, weight: 4, grip: 5, shift: 5, aero: 4 },
  },
  // ── Supercars ─────────────────────────────────────────────────────────────
  {
    type: "green", name: "VERDE GALLETTO", tagline: "Baby bull with a big bite",
    stats: { power: 5, weight: 3, grip: 3, shift: 3, aero: 4 },
  },
  {
    type: "orange", name: "AMBER EXTREMA", tagline: "Track weapon, zero compromise",
    stats: { power: 5, weight: 3, grip: 4, shift: 3, aero: 4 },
  },
  {
    type: "red_f40", name: "ROSSO QUARANTA", tagline: "Twin-turbo Italian legend",
    stats: { power: 5, weight: 3, grip: 2, shift: 3, aero: 3 },
  },
  {
    type: "lime_super", name: "ACID TORO", tagline: "Raging V12 Italian bull",
    stats: { power: 5, weight: 2, grip: 3, shift: 2, aero: 4 },
  },
  // ── American muscle ───────────────────────────────────────────────────────
  {
    type: "blue_cobra", name: "AZURE MAMBA", tagline: "Classic American serpent",
    stats: { power: 4, weight: 2, grip: 1, shift: 2, aero: 2 },
  },
  {
    type: "blue_viper", name: "COBALT ANACONDA", tagline: "V10 American predator",
    stats: { power: 5, weight: 2, grip: 2, shift: 2, aero: 3 },
  },
  {
    type: "yellow_muscle", name: "SOLAR PONY", tagline: "American V8 pony car",
    stats: { power: 4, weight: 2, grip: 1, shift: 3, aero: 2 },
  },
  // ── Hypercars ─────────────────────────────────────────────────────────────
  {
    type: "black_hyper", name: "PHANTOM SEIZE", tagline: "W16 French hypermachine",
    stats: { power: 5, weight: 2, grip: 3, shift: 4, aero: 5 },
  },
  {
    type: "dark_hyper", name: "NORDIC WRAITH", tagline: "Scandinavian speed phantom",
    stats: { power: 5, weight: 3, grip: 3, shift: 3, aero: 5 },
  },
  {
    type: "orange_mclaren", name: "COPPER APEX ONE", tagline: "F1-derived speed icon",
    stats: { power: 5, weight: 4, grip: 3, shift: 4, aero: 5 },
  },
  {
    type: "white_proto", name: "IVORY VALKYRE", tagline: "Aero-sculpted track demon",
    stats: { power: 4, weight: 5, grip: 4, shift: 4, aero: 5 },
  },
];

// ─── Public exports ───────────────────────────────────────────────────────────

export const CAR_DATA: CarEntry[] = RAW.map(c => ({ ...c, physics: buildPhysics(c.stats) }));

export const CAR_MAP = new Map<CarType, CarEntry>(CAR_DATA.map(c => [c.type, c]));

export function getCarPhysicsConfig(type: string): CarPhysicsConfig {
  return CAR_MAP.get(type as CarType)?.physics ?? CAR_DATA[0].physics;
}
