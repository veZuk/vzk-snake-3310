import './style.css';
import { PiezoSynth } from './audio/piezo-synth.js';
import { SnakeEngine } from './game/snake-engine.js';
import { getStrings } from './i18n.js';
import { LcdRenderer } from './lcd/lcd-renderer.js';
import { Phone3310 } from './scene/phone-3310.js';
import { PhoneStage } from './scene/stage.js';

const canvas = document.getElementById('scene-canvas');
const btnBacklight = document.getElementById('btn-backlight');
const btnSound = document.getElementById('btn-sound');
const brandSub = document.getElementById('brand-sub');
const hudToolbar = document.getElementById('hud-toolbar');
const groupCam = document.getElementById('group-cam');
const groupLang = document.getElementById('group-lang');
const groupCovers = document.getElementById('group-covers');
const camButtons = Array.from(document.querySelectorAll('[data-cam]'));
const langButtons = Array.from(document.querySelectorAll('[data-lang]'));
const coverButtons = Array.from(document.querySelectorAll('[data-cover]'));

const hintEls = {
  move: document.getElementById('hint-move'),
  select: document.getElementById('hint-select'),
  pause: document.getElementById('hint-pause'),
  cam: document.getElementById('hint-cam'),
  led: document.getElementById('hint-led'),
  touch: document.getElementById('hint-touch'),
};

