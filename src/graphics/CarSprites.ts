/**
 * Pixel-art car texture generator.
 *
 * Draws each car type into a Phaser RenderTexture so it can be used as a
 * normal sprite. Each "pixel" in the art grid is drawn as a 4×4 square.
 *
 * Cars face RIGHT (front on the right, rear/tail on the left).
 * Approximate size: 40×18 art pixels → 160×72 rendered pixels.
 */

const PX = 4; // pixels per art-grid cell

// ─── Palette entries (ARGB packed for Phaser Graphics) ────────────────────────
// We'll use a draw-calls approach instead of pixel buffers, since Phaser
// Graphics.fillRect is simpler than raw texture writing.

type Color = number; // 0xRRGGBB

interface CarDef {
  /** Width in art pixels */
  w: number;
  /** Height in art pixels */
  h: number;
  /**
   * Rows of [x, y, w, h, color] draw commands relative to the art grid.
   * Each unit is 1 art pixel; rendered at PX scale.
   */
  rects: Array<[number, number, number, number, Color]>;
}

// ─── Silver BMW M3-style sedan ─────────────────────────────────────────────────

const SILVER_SEDAN: CarDef = {
  w: 40, h: 18,
  rects: [
    // ── Spoiler (rear/left) ──────────────────────────────────────
    [1, 4, 4, 1, 0x999999],

    // ── Roof ────────────────────────────────────────────────────
    [7,  2, 18, 1, 0xbbbbbb],
    [5,  3, 22, 1, 0xcccccc],
    [5,  4, 22, 2, 0xd0d0d0],

    // ── Windows ──────────────────────────────────────────────────
    [6,  3,  8, 3, 0x4a5f78],   // rear window
    [15, 3, 10, 3, 0x5a7090],   // front window

    // ── Window divider ────────────────────────────────────────────
    [14, 3,  1, 3, 0x222222],

    // ── Body (main) ──────────────────────────────────────────────
    [2,  6, 36, 4, 0xd4d4d4],   // mid body
    [1,  7, 38, 3, 0xcccccc],
    [0,  8, 40, 2, 0xc0c0c0],

    // ── Lower body panel ─────────────────────────────────────────
    [1, 10, 38, 1, 0x888888],
    [2, 11, 36, 1, 0x666666],

    // ── Taillights (rear/left) ────────────────────────────────────
    [0,  6,  2, 3, 0xdd2200],
    [0,  7,  1, 2, 0xff3300],

    // ── Headlights (front/right) ──────────────────────────────────
    [37, 7,  2, 2, 0xffdd88],
    [38, 6,  2, 3, 0xffcc44],

    // ── Front bumper / splitter ──────────────────────────────────
    [36, 9,  4, 2, 0xaaaaaa],
    [37,10,  3, 1, 0x888888],

    // ── Rear bumper ───────────────────────────────────────────────
    [0,  9,  3, 2, 0xaaaaaa],

    // ── Side body line (highlight) ────────────────────────────────
    [2,  7, 34, 1, 0xe8e8e8],

    // ── Wheel arches ─────────────────────────────────────────────
    [3, 11,  8, 1, 0x777777],
    [28,11,  8, 1, 0x777777],

    // ── Wheels (dark) ────────────────────────────────────────────
    [4, 12,  7, 5, 0x1a1a1a],
    [29,12,  7, 5, 0x1a1a1a],

    // ── Rims ─────────────────────────────────────────────────────
    [5, 13,  5, 3, 0x555555],
    [30,13,  5, 3, 0x555555],
    [6, 14,  3, 1, 0x888888],
    [31,14,  3, 1, 0x888888],

    // ── Wheel hub ────────────────────────────────────────────────
    [7, 14,  1, 1, 0xaaaaaa],
    [32,14,  1, 1, 0xaaaaaa],

    // ── Undercarriage ────────────────────────────────────────────
    [5, 11, 22, 1, 0x555555],
  ],
};

