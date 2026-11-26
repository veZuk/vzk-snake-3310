import { GRID_COLS, GRID_ROWS, MAZES, cellKey, getMazeByIndex } from './mazes.js';

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

const OPPOSITE = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

// Classic 3310 Snake II constant step durations (ms) for Levels 1..9
// Factory default is Level 3 (255 ms/step): approachable for newcomers, scaling smoothly up to Level 9 (70 ms/step)
export const DEFAULT_LEVEL = 3;
export const LEVEL_STEP_MS = [420, 330, 255, 200, 160, 130, 105, 86, 70];

export const BONUS_TYPES = ['mouse', 'spider', 'bug', 'fish', 'frog'];
export const BONUS_INTERVAL = 5;
export const BONUS_DURATION_TICKS = 20;

const DYING_DURATION_MS = 960;
const SPLASH_DURATION_MS = 1800;

export function createMemoryStorage() {
  const map = new Map();
  return {
    getItem(k) {
      return map.has(k) ? map.get(k) : null;
    },
    setItem(k, v) {
      map.set(k, String(v));
    },
  };
}

function loadHighScore(storage) {
  try {
    const raw = storage?.getItem('snake3310_topscore');
    if (!raw) return { score: 0, mazeIndex: 0, level: DEFAULT_LEVEL };
    const parsed = JSON.parse(raw);
    const normalizedMaze = Number.isInteger(parsed.mazeIndex)
      ? ((parsed.mazeIndex % MAZES.length) + MAZES.length) % MAZES.length
      : 0;
    return {
      score: Number.isFinite(parsed.score) ? Math.max(0, Math.floor(parsed.score)) : 0,
      mazeIndex: normalizedMaze,
      level: Number.isInteger(parsed.level) ? Math.min(9, Math.max(1, parsed.level)) : DEFAULT_LEVEL,
    };
  } catch {
    return { score: 0, mazeIndex: 0, level: DEFAULT_LEVEL };
  }
}

function saveHighScore(storage, record) {
  try {
    storage?.setItem('snake3310_topscore', JSON.stringify(record));
  } catch {
    // Ignore storage quota or restricted environments
  }
}

function loadPrefs(storage) {
  try {
    const raw = storage?.getItem('snake3310_prefs');
    if (!raw) return { level: DEFAULT_LEVEL, mazeIndex: 0 };
    const parsed = JSON.parse(raw);
    const normalizedMaze = Number.isInteger(parsed.mazeIndex)
      ? ((parsed.mazeIndex % MAZES.length) + MAZES.length) % MAZES.length
      : 0;
    return {
      level: Number.isInteger(parsed.level) ? Math.min(9, Math.max(1, parsed.level)) : DEFAULT_LEVEL,
      mazeIndex: normalizedMaze,
    };
  } catch {
    return { level: DEFAULT_LEVEL, mazeIndex: 0 };
  }
}

function savePrefs(storage, prefs) {
  try {
    storage?.setItem('snake3310_prefs', JSON.stringify(prefs));
  } catch {
    // Ignore storage quota or restricted environments
  }
}

export class SnakeEngine {
  constructor(options = {}) {
    this.rng = options.rng ?? Math.random;
    this.storage = options.storage ?? createMemoryStorage();
    this.onEvent = options.onEvent ?? (() => {});

    const saved = loadHighScore(this.storage);
    this.highScore = saved;
    const savedPrefs = loadPrefs(this.storage);

    this.level = options.level ?? savedPrefs.level; // 1..9
    this.mazeIndex = options.mazeIndex ?? savedPrefs.mazeIndex;
    this.soundEnabled = options.soundEnabled ?? true;

    this.mode = options.skipSplash ? 'menu' : 'splash';
    this.splashElapsedMs = 0;

    // Menu state
    this.menuScreen = 'main'; // 'main' | 'level' | 'maze' | 'highscore'
    this.menuIndex = 0;
    this.hasPausedGame = false;

    // Live gameplay state
    this.segments = [];
    this.direction = 'right';
    this.turnQueue = [];
    this.food = null;
    this.bonus = null;
    this.bulges = [];
    this.pendingGrowth = 0;
    this.score = 0;
    this.foodsEaten = 0;
    this.foodsSinceBonus = 0;
    this.bonusCounter = 0;
    this.stepAccumulatorMs = 0;
    this.inCollisionGrace = false;
    this.dyingElapsedMs = 0;
    this.isNewHighScore = false;
    this.ticks = 0;

    this._initSnakeState();
  }

