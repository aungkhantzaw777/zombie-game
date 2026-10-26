# DEADSHIFT — Zombie Survivor

A five-minute, single-arena survivor game for desktop and mobile browsers. Move through a ruined city while your weapon fires at the nearest threat. Collect XP, choose upgrades, survive the Warden's charge, and defeat it after the five-minute mark to win.

## Play

- **WASD or arrow keys:** Move.
- **Touch joystick:** Move on a touch screen. Firing is automatic.
- **Escape or Pause:** Pause and resume.
- Collect green XP gems to level up. Gameplay pauses until you choose an upgrade.
- The Warden arrives at **4:00**. Its red warning line marks the next charge.
- Victory requires reaching **5:00** and defeating the Warden. If it is still alive at 5:00, the run continues.

The title screen includes a field manual and audio/motion settings. The pause menu can resume, restart, or return to the menu. Results show time, kills, level, and personal records.

## Local development

Requires a current Node.js version compatible with Vite 8 (Node 20.19+ or 22.12+).

```sh
npm ci
npm run dev
```

Useful commands:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run preview
```

`npm run build` runs TypeScript checks and writes a static site to `dist/`.

## Architecture

- `src/App.tsx` and `src/App.css`: React title, menus, HUD, upgrade choices, results, and touch joystick.
- `src/game/GameHost.tsx`: mounts and destroys the Phaser instance with React's effect lifecycle.
- `src/game/scene.ts`: Phaser arena lifecycle, rendering, run state, and boss behavior.
- `src/game/player.ts`, `enemies.ts`, `combat.ts`, `spawning.ts`, and `xp.ts`: entity rules, collision geometry, spawn placement, and pickups.
- `src/game/config.ts`: balancing values.
- `src/game/progression.ts` and `src/game/upgrades.ts`: pure progression and upgrade rules.
- `src/game/input.ts`: keyboard and touch input bridge.
- `src/game/audio.ts`: procedural Web Audio effects.
- `src/lib/persistence.ts`: validated settings and records storage.

The scene sends HUD snapshots to React about eight times per second and sends overlay events only when needed. Phaser owns gameplay timing and entities. Scene listeners and the game instance are removed on unmount or restart, including React StrictMode cleanup.

All art is original procedural Phaser drawing, inline SVG, and CSS. No third-party visual or audio assets are used. Settings and records are stored in localStorage and are **local to the current browser**; private browsing, clearing site data, or blocked storage can reset them.

## Deploy to Vercel

Import this repository as a Vite project. Use `npm run build` as the build command and `dist` as the output directory. No server functions, environment variables, or routing configuration are needed.