// ─── Orange Supercar ──────────────────────────────────────────────────────────

const ORANGE_SUPER: CarDef = {
  w: 44, h: 16,
  rects: [
    // ── Rear wing (left/rear) ─────────────────────────────────────
    [0,  1,  1, 6, 0x222222],   // wing pole
    [0,  1,  6, 1, 0x333333],   // wing top
    [0,  2,  6, 1, 0x111111],

    // ── Rear diffuser ─────────────────────────────────────────────
    [0,  9,  6, 2, 0x111111],

    // ── Body – very low & wide ────────────────────────────────────
    [5,  4, 34, 2, 0xff6600],   // bonnet/hood lines
    [4,  5, 36, 1, 0xff5500],
    [3,  6, 38, 1, 0xff6600],
    [2,  7, 40, 2, 0xff6a00],
    [1,  8, 42, 2, 0xff5500],
    [0,  9, 44, 1, 0xff4400],

    // ── Roof / canopy ─────────────────────────────────────────────
    [14, 2, 14, 1, 0xff7700],
    [12, 3, 18, 2, 0xff6600],

    // ── Windows (dark) ────────────────────────────────────────────
    [13, 3, 16, 3, 0x1a2a3a],
    [14, 2, 14, 1, 0x2a3a4a],

    // ── Orange highlight stripe ───────────────────────────────────
    [3,  7, 36, 1, 0xffaa00],

    // ── Side intake vents ────────────────────────────────────────
    [8,  7,  3, 2, 0x882200],
    [32, 7,  3, 2, 0x882200],

    // ── Headlights (right/front) ──────────────────────────────────
    [41, 6,  3, 2, 0xffffaa],
    [40, 7,  4, 1, 0xffee66],

    // ── Taillights (left/rear) ────────────────────────────────────
    [2,  7,  2, 2, 0xdd2200],
    [2,  8,  2, 1, 0xff0000],

    // ── Front splitter ────────────────────────────────────────────
    [38, 9,  6, 1, 0x111111],
    [36,10,  8, 1, 0x222222],

    // ── Wheel arches ─────────────────────────────────────────────
    [5, 10,  8, 1, 0xcc4400],
    [31,10,  8, 1, 0xcc4400],

    // ── Wheels ───────────────────────────────────────────────────
    [5, 10,  8, 6, 0x111111],
    [31,10,  8, 6, 0x111111],

    // ── Rims ─────────────────────────────────────────────────────
    [6, 11,  6, 4, 0x3a3a3a],
    [32,11,  6, 4, 0x3a3a3a],
    [7, 12,  4, 2, 0x7a7a7a],
    [33,12,  4, 2, 0x7a7a7a],

    // ── Hub ──────────────────────────────────────────────────────
    [8, 13,  2, 1, 0xbbbbbb],
    [34,13,  2, 1, 0xbbbbbb],
  ],
};

// ─── Red sports coupe (Audi R8-style) ────────────────────────────────────────

