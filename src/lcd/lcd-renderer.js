import { GRID_COLS, GRID_ROWS, cellKey, getMazeByIndex } from '../game/mazes.js';
import { getStrings } from '../i18n.js';
import {
  BONUS_SPRITES_8X4,
  FONT_5PX,
  SPLASH_SNAKE_ART,
  SPRITES_4X4,
  measureTextWidth,
} from './font-5px.js';

export const LCD_WIDTH = 84;
export const LCD_HEIGHT = 48;

// Playfield geometry inside the 84x48 monochrome 3310 LCD:
// y=0..4: HUD digits & bonus timer
// y=5:    1px blank
// y=6:    1px HUD horizontal hairline divider
// y=7:    1px blank (or top edge of thick Box wall)
// y=8:    Playfield top border
// y=9:    1px inner top gutter
// y=10..45: 36px = 9 rows * 4px
// y=46:   1px inner bottom gutter
// y=47:   Playfield bottom border
// x=0:    Playfield left border
// x=1:    1px inner left gutter
// x=2..81: 80px = 20 cols * 4px
// x=82:   1px inner right gutter
// x=83:   Playfield right border
export const PLAYFIELD_ORIGIN_X = 2;
export const PLAYFIELD_ORIGIN_Y = 10;
export const CELL_SIZE = 4;

export class LcdRenderer {
  constructor(lang = 'ru') {
    this.lang = lang;
    this.pixels = new Uint8Array(LCD_WIDTH * LCD_HEIGHT);
    // Float persistence buffer emulating real STN LCD liquid-crystal inertia
    this.display = new Float32Array(LCD_WIDTH * LCD_HEIGHT);
    // Packed RGBA Uint8Array ready for THREE.DataTexture upload
    this.rgba = new Uint8Array(LCD_WIDTH * LCD_HEIGHT * 4);
    this.rgba.fill(0);
  }

  setLang(lang) {
    this.lang = lang === 'en' ? 'en' : 'ru';
  }

  get t() {
    return getStrings(this.lang).lcd;
  }

  clear(value = 0) {
    this.pixels.fill(value ? 1 : 0);
  }

  setPixel(x, y, on = 1) {
    if (x < 0 || x >= LCD_WIDTH || y < 0 || y >= LCD_HEIGHT) return;
    this.pixels[y * LCD_WIDTH + x] = on ? 1 : 0;
  }

  getPixel(x, y) {
    if (x < 0 || x >= LCD_WIDTH || y < 0 || y >= LCD_HEIGHT) return 0;
    return this.pixels[y * LCD_WIDTH + x];
  }

