import assert from 'node:assert/strict';
import { MAZES } from '../src/game/mazes.js';
import { SnakeEngine, createMemoryStorage } from '../src/game/snake-engine.js';
import { STRINGS } from '../src/i18n.js';
import {
  BONUS_SPRITES_8X4,
  FONT_5PX,
  SPRITES_4X4,
  measureTextWidth,
} from '../src/lcd/font-5px.js';
import { LCD_HEIGHT, LCD_WIDTH, LcdRenderer } from '../src/lcd/lcd-renderer.js';

function countLitPixels(lcd) {
  let count = 0;
  for (let i = 0; i < lcd.pixels.length; i++) {
    if (lcd.pixels[i]) count += 1;
  }
  return count;
}

// 1. Verify bitmap font & sprite dimensional integrity
for (const [ch, rows] of Object.entries(FONT_5PX)) {
  assert.equal(rows.length, 5, `Glyph "${ch}" must be 5px tall`);
  const width = rows[0].length;
  assert.ok(width >= 1, `Glyph "${ch}" must be non-empty`);
  for (let r = 0; r < rows.length; r++) {
    assert.equal(rows[r].length, width, `Glyph "${ch}" row ${r} has inconsistent width`);
    assert.match(rows[r], /^[.#]+$/, `Glyph "${ch}" row ${r} contains invalid pixels`);
  }
}

function assertSpriteDims(name, sprite, expectedW, expectedH) {
  assert.equal(sprite.length, expectedH, `Sprite "${name}" height mismatch`);
  for (let r = 0; r < sprite.length; r++) {
    assert.equal(sprite[r].length, expectedW, `Sprite "${name}" row ${r} width mismatch`);
  }
}

for (const [key, val] of Object.entries(SPRITES_4X4)) {
  if (Array.isArray(val)) {
    assertSpriteDims(key, val, 4, 4);
  } else {
    for (const [subKey, sprite] of Object.entries(val)) {
      assertSpriteDims(`${key}.${subKey}`, sprite, 4, 4);
    }
  }
}

for (const [key, sprite] of Object.entries(BONUS_SPRITES_8X4)) {
  assertSpriteDims(`bonus.${key}`, sprite, 8, 4);
}

// 2. Verify all EN and RU LCD strings have direct glyphs and fit within their 84px slots
function assertStringGlyphs(label, str) {
  for (const ch of str) {
    assert.ok(ch in FONT_5PX, `Missing glyph "${ch}" in [${label}] "${str}"`);
  }
}

for (const lang of ['ru', 'en']) {
  const lcdStrings = STRINGS[lang].lcd;
  for (const [key, val] of Object.entries(lcdStrings)) {
    if (typeof val === 'string') {
      assertStringGlyphs(`${lang}.${key}`, val);
      const w = measureTextWidth(val);
      assert.ok(w <= 72, `LCD string [${lang}.${key}] "${val}" too wide (${w}px > 72px)`);
    }
  }
  assert.ok(
    measureTextWidth(`${lcdStrings.scorePrefix} 9999`) <= 76,
    `Composed score line [${lang}] too wide`,
  );
  assert.ok(
    measureTextWidth(`${lcdStrings.bestPrefix} 9999`) <= 76,
    `Composed best line [${lang}] too wide`,
  );
  for (const [mazeId, name] of Object.entries(lcdStrings.mazesMap)) {
    assertStringGlyphs(`${lang}.mazesMap.${mazeId}`, name);
    const w = measureTextWidth(name);
    assert.ok(w <= 74, `LCD maze name [${lang}.${mazeId}] "${name}" too wide (${w}px > 74px)`);
    const subline = `${name} ${lcdStrings.levelShort}9`;
    assert.ok(
      measureTextWidth(subline) <= 78,
      `Composed highscore subline [${lang}.${mazeId}] "${subline}" too wide`,
    );
  }
}

for (const lang of ['ru', 'en']) {
  const lcd = new LcdRenderer(lang);
  assert.equal(lcd.pixels.length, 84 * 48);
  assert.equal(lcd.rgba.length, 84 * 48 * 4);

  const engine = new SnakeEngine({ storage: createMemoryStorage(), skipSplash: false });

  // 3. Splash screen renders non-empty pixel art
  lcd.render(engine, 0);
  assert.ok(countLitPixels(lcd) > 150, `[${lang}] Splash screen must draw logo and snake art`);

  // 4. Main menu & all submenus render cleanly without out-of-bounds issues
  engine.mode = 'menu';
  for (const screen of ['main', 'level', 'maze', 'highscore']) {
    engine.menuScreen = screen;
    if (screen === 'maze') {
      for (let i = 0; i < MAZES.length; i++) {
        engine.mazeIndex = i;
        lcd.render(engine, 0);
        assert.ok(countLitPixels(lcd) > 80, `[${lang}] Maze menu "${MAZES[i].name}" must draw preview`);
      }
    } else {
      lcd.render(engine, 0);
      assert.ok(countLitPixels(lcd) > 80, `[${lang}] Menu screen "${screen}" must render content`);
    }
  }

  // 5. Gameplay HUD, border, snake, food, and bonus critter render cleanly
  engine.mazeIndex = 1; // Box
  engine.startNewGame();
  engine.bonus = { x: 14, y: 2, type: 'mouse', ticksLeft: 18, maxTicks: 20 };
  lcd.render(engine, 0);
  const gamePixels = countLitPixels(lcd);
  assert.ok(gamePixels > 300, `[${lang}] Gameplay frame must draw HUD, Box border, snake, food, and bonus`);

  // Check HUD divider line at row 6 spans full 84px width
  for (let x = 0; x < LCD_WIDTH; x++) {
    assert.equal(lcd.getPixel(x, 6), 1, `HUD divider missing at x=${x}`);
  }

  // Check symmetric 2px left/right HUD margins (score on left, bonus timer on right)
  assert.equal(lcd.getPixel(0, 0), 0, 'Left HUD margin x=0 must stay clear');
  assert.equal(lcd.getPixel(1, 0), 0, 'Left HUD margin x=1 must stay clear');
  assert.equal(lcd.getPixel(2, 0), 1, 'Score must start at x=2');
  assert.equal(lcd.getPixel(81, 0), 1, 'Bonus timer must end at x=81');
  assert.equal(lcd.getPixel(82, 0), 0, 'Right HUD margin x=82 must stay clear');
  assert.equal(lcd.getPixel(83, 0), 0, 'Right HUD margin x=83 must stay clear');

  // 6. Liquid crystal persistence ramps smoothly instead of NaN or overflow
  lcd.stepPersistence(0.016, false);
  let nonZeroRgba = 0;
  for (let i = 0; i < LCD_WIDTH * LCD_HEIGHT; i++) {
    const val = lcd.rgba[i * 4];
    assert.ok(val >= 0 && val <= 255);
    assert.equal(lcd.rgba[i * 4 + 3], 255);
    if (val > 0) nonZeroRgba += 1;
  }
  assert.equal(nonZeroRgba, gamePixels);

  // 7. Game over and victory screens
  engine.score = 125;
  engine.mode = 'gameover';
  lcd.render(engine, 0);
  assert.ok(countLitPixels(lcd) > 120);

  engine.mode = 'victory';
  lcd.render(engine, 0);
  assert.ok(countLitPixels(lcd) > 120);
}

console.log('check-lcd: OK (84x48 framebuffer, EN+RU Cyrillic font, sprites, menus, mazes, persistence verified)');