const RED_COUPE: CarDef = {
  w: 42, h: 17,
  rects: [
    // ── Rear spoiler ─────────────────────────────────────────────
    [0, 4,  5, 1, 0x333333],
    [0, 5,  1, 3, 0x222222],

    // ── Body ─────────────────────────────────────────────────────
    [4,  4, 34, 2, 0xee1111],
    [3,  5, 36, 1, 0xdd0000],
    [2,  6, 38, 1, 0xee1111],
    [1,  7, 40, 2, 0xcc0000],
    [0,  8, 42, 2, 0xdd0000],

    // ── Roof ─────────────────────────────────────────────────────
    [10, 2, 20, 1, 0xee2222],
    [8,  3, 24, 2, 0xdd1111],

    // ── Windows ──────────────────────────────────────────────────
    [9,  3, 10, 3, 0x2a3a50],   // rear glass
    [20, 3, 10, 3, 0x3a4a60],   // front glass

    // ── Engine vents (mid) ───────────────────────────────────────
    [18, 6,  4, 2, 0x880000],
    [23, 6,  4, 2, 0x770000],

    // ── Headlights ───────────────────────────────────────────────
    [39, 6,  3, 2, 0xffee88],
    [38, 7,  4, 1, 0xffcc44],

    // ── Taillights ───────────────────────────────────────────────
    [0,  7,  2, 2, 0xff2200],
    [0,  8,  2, 1, 0xdd0000],

    // ── Side highlight ────────────────────────────────────────────
    [2,  7, 36, 1, 0xff4444],

    // ── Front splitter ────────────────────────────────────────────
    [37, 9,  5, 1, 0x111111],

    // ── Wheel arches ─────────────────────────────────────────────
    [5, 10,  8, 1, 0xaa0000],
    [29,10,  8, 1, 0xaa0000],

    // ── Wheels ───────────────────────────────────────────────────
    [5, 10,  8, 7, 0x111111],
    [29,10,  8, 7, 0x111111],

    // ── Rims (6-spoke style) ─────────────────────────────────────
    [6, 11,  6, 5, 0x888888],
    [30,11,  6, 5, 0x888888],
    [7, 12,  4, 3, 0xbbbbbb],
    [31,12,  4, 3, 0xbbbbbb],
    [8, 13,  2, 1, 0xdddddd],
    [32,13,  2, 1, 0xdddddd],
  ],
};

// ─── Green supercar (Lamborghini-style) ─────────────────────────────────────

const GREEN_SUPER: CarDef = {
  w: 44, h: 15,
  rects: [
    // ── Rear wing ────────────────────────────────────────────────
    [0,  1,  7, 1, 0x222222],
    [0,  2,  1, 5, 0x111111],

    // ── Body (ultra-low) ─────────────────────────────────────────
    [5,  3, 34, 2, 0x77ee00],
    [4,  4, 36, 1, 0x66dd00],
    [3,  5, 38, 1, 0x77ee00],
    [2,  6, 40, 2, 0x55cc00],
    [1,  7, 42, 1, 0x44bb00],
    [0,  8, 44, 2, 0x55cc00],

    // ── Canopy / roof ────────────────────────────────────────────
    [15, 1, 12, 1, 0x66cc00],
    [13, 2, 16, 2, 0x77dd00],

    // ── Windows ──────────────────────────────────────────────────
    [14, 2, 14, 3, 0x1a2a1a],

    // ── Side vents ───────────────────────────────────────────────
    [7,  6,  4, 2, 0x224400],
    [33, 6,  4, 2, 0x224400],

    // ── Highlight stripe ─────────────────────────────────────────
    [3,  6, 36, 1, 0x99ff22],

    // ── Headlights ───────────────────────────────────────────────
    [41, 5,  3, 2, 0xffffaa],
    [40, 6,  4, 1, 0xffee66],

    // ── Taillights ───────────────────────────────────────────────
    [1,  7,  2, 2, 0xff0000],

    // ── Splitter ─────────────────────────────────────────────────
    [38, 9,  6, 1, 0x111111],

    // ── Wheel arches ─────────────────────────────────────────────
    [5,  9,  8, 1, 0x44aa00],
    [31, 9,  8, 1, 0x44aa00],

    // ── Wheels ───────────────────────────────────────────────────
    [5,  9,  8, 6, 0x111111],
    [31, 9,  8, 6, 0x111111],

    // ── Rims ─────────────────────────────────────────────────────
    [6, 10,  6, 4, 0x4a4a4a],
    [32,10,  6, 4, 0x4a4a4a],
    [7, 11,  4, 2, 0x888888],
    [33,11,  4, 2, 0x888888],
    [8, 12,  2, 1, 0xcccccc],
    [34,12,  2, 1, 0xcccccc],
  ],
};

// ─── White sport sedan (BMW E46-style) ──────────────────────────────────────