function getSafeStorage() {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

const safeStorage = getSafeStorage();

function loadSavedLang() {
  try {
    const saved = safeStorage?.getItem('snake3310_lang');
    return saved === 'en' ? 'en' : 'ru';
  } catch {
    return 'ru';
  }
}

let currentLang = loadSavedLang();

const synth = new PiezoSynth();
const lcd = new LcdRenderer(currentLang);

let backlightOn = true;

const engine = new SnakeEngine({
  storage: safeStorage,
  level: 5,
  mazeIndex: 0,
  onEvent(evt) {
    switch (evt.type) {
      case 'nav':
        synth.playNav();
        break;
      case 'select':
        synth.playSelect();
        break;
      case 'back':
        synth.playBack();
        break;
      case 'start':
        synth.playStart();
        break;
      case 'eat':
        synth.playEat();
        break;
      case 'bonus-spawn':
        synth.playBonusSpawn();
        break;
      case 'bonus':
        synth.playBonusEat();
        break;
      case 'gameover':
        synth.playGameOver();
        break;
      case 'victory':
        synth.playVictory();
        break;
      case 'sound-toggle':
        synth.setEnabled(evt.enabled);
        syncHudButtons();
        if (evt.enabled) synth.playSelect();
        break;
    }
  },
});

synth.setEnabled(engine.soundEnabled);

const phone = new Phone3310(lcd);

function triggerPhoneKey(keyId) {
  synth.unlock();
  phone.triggerKeyPress(keyId);

  switch (keyId) {
    case '2':
    case 'up':
      engine.setDirection('up');
      break;
    case '8':
    case 'down':
      engine.setDirection('down');
      break;
    case '4':
      engine.setDirection('left');
      break;
    case '6':
      engine.setDirection('right');
      break;
    case 'select':
    case '5':
      engine.pressSelect();
      break;
    case 'back':
      engine.pressBack();
      break;
    case 'star':
      toggleBacklight();
      synth.playKeyClick();
      break;
    case 'hash':
      engine.toggleSound();
      break;
    default:
      synth.playKeyClick();
      break;
  }
}

const stage = new PhoneStage(canvas, phone, {
  onKeyClick: triggerPhoneKey,
});

function setCamera(mode) {
  stage.setCameraMode(mode);
  for (const btn of camButtons) {
    const active = btn.dataset.cam === mode;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  }
}

function toggleBacklight() {
  backlightOn = !backlightOn;
  phone.setBacklight(backlightOn);
  syncHudButtons();
}

function syncHudButtons() {
  btnBacklight.classList.toggle('active', backlightOn);
  btnBacklight.setAttribute('aria-pressed', String(backlightOn));
  btnSound.classList.toggle('active', engine.soundEnabled);
  btnSound.setAttribute('aria-pressed', String(engine.soundEnabled));
}

function setLanguage(lang) {
  currentLang = lang === 'en' ? 'en' : 'ru';
  lcd.setLang(currentLang);
  try {
    safeStorage?.setItem('snake3310_lang', currentLang);
  } catch {
    // Ignore restricted storage
  }

  const s = getStrings(currentLang);
  document.documentElement.lang = currentLang;
  document.title = s.pageTitle;
  canvas.setAttribute('aria-label', s.canvasLabel);
  brandSub.textContent = s.brandSub;
  hudToolbar.setAttribute('aria-label', s.toolbarLabel);
  groupCam.setAttribute('aria-label', s.camGroupLabel);
  groupLang.setAttribute('aria-label', s.langGroupLabel);
  groupCovers.setAttribute('aria-label', s.coverGroupLabel);

  for (const btn of camButtons) {
    if (btn.dataset.cam === 'play') {
      btn.textContent = s.camPlay;
      btn.title = s.camPlayTitle;
    } else if (btn.dataset.cam === 'closeup') {
      btn.textContent = s.camCloseup;
      btn.title = s.camCloseupTitle;
    } else if (btn.dataset.cam === 'orbit') {
      btn.textContent = s.camOrbit;
      btn.title = s.camOrbitTitle;
    }
  }

  for (const btn of langButtons) {
    const active = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
    btn.title = btn.dataset.lang === 'en' ? s.langEnTitle : s.langRuTitle;
  }

  for (const btn of coverButtons) {
    const coverTitle = s.covers[btn.dataset.cover];
    if (coverTitle) {
      btn.title = coverTitle;
      btn.setAttribute('aria-label', coverTitle);
    }
  }

  btnBacklight.title = s.ledTitle;
  btnSound.textContent = s.soundLabel;
  btnSound.title = s.soundTitle;

  hintEls.move.textContent = s.hintMove;
  hintEls.select.textContent = s.hintSelect;
  hintEls.pause.textContent = s.hintPause;
  hintEls.cam.textContent = s.hintCam;
  hintEls.led.textContent = s.hintLed;
  hintEls.touch.textContent = s.hintTouch;
}

// Toolbar buttons
for (const btn of camButtons) {
  btn.addEventListener('click', () => {
    setCamera(btn.dataset.cam);
    btn.blur();
  });
}

for (const btn of langButtons) {
  btn.addEventListener('click', () => {
    setLanguage(btn.dataset.lang);
    btn.blur();
  });
}

for (const btn of coverButtons) {
  btn.addEventListener('click', () => {
    const id = btn.dataset.cover;
    phone.setCover(id);
    for (const other of coverButtons) {
      const active = other === btn;
      other.classList.toggle('active', active);
      other.setAttribute('aria-pressed', String(active));
    }
    btn.blur();
  });
}

btnBacklight.addEventListener('click', () => {
  toggleBacklight();
  btnBacklight.blur();
});

btnSound.addEventListener('click', () => {
  synth.unlock();
  engine.toggleSound();
  btnSound.blur();
});

// Unlock Web Audio on the very first real pointer gesture
canvas.addEventListener('pointerdown', () => {
  synth.unlock();
});

// Keyboard controls: Arrows, WASD, classic 2/4/6/8 keypad, Enter/Space/5, P/Esc/C, V/L/M
window.addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  synth.unlock();

  const code = e.code;

  if (code === 'ArrowUp' || code === 'KeyW' || code === 'Digit2' || code === 'Numpad2') {
    e.preventDefault();
    phone.triggerKeyPress(code === 'ArrowUp' ? 'up' : '2');
    engine.setDirection('up');
    return;
  }
  if (code === 'ArrowDown' || code === 'KeyS' || code === 'Digit8' || code === 'Numpad8') {
    e.preventDefault();
    phone.triggerKeyPress(code === 'ArrowDown' ? 'down' : '8');
    engine.setDirection('down');
    return;
  }
  if (code === 'ArrowLeft' || code === 'KeyA' || code === 'Digit4' || code === 'Numpad4') {
    e.preventDefault();
    phone.triggerKeyPress('4');
    engine.setDirection('left');
    return;
  }
  if (code === 'ArrowRight' || code === 'KeyD' || code === 'Digit6' || code === 'Numpad6') {
    e.preventDefault();
    phone.triggerKeyPress('6');
    engine.setDirection('right');
    return;
  }

  // Discrete action/toggle keys must not rapid-fire when held down
  if (e.repeat) return;

  if (code === 'Enter' || code === 'Space' || code === 'Digit5' || code === 'Numpad5') {
    if (
      (code === 'Enter' || code === 'Space') &&
      e.target?.closest?.('button, a, input, select, textarea')
    ) {
      return;
    }
    e.preventDefault();
    phone.triggerKeyPress(code === 'Digit5' || code === 'Numpad5' ? '5' : 'select');
    engine.pressSelect();
    return;
  }
  if (code === 'Escape' || code === 'KeyP' || code === 'Backspace' || code === 'KeyC') {
    e.preventDefault();
    phone.triggerKeyPress('back');
    engine.pressBack();
    return;
  }
  if (code === 'KeyV') {
    e.preventDefault();
    const next = stage.cycleCameraMode();
    setCamera(next);
    return;
  }
  if (code === 'KeyL') {
    e.preventDefault();
    toggleBacklight();
    return;
  }
  if (code === 'KeyM') {
    e.preventDefault();
    engine.toggleSound();
  }
});

