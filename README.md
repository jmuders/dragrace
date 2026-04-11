# Drag Race

Browser-based quarter-mile drag racing game built with TypeScript and Phaser 3. Race against an AI opponent with realistic physics, launch timing, gear shifting, and nitro. Playable on desktop and mobile.

**Live game:** https://jmuders.github.io/dragrace/

---

## Features

- 21 selectable cars with unique pixel-art sprites
- Physics model: engine torque, gear ratios, aerodynamic drag, rolling resistance
- Launch grading (Perfect / Good / Wheelspin / Bog) based on RPM at release
- Shift grading (Perfect / Good / Early / Late) based on RPM at upshift
- Nitro boost (hold N)
- Four difficulty levels for the AI opponent
- Personal best time saved in localStorage
- Touch controls for mobile play

---

## Difficulty Levels

| Level | AI Target ET | Feel |
|-------|-------------|------|
| ROOKIE | ~15.5 s | Slow and inconsistent — good for learning |
| STREET *(default)* | ~12.5 s | Average street racer — solid execution needed |
| PRO | ~10.5 s | Fast and consistent — near-perfect runs required |
| ELITE | ~9.0 s | Machine precision — only perfection wins |

Select difficulty on the Car Selection screen before each race.

---

## Controls

| Action | Keyboard | Mobile |
|--------|----------|--------|
| Throttle / stage RPM | Space or W | Left touch button |
| Shift gear | Enter or S | Right touch button |
| Nitro | N | Nitro button |
| Start / confirm | Enter | Tap |
| Browse cars | ← → | Car cards |

---

## Development

```bash
npm install       # Install dependencies
npm run dev       # Start dev server with hot reload (http://localhost:5173)
npm run build     # TypeScript compile + Vite production build → dist/
npm run preview   # Preview production build locally
```

Requires Node.js 18+.

---

## Project Structure

```
src/
├── main.ts                 # Phaser game config and initialisation
├── types.ts                # Enums and interfaces
├── constants.ts            # Physics constants, AI difficulty configs
├── scenes/
│   ├── MenuScene.ts        # Title screen
│   ├── CarSelectionScene.ts# Car + difficulty picker
│   ├── RaceScene.ts        # Main race screen
│   └── ResultsScene.ts     # Post-race results
├── simulation/
│   ├── RaceSimulation.ts   # Race state machine and countdown
│   ├── Car.ts              # Player car physics model
│   └── AIOpponent.ts       # Kinematic AI opponent
└── graphics/
    └── CarSprites.ts       # Procedural pixel-art car sprite generation
```

---

## Tech Stack

- **[Phaser 3](https://phaser.io/)** (v3.60) — game engine
- **TypeScript** — strict mode, ES2020 target
- **Vite** (v5) — dev server and bundler
- **GitHub Actions** — automatic deploy to GitHub Pages on push to `main`

---

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which builds and deploys to GitHub Pages automatically.