const WHITE_SEDAN: CarDef = {
  w: 40, h: 18,
  rects: [
    // ── Spoiler ──────────────────────────────────────────────────
    [1, 4, 4, 1, 0xbbbbbb],

    // ── Roof ─────────────────────────────────────────────────────
    [7,  2, 18, 1, 0xdddddd],
    [5,  3, 22, 1, 0xeeeeee],
    [5,  4, 22, 2, 0xf4f4f4],

    // ── Windows ──────────────────────────────────────────────────
    [6,  3,  8, 3, 0x3a4f68],
    [15, 3, 10, 3, 0x4a607a],

    // ── Window divider ───────────────────────────────────────────
    [14, 3,  1, 3, 0x222222],

    // ── Body ─────────────────────────────────────────────────────
    [2,  6, 36, 4, 0xf0f0f0],
    [1,  7, 38, 3, 0xe8e8e8],
    [0,  8, 40, 2, 0xdcdcdc],

    // ── Lower panel ──────────────────────────────────────────────
    [1, 10, 38, 1, 0xaaaaaa],
    [2, 11, 36, 1, 0x888888],

    // ── Taillights ───────────────────────────────────────────────
    [0,  6,  2, 3, 0xdd2200],
    [0,  7,  1, 2, 0xff3300],

    // ── Headlights ───────────────────────────────────────────────
    [37, 7,  2, 2, 0xaaddff],
    [38, 6,  2, 3, 0x88ccff],

    // ── Front bumper ─────────────────────────────────────────────
    [36, 9,  4, 2, 0xcccccc],

    // ── Rear bumper ──────────────────────────────────────────────
    [0,  9,  3, 2, 0xcccccc],

    // ── Side highlight ───────────────────────────────────────────
    [2,  7, 34, 1, 0xffffff],

    // ── Wheel arches ─────────────────────────────────────────────
    [3, 11,  8, 1, 0x999999],
    [28,11,  8, 1, 0x999999],

    // ── Wheels ───────────────────────────────────────────────────
    [4, 12,  7, 5, 0x1a1a1a],
    [29,12,  7, 5, 0x1a1a1a],

    // ── Rims ─────────────────────────────────────────────────────
    [5, 13,  5, 3, 0x777777],
    [30,13,  5, 3, 0x777777],
    [6, 14,  3, 1, 0xaaaaaa],
    [31,14,  3, 1, 0xaaaaaa],
    [7, 14,  1, 1, 0xcccccc],
    [32,14,  1, 1, 0xcccccc],
  ],
};

// ─── All car definitions ──────────────────────────────────────────────────────

export type CarType = "silver" | "orange" | "red" | "green" | "white";

const CAR_DEFS: Record<CarType, CarDef> = {
  silver: SILVER_SEDAN,
  orange: ORANGE_SUPER,
  red:    RED_COUPE,
  green:  GREEN_SUPER,
  white:  WHITE_SEDAN,
};

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Returns the texture key for the given car type.
 * If an external image was pre-loaded (via preload in the scene), it is used
 * directly. Otherwise the car is drawn procedurally and cached.
 * External images must be loaded with key `car_<type>` before calling this.
 */
export function createCarTexture(scene: Phaser.Scene, type: CarType): string {
  const key = `car_${type}`;
  // If an external image (or already-generated texture) exists, use it.
  if (scene.textures.exists(key)) return key;

  const def = CAR_DEFS[type];
  const texW = def.w * PX;
  const texH = def.h * PX;

  const rt = scene.add.renderTexture(0, 0, texW, texH).setVisible(false);
  const g  = scene.add.graphics();

  for (const [rx, ry, rw, rh, col] of def.rects) {
    g.fillStyle(col, 1);
    g.fillRect(rx * PX, ry * PX, rw * PX, rh * PX);
  }

  rt.draw(g);
  rt.saveTexture(key);

  g.destroy();
  rt.destroy();

  return key;
}
