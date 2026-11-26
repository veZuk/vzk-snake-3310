# SHMOKIA 3310 — Snake II (Three.js)

[Русская версия](README.ru.md)

An interactive 3D clone of classic retro keypad **Snake II** built from scratch with **Three.js 0.187.0** and **Vite 8** under parody **SHMOKIA 3310** branding.

**Live demo (GitHub Pages):** https://vezuk.github.io/vzk-snake-3310/

## Highlights

- **Procedural 3D 3310 handset** (`src/scene/phone-3310.js`, `src/scene/stage.js`):
  - Sculpted body with swappable faceplates (Midnight Blue, Arctic Silver, Deep Red, Sahara Yellow), silver inner bezel, earpiece slots, `SHMOKIA` badge, and a clearcoat protective acrylic lens.
  - Tactile interactive 3D keypad (Navi, `C`, `▲`/`▼`, and `1–9`, `*`, `0`, `#` with dual Latin/Cyrillic `abc/абвг` … `wxyz/ьэюя` legends) — clickable/tappable directly on the 3D model and physically depressed when driven from the keyboard.
  - Three camera presets (`Play`, `Screen`, `3D` with free `OrbitControls`), an adaptive on-screen mobile touch controller (`Pad`, auto-enabled on touchscreens / portrait phones, toggleable with `G`), and an instant **`RU / EN`** toggle covering both the outer HUD and the 84×48 pixel menus.
- **84×48 monochrome STN LCD shader** (`src/lcd/lcd-renderer.js`, `src/lcd/font-5px.js`):
  - True 1-bit **84×48** pixel framebuffer with sub-pixel dot-matrix grid, subtle liquid-crystal drop-shadow onto the reflective backing, response inertia (ghosting), and switchable green LED backlighting (`LED`).
  - Pixel-accurate menus (`New game` / `Continue`, `Level 1..9`, `Mazes` with live miniature previews, `Top score`, `Sound`) with custom 5px Latin and Cyrillic bitmap fonts.
- **Classic Snake II mechanics** (`src/game/snake-engine.js`, `src/game/mazes.js`):
  - 6 mazes (`No maze`, `Box`, `Tunnel`, `Mill`, `Rails`, `Apartment`) and 9 speed levels (constant speed per level, defaulting to beginner-friendly Level 3 and persisted in `localStorage`).
  - 2-step turn buffer, 1-tick collision grace window at walls/body (including 2-step U-turn rescue), open-mouth bite animation, travelling belly bulge for swallowed food, and timed bonus critters every 5 apples.
  - High scores and language preference persisted in `localStorage` (with automatic in-memory fallback when storage is restricted).
- **Procedural Web Audio piezo buzzer** (`src/audio/piezo-synth.js`): retro ceramic-buzzer sound synthesis with zero external audio assets.

## Controls

| Action | Keyboard | 3D Handset |
|---|---|---|
| Steer / navigate | `↑ ↓ ← →`, `W A S D`, `2 4 6 8` | Keys `2`, `4`, `6`, `8`, `▲`, `▼` |
| Start / select / pause | `Enter`, `Space`, `5` | Navi key / `5` |
| Back / pause | `Esc`, `P`, `C` | Key `C` |
| Switch camera | `V` | `Play` / `Screen` / `3D` buttons |
| On-screen touch pad | `G` | `Pad` button |
| LCD backlight | `L` | `LED` button / key `*` |
| Sound | `M` | `Sound` button / key `#` |

On phones and tablets, the responsive on-screen D-pad (with thumb-glide turning) and `OK` / `C` buttons appear automatically with adaptive upper-screen framing; direct taps on the 3D keys and swipe gestures also work.

## Local development & checks

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Run simulation, maze, and 84×48 LCD checks, or build the production bundle (`dist/`):

```bash
npm run check
npm run build
```

## License

Released into the public domain under [The Unlicense](LICENSE) — free to use, modify, and distribute without restriction.