  fillRect(x, y, w, h, on = 1) {
    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        this.setPixel(x + dx, y + dy, on);
      }
    }
  }

  strokeRect(x, y, w, h, on = 1) {
    for (let dx = 0; dx < w; dx++) {
      this.setPixel(x + dx, y, on);
      this.setPixel(x + dx, y + h - 1, on);
    }
    for (let dy = 0; dy < h; dy++) {
      this.setPixel(x, y + dy, on);
      this.setPixel(x + w - 1, y + dy, on);
    }
  }

  drawHLine(x, y, len, on = 1) {
    for (let dx = 0; dx < len; dx++) {
      this.setPixel(x + dx, y, on);
    }
  }

  drawVLine(x, y, len, on = 1) {
    for (let dy = 0; dy < len; dy++) {
      this.setPixel(x, y + dy, on);
    }
  }

  drawSprite(sprite, x, y, on = 1) {
    for (let row = 0; row < sprite.length; row++) {
      const line = sprite[row];
      for (let col = 0; col < line.length; col++) {
        if (line[col] === '#') {
          this.setPixel(x + col, y + row, on);
        }
      }
    }
  }

  drawText(text, x, y, on = 1) {
    let cursorX = x;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      const glyph = FONT_5PX[ch] ?? FONT_5PX[ch.toUpperCase()] ?? FONT_5PX[' '];
      this.drawSprite(glyph, cursorX, y, on);
      cursorX += glyph[0].length + 1;
    }
    return cursorX;
  }

  drawCenteredText(text, y, on = 1) {
    const w = measureTextWidth(text);
    const x = Math.floor((LCD_WIDTH - w) / 2);
    this.drawText(text, x, y, on);
  }

  render(engine, nowMs = 0) {
    this.clear(0);

    switch (engine.mode) {
      case 'splash':
        this._renderSplash(nowMs);
        break;
      case 'menu':
        this._renderMenu(engine);
        break;
      case 'playing':
      case 'dying':
        this._renderGame(engine);
        break;
      case 'gameover':
        this._renderEndScreen(engine, false);
        break;
      case 'victory':
        this._renderEndScreen(engine, true);
        break;
      default:
        this._renderMenu(engine);
    }
  }

  // Advances liquid crystal response inertia and writes into this.rgba
  stepPersistence(dtSec, instant = false) {
    // Authentic 3310 STN LCD: turn-on ~35ms, turn-off ~75ms
    const riseAlpha = instant ? 1 : 1 - Math.exp(-dtSec / 0.022);
    const fallAlpha = instant ? 1 : 1 - Math.exp(-dtSec / 0.055);

    for (let i = 0; i < this.pixels.length; i++) {
      const target = this.pixels[i];
      const cur = this.display[i];
      const next = target > cur
        ? cur + (target - cur) * riseAlpha
        : cur + (target - cur) * fallAlpha;

      // Snap tiny tails to avoid lingering faint ghost forever
      const clamped = next < 0.004 ? 0 : next > 0.996 ? 1 : next;
      this.display[i] = clamped;

      const byte = Math.round(clamped * 255);
      const o = i * 4;
      this.rgba[o] = byte;
      this.rgba[o + 1] = byte;
      this.rgba[o + 2] = byte;
      this.rgba[o + 3] = 255;
    }
  }

  _renderSplash(nowMs) {
    this.strokeRect(1, 1, LCD_WIDTH - 2, LCD_HEIGHT - 2, 1);
    this.drawCenteredText(this.t.splashTitle, 6, 1);
    this.drawHLine(14, 13, LCD_WIDTH - 28, 1);
    this.drawSprite(SPLASH_SNAKE_ART, Math.floor((LCD_WIDTH - 36) / 2), 16, 1);

    // Subtle blinking prompt at bottom
    if (Math.floor(nowMs / 350) % 2 === 0) {
      this.drawCenteredText(this.t.play, 38, 1);
    }
  }

  _renderSoftkey(label) {
    this.drawHLine(0, 40, LCD_WIDTH, 1);
    this.drawCenteredText(label, 42, 1);
  }

  _menuItemLabel(item, engine) {
    const t = this.t;
    switch (item.id) {
      case 'continue':
        return t.continue;
      case 'new-game':
        return t.newGame;
      case 'level':
        return t.level;
      case 'mazes':
        return t.mazes;
      case 'top-score':
        return t.topScore;
      case 'sound':
        return engine.soundEnabled ? t.soundOn : t.soundOff;
      default:
        return item.label;
    }
  }

  _mazeLabel(maze) {
    return this.t.mazesMap[maze.id] ?? maze.name;
  }

  _renderMenu(engine) {
    if (engine.menuScreen === 'main') {
      this._renderMainMenu(engine);
    } else if (engine.menuScreen === 'level') {
      this._renderLevelMenu(engine);
    } else if (engine.menuScreen === 'maze') {
      this._renderMazeMenu(engine);
    } else if (engine.menuScreen === 'highscore') {
      this._renderHighScoreMenu(engine);
    }
  }

  _renderMainMenu(engine) {
    // Classic 3310 header + inverted highlight bar for selected item
    this.drawCenteredText(this.t.menuTitle, 1, 1);
    this.drawHLine(0, 7, LCD_WIDTH, 1);

    const items = engine.mainMenuItems;
    const visibleCount = 4;
    let startIdx = 0;
    if (engine.menuIndex >= visibleCount) {
      startIdx = engine.menuIndex - visibleCount + 1;
    }

    for (let slot = 0; slot < visibleCount; slot++) {
      const idx = startIdx + slot;
      if (idx >= items.length) break;
      const item = items[idx];
      const label = this._menuItemLabel(item, engine);
      const rowY = 9 + slot * 7;
      const isSelected = idx === engine.menuIndex;

      if (isSelected) {
        this.fillRect(2, rowY, LCD_WIDTH - 8, 7, 1);
        this.drawText(label, 5, rowY + 1, 0);
      } else {
        this.drawText(label, 5, rowY + 1, 1);
      }
    }

    // Classic right-side scrollbar
    const trackX = LCD_WIDTH - 3;
    const trackTop = 9;
    const trackHeight = 28;
    this.drawVLine(trackX, trackTop, trackHeight, 1);
    const thumbH = Math.max(4, Math.floor(trackHeight / items.length));
    const thumbY = trackTop + Math.round((engine.menuIndex / Math.max(1, items.length - 1)) * (trackHeight - thumbH));
    this.fillRect(trackX - 1, thumbY, 3, thumbH, 1);

    this._renderSoftkey(this.t.select);
  }

  _renderLevelMenu(engine) {
    this.drawCenteredText(this.t.level, 1, 1);
    this.drawHLine(0, 7, LCD_WIDTH, 1);

    // Classic 9-step ascending signal-style bar graph
    const baseY = 34;
    const barW = 5;
    const gap = 2;
    const startX = 11;

    for (let lvl = 1; lvl <= 9; lvl++) {
      const h = 3 + lvl * 2;
      const bx = startX + (lvl - 1) * (barW + gap);
      const by = baseY - h;
      if (lvl <= engine.level) {
        this.fillRect(bx, by, barW, h, 1);
      } else {
        this.strokeRect(bx, by, barW, h, 1);
      }
    }

    // Level indicator badge on top left
    this.drawText(`${engine.level}/9`, 4, 11, 1);
    this._renderSoftkey(this.t.ok);
  }

  _renderMazeMenu(engine) {
    const maze = getMazeByIndex(engine.mazeIndex);
    this.drawCenteredText(this._mazeLabel(maze), 1, 1);
    this.drawHLine(0, 7, LCD_WIDTH, 1);

    // Left / right arrows
    this.drawText('<', 3, 21, 1);
    this.drawText('>', LCD_WIDTH - 6, 21, 1);

    // Live 2x2 miniature maze preview centered in the LCD (40x18 inside 44x22 box)
    const previewW = GRID_COLS * 2;
    const previewH = GRID_ROWS * 2;
    const ox = Math.floor((LCD_WIDTH - previewW) / 2);
    const oy = 14;

    if (maze.solidBorder) {
      this.strokeRect(ox - 2, oy - 2, previewW + 4, previewH + 4, 1);
      this.strokeRect(ox - 1, oy - 1, previewW + 2, previewH + 2, 1);
    } else {
      // Symmetrical dashed border to clearly signify wrap-around edges
      const left = ox - 2;
      const right = ox + previewW + 1;
      const top = oy - 2;
      const bottom = oy + previewH + 1;
      for (let x = left + 1; x <= right - 1; x += 2) {
        this.setPixel(x, top, 1);
        this.setPixel(x, bottom, 1);
      }
      for (let y = top + 1; y <= bottom - 1; y += 2) {
        this.setPixel(left, y, 1);
        this.setPixel(right, y, 1);
      }
    }

    for (const w of maze.walls) {
      this.fillRect(ox + w.x * 2, oy + w.y * 2, 2, 2, 1);
    }

    this._renderSoftkey(this.t.ok);
  }

  _renderHighScoreMenu(engine) {
    this.drawCenteredText(this.t.topScore, 1, 1);
    this.drawHLine(0, 7, LCD_WIDTH, 1);

    const scoreStr = String(engine.highScore.score).padStart(4, '0');
    this.drawCenteredText(scoreStr, 14, 1);

    const mazeName = this._mazeLabel(getMazeByIndex(engine.highScore.mazeIndex));
    this.drawCenteredText(`${mazeName} ${this.t.levelShort}${engine.highScore.level}`, 25, 1);

    this._renderSoftkey(this.t.ok);
  }

  _renderEndScreen(engine, isVictory) {
    this.strokeRect(1, 1, LCD_WIDTH - 2, 37, 1);

    if (isVictory) {
      this.drawCenteredText(this.t.youWon, 5, 1);
    } else if (engine.isNewHighScore) {
      this.drawCenteredText(this.t.newRecord, 5, 1);
    } else {
      this.drawCenteredText(this.t.gameOver, 5, 1);
    }

    this.drawHLine(10, 13, LCD_WIDTH - 20, 1);
    this.drawCenteredText(`${this.t.scorePrefix} ${String(engine.score).padStart(4, '0')}`, 18, 1);
    this.drawCenteredText(`${this.t.bestPrefix} ${String(engine.highScore.score).padStart(4, '0')}`, 27, 1);

    this._renderSoftkey(this.t.play);
  }

  _renderGame(engine) {
    // 1. Top HUD bar
    const scoreStr = String(Math.min(9999, engine.score)).padStart(4, '0');
    this.drawText(scoreStr, 2, 0, 1);

    // Bonus critter HUD icon + countdown on top-right (aligned to 2px right margin)
    if (engine.bonus) {
      const sprite = BONUS_SPRITES_8X4[engine.bonus.type] ?? BONUS_SPRITES_8X4.mouse;
      this.drawSprite(sprite, 62, 1, 1);
      const timerStr = String(engine.bonus.ticksLeft).padStart(2, '0');
      this.drawText(timerStr, 75, 0, 1);
    } else if (!engine.soundEnabled) {
      const muteW = measureTextWidth(this.t.mute);
      this.drawText(this.t.mute, LCD_WIDTH - muteW - 2, 0, 1);
    }

    // Horizontal HUD divider
    this.drawHLine(0, 6, LCD_WIDTH, 1);

    // 2. Playfield outer frame
    if (engine.maze.solidBorder) {
      // Bold solid double-line wall for Box maze
      this.strokeRect(0, 8, LCD_WIDTH, 40, 1);
      this.strokeRect(1, 9, LCD_WIDTH - 2, 38, 1);
    } else {
      // Crisp 1px frame with open wrap-around feel
      this.strokeRect(0, 8, LCD_WIDTH, 40, 1);
    }

    // 3. Maze internal wall blocks
    for (const w of engine.maze.walls) {
      this.drawSprite(
        SPRITES_4X4.wall,
        PLAYFIELD_ORIGIN_X + w.x * CELL_SIZE,
        PLAYFIELD_ORIGIN_Y + w.y * CELL_SIZE,
        1,
      );
    }

    // 4. Regular food pellet
    if (engine.food) {
      this.drawSprite(
        SPRITES_4X4.food,
        PLAYFIELD_ORIGIN_X + engine.food.x * CELL_SIZE,
        PLAYFIELD_ORIGIN_Y + engine.food.y * CELL_SIZE,
        1,
      );
    }

    // 5. Bonus critter (2 cells wide!)
    if (engine.bonus) {
      const sprite = BONUS_SPRITES_8X4[engine.bonus.type] ?? BONUS_SPRITES_8X4.mouse;
      this.drawSprite(
        sprite,
        PLAYFIELD_ORIGIN_X + engine.bonus.x * CELL_SIZE,
        PLAYFIELD_ORIGIN_Y + engine.bonus.y * CELL_SIZE,
        1,
      );
    }

    // 6. Snake (blinks cleanly during 'dying' state just like classic 3310)
    const hideSnakeForBlink =
      engine.mode === 'dying' && Math.floor(engine.dyingElapsedMs / 160) % 2 === 1;

    if (!hideSnakeForBlink) {
      this._renderSnake(engine);
    }
  }

  _dirBetween(from, to) {
    let dx = to.x - from.x;
    let dy = to.y - from.y;
    // Handle toroidal wrap-around adjacency
    if (dx > 1) dx = -1;
    else if (dx < -1) dx = 1;
    if (dy > 1) dy = -1;
    else if (dy < -1) dy = 1;

    if (dx === 1) return 'right';
    if (dx === -1) return 'left';
    if (dy === 1) return 'down';
    return 'up';
  }

  _cornerSprite(d1, d2) {
    const pair = new Set([d1, d2]);
    if (pair.has('up') && pair.has('right')) return SPRITES_4X4.cornerTR;
    if (pair.has('up') && pair.has('left')) return SPRITES_4X4.cornerTL;
    if (pair.has('down') && pair.has('right')) return SPRITES_4X4.cornerBR;
    if (pair.has('down') && pair.has('left')) return SPRITES_4X4.cornerBL;
    if (pair.has('left') || pair.has('right')) return SPRITES_4X4.bodyH;
    return SPRITES_4X4.bodyV;
  }

  _renderSnake(engine) {
    const segs = engine.segments;
    if (segs.length === 0) return;

    const bulgeKeys = new Set(engine.bulges.map((b) => cellKey(b.x, b.y)));
    const mouthOpen = engine.isMouthOpen();

    for (let i = 0; i < segs.length; i++) {
      const seg = segs[i];
      const px = PLAYFIELD_ORIGIN_X + seg.x * CELL_SIZE;
      const py = PLAYFIELD_ORIGIN_Y + seg.y * CELL_SIZE;

      if (i === 0) {
        const headSet = mouthOpen ? SPRITES_4X4.headOpen : SPRITES_4X4.headClosed;
        this.drawSprite(headSet[engine.direction] ?? headSet.right, px, py, 1);
      } else if (i === segs.length - 1) {
        const prev = segs[i - 1];
        const toward = this._dirBetween(seg, prev);
        this.drawSprite(SPRITES_4X4.tailToward[toward] ?? SPRITES_4X4.tailToward.right, px, py, 1);
      } else {
        const prev = segs[i - 1];
        const next = segs[i + 1];
        const dPrev = this._dirBetween(seg, prev);
        const dNext = this._dirBetween(seg, next);

        if (bulgeKeys.has(cellKey(seg.x, seg.y))) {
          this.drawSprite(SPRITES_4X4.bulge, px, py, 1);
        } else {
          this.drawSprite(this._cornerSprite(dPrev, dNext), px, py, 1);
        }
      }
    }
  }
}