// Touch swipe support on mobile/touchscreens (works cleanly in Play & Closeup modes)
let touchStart = null;
window.addEventListener('touchstart', (e) => {
  synth.unlock();
  if (e.touches.length !== 1 || e.target?.closest?.('.hud-top, .hud-bottom')) {
    touchStart = null;
    return;
  }
  touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
}, { passive: true });

window.addEventListener('touchcancel', () => {
  touchStart = null;
}, { passive: true });

window.addEventListener('touchend', (e) => {
  if (!touchStart || stage.cameraMode === 'orbit') {
    touchStart = null;
    return;
  }
  const t = e.changedTouches[0];
  const dx = t.clientX - touchStart.x;
  const dy = t.clientY - touchStart.y;
  touchStart = null;

  if (Math.hypot(dx, dy) < 28) return;
  synth.unlock();

  if (Math.abs(dx) > Math.abs(dy)) {
    const dir = dx > 0 ? 'right' : 'left';
    phone.triggerKeyPress(dir === 'right' ? '6' : '4');
    engine.setDirection(dir);
  } else {
    const dir = dy > 0 ? 'down' : 'up';
    phone.triggerKeyPress(dir === 'down' ? '8' : '2');
    engine.setDirection(dir);
  }
}, { passive: true });

window.addEventListener('resize', () => stage.resize());

// Prime initial LCD frame & language immediately so there is no blank flash on first paint
setLanguage(currentLang);
lcd.render(engine, 0);
lcd.stepPersistence(1, true);
syncHudButtons();

// Expose lightweight debug handle for automated inspection if needed
window.__SNAKE_3310__ = {
  engine,
  lcd,
  phone,
  stage,
  setCamera,
};

let lastTime = performance.now();
const startTime = lastTime;

function animate(now) {
  requestAnimationFrame(animate);
  const dtMs = Math.min(100, Math.max(0, now - lastTime));
  lastTime = now;
  const dtSec = dtMs / 1000;
  const elapsedSec = (now - startTime) / 1000;

  engine.update(dtMs);
  lcd.render(engine, now);
  lcd.stepPersistence(dtSec, false);
  phone.update(dtSec);
  stage.update(dtSec, elapsedSec);
}

requestAnimationFrame(animate);
