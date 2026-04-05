# CLAUDE.md

## Project Overview

Browser-based drag racing game built with TypeScript and Phaser 3. Players compete against an AI opponent in quarter-mile drag races with realistic physics simulation, launch timing, gear shifting, and nitro boosts. Playable on desktop and mobile.

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server with hot reload (http://localhost:5173)
npm run build     # TypeScript compile + Vite production build → dist/
npm run preview   # Preview production build locally
```

## Architecture

```
src/
├── main.ts               # Phaser game config and initialization
├── types.ts              # Enums and interfaces (RacePhase, LaunchGrade, ShiftGrade, etc.)
├── constants.ts          # Physics constants and tuning parameters
├── scenes/               # Phaser scenes (Menu, CarSelection, Race, Results)
├── simulation/           # Physics engine and AI logic
│   ├── RaceSimulation.ts # Race state machine and countdown
│   ├── Car.ts            # Player car physics model
│   └── AIOpponent.ts     # AI opponent logic
└── graphics/
    └── CarSprites.ts     # Procedural pixel-art car sprite generation
```

## Key Concepts

- **Race phases**: Staging → Countdown → Racing → Finished (defined in `RacePhase` enum)
- **Launch grading**: Perfect / Good / Wheelspin / Bog based on RPM at launch
- **Shift grading**: Perfect / Good / Early / Late based on shift timing
- **Physics model**: Engine torque, gear ratios, aerodynamic drag, rolling resistance — see `src/constants.ts`
- **Best times**: Persisted in `localStorage`

## Tech Stack

- **Phaser 3** (v3.60.0) — game engine
- **TypeScript** — strict mode, ES2020 target
- **Vite** (v5.0.0) — dev server and bundler
- **GitHub Actions** — automatic deploy to GitHub Pages on push to `main`

## Deployment

Push to `main` triggers `.github/workflows/deploy.yml`, which builds and deploys to GitHub Pages at `https://jmuders.github.io/dragrace/`.