  get maze() {
    return getMazeByIndex(this.mazeIndex);
  }

  get stepMs() {
    return LEVEL_STEP_MS[Math.min(8, Math.max(0, this.level - 1))];
  }

  get mainMenuItems() {
    const items = [];
    if (this.hasPausedGame) {
      items.push({ id: 'continue', label: 'Continue' });
    }
    items.push(
      { id: 'new-game', label: 'New game' },
      { id: 'level', label: 'Level' },
      { id: 'mazes', label: 'Mazes' },
      { id: 'top-score', label: 'Top score' },
      { id: 'sound', label: this.soundEnabled ? 'Sound: On' : 'Sound: Off' },
    );
    return items;
  }

  _emit(type, payload = {}) {
    this.onEvent({ type, ...payload });
  }

  _initSnakeState() {
    // Spawn horizontally at row 4, head at x=8, tail at x=3, facing right
    this.segments = [
      { x: 8, y: 4 },
      { x: 7, y: 4 },
      { x: 6, y: 4 },
      { x: 5, y: 4 },
      { x: 4, y: 4 },
      { x: 3, y: 4 },
    ];
    this.direction = 'right';
    this.turnQueue = [];
    this.bulges = [];
    this.pendingGrowth = 0;
    this.score = 0;
    this.foodsEaten = 0;
    this.foodsSinceBonus = 0;
    this.bonus = null;
    this.stepAccumulatorMs = 0;
    this.inCollisionGrace = false;
    this.dyingElapsedMs = 0;
    this.isNewHighScore = false;
    this.ticks = 0;
    this.food = this._spawnFood();
  }

  startNewGame() {
    this._initSnakeState();
    this.hasPausedGame = false;
    this.mode = 'playing';
    this._emit('start');
  }

  resumeGame() {
    if (!this.hasPausedGame) {
      this.startNewGame();
      return;
    }
    this.mode = 'playing';
    this.stepAccumulatorMs = 0;
    this._emit('select');
  }

  pauseToMenu() {
    if (this.mode !== 'playing') return;
    this.hasPausedGame = true;
    this.mode = 'menu';
    this.menuScreen = 'main';
    this.menuIndex = 0; // Highlights "Continue"
    this._emit('back');
  }

  toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    this._emit('sound-toggle', { enabled: this.soundEnabled });
  }

  setDirection(dir) {
    if (!DIRECTIONS[dir]) return false;

    if (this.mode === 'splash') {
      this.mode = 'menu';
      this.menuScreen = 'main';
      this.menuIndex = 0;
      this._emit('nav');
      return true;
    }

    if (this.mode === 'menu') {
      this._handleMenuDirection(dir);
      return true;
    }

    if (this.mode !== 'playing') return false;

    // During collision grace, let the player replace a fatal turn OR queue a 2nd turn after a safe rescue
    if (this.inCollisionGrace) {
      if (
        this.turnQueue.length > 0 &&
        dir === OPPOSITE[this.direction] &&
        dir !== this.turnQueue[0] &&
        dir !== OPPOSITE[this.turnQueue[0]] &&
        !this._isFatalCell(this._computeNextHead(this.turnQueue[0]))
      ) {
        this.turnQueue = [this.turnQueue[0], dir];
        return true;
      }
      if (dir === OPPOSITE[this.direction]) return false;
      this.turnQueue = [dir];
      return true;
    }

    const lastDir = this.turnQueue.length > 0
      ? this.turnQueue[this.turnQueue.length - 1]
      : this.direction;

    if (dir === lastDir || dir === OPPOSITE[lastDir]) {
      return false;
    }

    if (this.turnQueue.length < 2) {
      this.turnQueue.push(dir);
    } else {
      // Allow updating second queued turn if player corrects quickly
      const firstDir = this.turnQueue[0];
      if (dir !== firstDir && dir !== OPPOSITE[firstDir]) {
        this.turnQueue[1] = dir;
      }
    }

    return true;
  }

  pressSelect() {
    if (this.mode === 'splash') {
      this.startNewGame();
      return;
    }
    if (this.mode === 'playing') {
      this.pauseToMenu();
      return;
    }
    if (this.mode === 'gameover' || this.mode === 'victory') {
      this.startNewGame();
      return;
    }
    if (this.mode === 'dying') {
      return;
    }

    // Menu selection
    if (this.menuScreen === 'main') {
      const items = this.mainMenuItems;
      const item = items[this.menuIndex] ?? items[0];
      switch (item.id) {
        case 'continue':
          this.resumeGame();
          break;
        case 'new-game':
          this.startNewGame();
          break;
        case 'level':
          this.menuScreen = 'level';
          this._emit('select');
          break;
        case 'mazes':
          this.menuScreen = 'maze';
          this._emit('select');
          break;
        case 'top-score':
          this.menuScreen = 'highscore';
          this._emit('select');
          break;
        case 'sound':
          this.toggleSound();
          break;
      }
      return;
    }

    // Sub-screens confirm & return to main menu
    if (this.menuScreen === 'level' || this.menuScreen === 'maze' || this.menuScreen === 'highscore') {
      this.menuScreen = 'main';
      this._emit('select');
    }
  }

  pressBack() {
    if (this.mode === 'splash') {
      this.mode = 'menu';
      this.menuScreen = 'main';
      this.menuIndex = 0;
      this._emit('back');
      return;
    }
    if (this.mode === 'playing') {
      this.pauseToMenu();
      return;
    }
    if (this.mode === 'gameover' || this.mode === 'victory') {
      this.hasPausedGame = false;
      this.mode = 'menu';
      this.menuScreen = 'main';
      this.menuIndex = 0;
      this._emit('back');
      return;
    }
    if (this.mode === 'menu' && this.menuScreen !== 'main') {
      this.menuScreen = 'main';
      this._emit('back');
      return;
    }
    if (this.mode === 'menu' && this.menuScreen === 'main' && this.hasPausedGame) {
      this.resumeGame();
    }
  }

  _discardPausedGameForSettingChange() {
    if (this.hasPausedGame) {
      this.hasPausedGame = false;
      this.menuIndex = Math.max(0, this.menuIndex - 1);
    }
  }

  _handleMenuDirection(dir) {
    if (this.menuScreen === 'main') {
      const len = this.mainMenuItems.length;
      if (dir === 'up') {
        this.menuIndex = (this.menuIndex - 1 + len) % len;
        this._emit('nav');
      } else if (dir === 'down') {
        this.menuIndex = (this.menuIndex + 1) % len;
        this._emit('nav');
      }
      return;
    }

    if (this.menuScreen === 'level') {
      if (dir === 'right' || dir === 'up') {
        const next = Math.min(9, this.level + 1);
        if (next !== this.level) {
          this.level = next;
          this._discardPausedGameForSettingChange();
          savePrefs(this.storage, { level: this.level, mazeIndex: this.mazeIndex });
        }
        this._emit('nav');
      } else if (dir === 'left' || dir === 'down') {
        const next = Math.max(1, this.level - 1);
        if (next !== this.level) {
          this.level = next;
          this._discardPausedGameForSettingChange();
          savePrefs(this.storage, { level: this.level, mazeIndex: this.mazeIndex });
        }
        this._emit('nav');
      }
      return;
    }

    if (this.menuScreen === 'maze') {
      if (dir === 'down' || dir === 'right') {
        this.mazeIndex = (this.mazeIndex + 1) % MAZES.length;
        this._discardPausedGameForSettingChange();
        savePrefs(this.storage, { level: this.level, mazeIndex: this.mazeIndex });
        this._emit('nav');
      } else if (dir === 'up' || dir === 'left') {
        this.mazeIndex = (this.mazeIndex - 1 + MAZES.length) % MAZES.length;
        this._discardPausedGameForSettingChange();
        savePrefs(this.storage, { level: this.level, mazeIndex: this.mazeIndex });
        this._emit('nav');
      }
    }
  }

  update(dtMs) {
    const dt = Math.min(100, Math.max(0, dtMs));

    if (this.mode === 'splash') {
      this.splashElapsedMs += dt;
      if (this.splashElapsedMs >= SPLASH_DURATION_MS) {
        this.mode = 'menu';
        this.menuScreen = 'main';
        this.menuIndex = 0;
      }
      return;
    }

    if (this.mode === 'dying') {
      this.dyingElapsedMs += dt;
      if (this.dyingElapsedMs >= DYING_DURATION_MS) {
        this.mode = 'gameover';
        this.hasPausedGame = false;
      }
      return;
    }

    if (this.mode !== 'playing') return;

    this.stepAccumulatorMs += dt;
    const graceWindowMs = Math.max(this.stepMs, 115);
    const threshold = this.inCollisionGrace ? graceWindowMs : this.stepMs;

    if (this.stepAccumulatorMs >= threshold) {
      this.stepAccumulatorMs -= threshold;
      this.step();
    }
  }

  _computeNextHead(dir) {
    const head = this.segments[0];
    const vec = DIRECTIONS[dir];
    let nx = head.x + vec.dx;
    let ny = head.y + vec.dy;

    if (this.maze.solidBorder) {
      if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) {
        return { x: nx, y: ny, outOfBounds: true };
      }
    } else {
      nx = (nx + GRID_COLS) % GRID_COLS;
      ny = (ny + GRID_ROWS) % GRID_ROWS;
    }

    return { x: nx, y: ny, outOfBounds: false };
  }

  _isFatalCell(nextPos) {
    if (nextPos.outOfBounds) return true;
    if (this.maze.wallSet.has(cellKey(nextPos.x, nextPos.y))) return true;

    // Tail tip vacates its cell unless the snake is growing on this exact step
    const checkLen = this.pendingGrowth > 0
      ? this.segments.length
      : this.segments.length - 1;

    for (let i = 0; i < checkLen; i++) {
      const seg = this.segments[i];
      if (seg.x === nextPos.x && seg.y === nextPos.y) {
        return true;
      }
    }

    return false;
  }

  isMouthOpen() {
    if (this.mode !== 'playing' && this.mode !== 'dying') return false;
    const ahead = this._computeNextHead(this.direction);
    if (ahead.outOfBounds) return false;
    if (this.food && ahead.x === this.food.x && ahead.y === this.food.y) {
      return true;
    }
    if (
      this.bonus &&
      ahead.y === this.bonus.y &&
      (ahead.x === this.bonus.x || ahead.x === this.bonus.x + 1)
    ) {
      return true;
    }
    return false;
  }

  step() {
    if (this.mode !== 'playing') return;

    const plannedDir = this.turnQueue.length > 0 ? this.turnQueue[0] : this.direction;
    const nextPos = this._computeNextHead(plannedDir);

    if (this._isFatalCell(nextPos)) {
      if (!this.inCollisionGrace) {
        // Authentic Snake II 1-tick collision grace: give the player one beat to turn away
        this.inCollisionGrace = true;
        return;
      }

      // Grace expired and still colliding -> crash!
      this.inCollisionGrace = false;
      if (this.turnQueue.length > 0) {
        this.direction = this.turnQueue.shift();
      }
      this.mode = 'dying';
      this.dyingElapsedMs = 0;
      this._recordHighScoreIfNeeded();
      this._emit('gameover', { score: this.score, isNewHighScore: this.isNewHighScore });
      return;
    }

    // Commit valid move
    this.inCollisionGrace = false;
    if (this.turnQueue.length > 0) {
      this.direction = this.turnQueue.shift();
    }
    this.ticks += 1;

    const newHead = { x: nextPos.x, y: nextPos.y };
    this.segments.unshift(newHead);

    let ateFood = false;
    let ateBonus = false;

    if (this.food && newHead.x === this.food.x && newHead.y === this.food.y) {
      ateFood = true;
      this.pendingGrowth += 1;
      this.score += this.level;
      this.foodsEaten += 1;
      this.foodsSinceBonus += 1;
      this.bulges.push({ x: newHead.x, y: newHead.y });
      this._recordHighScoreIfNeeded();
      this._emit('eat', { score: this.score });
    }

    if (
      this.bonus &&
      newHead.y === this.bonus.y &&
      (newHead.x === this.bonus.x || newHead.x === this.bonus.x + 1)
    ) {
      ateBonus = true;
      const bonusPoints = Math.max(
        this.level,
        Math.round((this.bonus.ticksLeft / this.bonus.maxTicks) * this.level * 5),
      );
      this.score += bonusPoints;
      this.bulges.push({ x: newHead.x, y: newHead.y });
      this.bonus = null;
      this._recordHighScoreIfNeeded();
      this._emit('bonus', { score: this.score, bonusPoints });
    }

    if (this.pendingGrowth > 0) {
      this.pendingGrowth -= 1;
    } else {
      this.segments.pop();
    }

    // Keep bulges that still sit on an interior body segment (slides head -> tail visually)
    if (this.bulges.length > 0) {
      const interiorKeys = new Set();
      for (let i = 1; i < this.segments.length - 1; i++) {
        interiorKeys.add(cellKey(this.segments[i].x, this.segments[i].y));
      }
      // Also keep a bulge just eaten at the head so it shifts into segment 1 next step
      if (ateFood || ateBonus) {
        interiorKeys.add(cellKey(newHead.x, newHead.y));
      }
      this.bulges = this.bulges.filter((b) => interiorKeys.has(cellKey(b.x, b.y)));
    }

    // Tick existing bonus countdown
    if (this.bonus && !ateBonus) {
      this.bonus.ticksLeft -= 1;
      if (this.bonus.ticksLeft <= 0) {
        this.bonus = null;
      }
    }

    // Respawn food & possibly spawn bonus critter
    if (ateFood) {
      this.food = this._spawnFood();
      if (!this.food && this.bonus) {
        // Free cells still exist under an active bonus critter; clear bonus so food can spawn
        this.bonus = null;
        this.food = this._spawnFood();
      }
      if (!this.food) {
        // Board completely filled -> Victory!
        this.bonus = null;
        this.mode = 'victory';
        this.hasPausedGame = false;
        this._recordHighScoreIfNeeded();
        this._emit('victory', { score: this.score, isNewHighScore: this.isNewHighScore });
        return;
      }

      if (this.foodsSinceBonus >= BONUS_INTERVAL && !this.bonus) {
        const spawned = this._spawnBonus();
        if (spawned) {
          this.foodsSinceBonus = 0;
          this.bonus = spawned;
          this._emit('bonus-spawn', { bonus: this.bonus });
        }
      }
    }
  }

  _occupiedSet() {
    const occupied = new Set(this.maze.wallSet);
    for (const seg of this.segments) {
      occupied.add(cellKey(seg.x, seg.y));
    }
    if (this.food) {
      occupied.add(cellKey(this.food.x, this.food.y));
    }
    if (this.bonus) {
      occupied.add(cellKey(this.bonus.x, this.bonus.y));
      occupied.add(cellKey(this.bonus.x + 1, this.bonus.y));
    }
    return occupied;
  }

  _spawnFood() {
    const occupied = new Set(this.maze.wallSet);
    for (const seg of this.segments) {
      occupied.add(cellKey(seg.x, seg.y));
    }
    if (this.bonus) {
      occupied.add(cellKey(this.bonus.x, this.bonus.y));
      occupied.add(cellKey(this.bonus.x + 1, this.bonus.y));
    }

    const candidates = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS; x++) {
        if (!occupied.has(cellKey(x, y))) {
          candidates.push({ x, y });
        }
      }
    }

    if (candidates.length === 0) return null;
    const idx = Math.floor(this.rng() * candidates.length);
    return candidates[Math.min(candidates.length - 1, idx)];
  }

  _spawnBonus() {
    const occupied = this._occupiedSet();
    const candidates = [];
    for (let y = 0; y < GRID_ROWS; y++) {
      for (let x = 0; x < GRID_COLS - 1; x++) {
        if (!occupied.has(cellKey(x, y)) && !occupied.has(cellKey(x + 1, y))) {
          candidates.push({ x, y });
        }
      }
    }
    if (candidates.length === 0) return null;
    const idx = Math.floor(this.rng() * candidates.length);
    const pos = candidates[Math.min(candidates.length - 1, idx)];
    const type = BONUS_TYPES[this.bonusCounter % BONUS_TYPES.length];
    this.bonusCounter += 1;
    return {
      x: pos.x,
      y: pos.y,
      type,
      ticksLeft: BONUS_DURATION_TICKS,
      maxTicks: BONUS_DURATION_TICKS,
    };
  }

  _recordHighScoreIfNeeded() {
    if (this.score > this.highScore.score) {
      this.isNewHighScore = true;
      this.highScore = {
        score: this.score,
        mazeIndex: this.mazeIndex,
        level: this.level,
      };
      saveHighScore(this.storage, this.highScore);
    }
  }
}

export { GRID_COLS, GRID_ROWS, MAZES };
