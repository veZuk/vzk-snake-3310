import assert from 'node:assert/strict';
import { GRID_COLS, GRID_ROWS, MAZES, cellKey } from '../src/game/mazes.js';
import {
  BONUS_DURATION_TICKS,
  BONUS_INTERVAL,
  SnakeEngine,
  createMemoryStorage,
} from '../src/game/snake-engine.js';

function makeDeterministicRng(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// 1. Validate all 6 mazes: spawn clearance, full connectivity, and zero dead-end pockets
for (const maze of MAZES) {
  // Spawn segments (3..8, 4) and 5-cell runway ahead (9..13, 4) must be completely free
  for (let x = 3; x <= 13; x++) {
    assert.equal(
      maze.wallSet.has(cellKey(x, 4)),
      false,
      `Maze "${maze.name}" blocks spawn/runway cell (${x}, 4)`,
    );
  }

  const walkable = [];
  for (let y = 0; y < GRID_ROWS; y++) {
    for (let x = 0; x < GRID_COLS; x++) {
      if (!maze.wallSet.has(cellKey(x, y))) {
        walkable.push({ x, y });
      }
    }
  }

  // BFS reachability from spawn head (8, 4)
  const visited = new Set([cellKey(8, 4)]);
  const queue = [{ x: 8, y: 4 }];
  while (queue.length > 0) {
    const cur = queue.shift();
    const neighbors = [
      { x: cur.x + 1, y: cur.y },
      { x: cur.x - 1, y: cur.y },
      { x: cur.x, y: cur.y + 1 },
      { x: cur.x, y: cur.y - 1 },
    ];
    for (const n of neighbors) {
      let nx = n.x;
      let ny = n.y;
      if (maze.solidBorder) {
        if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
      } else {
        nx = (nx + GRID_COLS) % GRID_COLS;
        ny = (ny + GRID_ROWS) % GRID_ROWS;
      }
      const key = cellKey(nx, ny);
      if (maze.wallSet.has(key) || visited.has(key)) continue;
      visited.add(key);
      queue.push({ x: nx, y: ny });
    }
  }

  assert.equal(
    visited.size,
    walkable.length,
    `Maze "${maze.name}" has unreachable cells (${visited.size}/${walkable.length})`,
  );

  // Check zero 1-exit dead-ends
  for (const cell of walkable) {
    let degree = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      let nx = cell.x + dx;
      let ny = cell.y + dy;
      if (maze.solidBorder) {
        if (nx < 0 || nx >= GRID_COLS || ny < 0 || ny >= GRID_ROWS) continue;
      } else {
        nx = (nx + GRID_COLS) % GRID_COLS;
        ny = (ny + GRID_ROWS) % GRID_ROWS;
      }
      if (!maze.wallSet.has(cellKey(nx, ny))) degree += 1;
    }
    assert.ok(
      degree >= 2,
      `Maze "${maze.name}" has dead-end at (${cell.x}, ${cell.y}) with degree ${degree}`,
    );
  }
}

// 2. Wrap-around movement in "No maze"
{
  const engine = new SnakeEngine({ rng: makeDeterministicRng(1), skipSplash: true, mazeIndex: 0 });
  engine.startNewGame();
  engine.food = { x: 0, y: 0 };
  for (let i = 0; i < 12; i++) engine.step();
  assert.equal(engine.mode, 'playing');
  assert.equal(engine.segments[0].x, (8 + 12) % GRID_COLS);
  assert.equal(engine.segments[0].y, 4);
}

// 3. Solid border collision grace & rescue turn in "Box" maze
{
  const events = [];
  const engine = new SnakeEngine({
    rng: makeDeterministicRng(2),
    skipSplash: true,
    mazeIndex: 1, // Box
    onEvent: (e) => events.push(e.type),
  });
  engine.startNewGame();
  engine.food = { x: 1, y: 1 };
  // Move head from x=8 to x=19 (11 steps)
  for (let i = 0; i < 11; i++) engine.step();
  assert.equal(engine.segments[0].x, 19);
  assert.equal(engine.inCollisionGrace, false);

  // Next step hits wall -> enters 1-tick collision grace instead of instant death
  engine.step();
  assert.equal(engine.mode, 'playing');
  assert.equal(engine.inCollisionGrace, true);
  assert.equal(engine.segments[0].x, 19);

  // Rescue turn upward during grace saves the snake!
  engine.setDirection('up');
  engine.step();
  assert.equal(engine.mode, 'playing');
  assert.equal(engine.inCollisionGrace, false);
  assert.deepEqual(engine.segments[0], { x: 19, y: 3 });

  // Turn right back into wall and do NOT rescue -> grace, then dying -> gameover
  engine.setDirection('right');
  engine.step(); // enters grace
  assert.equal(engine.inCollisionGrace, true);
  engine.step(); // dies
  assert.equal(engine.mode, 'dying');
  assert.ok(events.includes('gameover'));

  engine.update(100);
  for (let i = 0; i < 12; i++) engine.update(100);
  assert.equal(engine.mode, 'gameover');
}

// 4. Two-step turn queue prevents accidental 180-degree suicide and executes sharp U-turns
{
  const engine = new SnakeEngine({ rng: makeDeterministicRng(3), skipSplash: true });
  engine.startNewGame();
  engine.food = { x: 0, y: 0 };

  assert.equal(engine.setDirection('left'), false, 'Direct 180-degree reversal must be rejected');
  assert.equal(engine.setDirection('up'), true);
  assert.equal(engine.setDirection('left'), true); // Queued as 2nd turn!

  engine.step();
  assert.equal(engine.direction, 'up');
  assert.deepEqual(engine.segments[0], { x: 8, y: 3 });

  engine.step();
  assert.equal(engine.direction, 'left');
  assert.deepEqual(engine.segments[0], { x: 7, y: 3 });
}

// 5. Mouth-open detection, eating, bulge travel, bonus critter spawn & scoring, high score save
{
  const storage = createMemoryStorage();
  const events = [];
  const engine = new SnakeEngine({
    rng: makeDeterministicRng(4),
    storage,
    skipSplash: true,
    level: 7,
    onEvent: (e) => events.push(e),
  });
  engine.startNewGame();
  const initialLen = engine.segments.length;

  // Place food right in front of head -> mouth should open!
  engine.food = { x: 9, y: 4 };
  assert.equal(engine.isMouthOpen(), true);

  engine.step();
  assert.equal(engine.segments.length, initialLen + 1);
  assert.equal(engine.score, 7);
  assert.equal(engine.bulges.length, 1);
  assert.deepEqual(engine.bulges[0], { x: 9, y: 4 });

  // Eat 4 more regular foods to trigger bonus critter on the 5th!
  for (let n = 1; n < BONUS_INTERVAL; n++) {
    const head = engine.segments[0];
    engine.food = { x: (head.x + 1) % GRID_COLS, y: head.y };
    engine.step();
  }

  assert.ok(engine.bonus !== null, 'Bonus critter should spawn after 5 regular foods');
  assert.equal(engine.bonus.ticksLeft, BONUS_DURATION_TICKS);

  // Move bonus right ahead of head and eat it without growing length
  const preBonusLen = engine.segments.length;
  const preBonusScore = engine.score;
  const head = engine.segments[0];
  engine.food = { x: 0, y: 0 };
  engine.bonus.x = (head.x + 1) % GRID_COLS;
  engine.bonus.y = head.y;
  assert.equal(engine.isMouthOpen(), true);

  engine.step();
  assert.equal(engine.bonus, null);
  assert.equal(engine.segments.length, preBonusLen, 'Bonus critter awards points without extra length');
  assert.ok(engine.score > preBonusScore, 'Bonus critter increases score');
  assert.ok(events.some((e) => e.type === 'bonus'));
}

// 6. Tail chase safety: stepping into vacating tail tip is legal when not growing
{
  const engine = new SnakeEngine({ rng: makeDeterministicRng(5), skipSplash: true, mazeIndex: 0 });
  engine.startNewGame();
  engine.food = { x: 0, y: 0 };
  // Construct tight 2x2 square loop of 4 segments
  engine.segments = [
    { x: 5, y: 4 }, // head
    { x: 6, y: 4 },
    { x: 6, y: 5 },
    { x: 5, y: 5 }, // tail tip directly below head!
  ];
  engine.direction = 'left';
  engine.pendingGrowth = 0;
  engine.setDirection('down');
  engine.step();

  assert.equal(engine.mode, 'playing');
  assert.equal(engine.inCollisionGrace, false);
  assert.deepEqual(engine.segments[0], { x: 5, y: 5 });
}

// 7. Changing maze or level while paused discards paused game without shifting menu selection
{
  const engine = new SnakeEngine({ rng: makeDeterministicRng(6), skipSplash: true, level: 5, mazeIndex: 0 });
  engine.startNewGame();
  engine.pauseToMenu();
  assert.equal(engine.hasPausedGame, true);
  assert.equal(engine.mainMenuItems[0].id, 'continue');

  // Navigate to Mazes (index 3), enter submenu, change maze, return -> still on 'mazes'!
  engine.setDirection('down');
  engine.setDirection('down');
  engine.setDirection('down');
  assert.equal(engine.mainMenuItems[engine.menuIndex].id, 'mazes');
  engine.pressSelect();
  assert.equal(engine.menuScreen, 'maze');
  engine.setDirection('right');
  assert.equal(engine.hasPausedGame, false);
  engine.pressSelect();
  assert.equal(engine.menuScreen, 'main');
  assert.equal(engine.mainMenuItems[engine.menuIndex].id, 'mazes');

  // Same for Level while paused: stays on 'level' after discarding paused game
  engine.startNewGame();
  engine.pauseToMenu();
  engine.setDirection('down'); // new-game
  engine.setDirection('down'); // level
  assert.equal(engine.mainMenuItems[engine.menuIndex].id, 'level');
  engine.pressSelect();
  engine.setDirection('right');
  assert.equal(engine.hasPausedGame, false);
  engine.pressSelect();
  assert.equal(engine.mainMenuItems[engine.menuIndex].id, 'level');
}

// 8. High score saves immediately on scoring and persists across instances
{
  const storage = createMemoryStorage();
  const engine1 = new SnakeEngine({ rng: makeDeterministicRng(7), storage, skipSplash: true, level: 6 });
  engine1.startNewGame();
  engine1.food = { x: 9, y: 4 };
  engine1.step();
  assert.equal(engine1.score, 6);
  assert.equal(engine1.isNewHighScore, true);
  assert.equal(engine1.highScore.score, 6);

  const engine2 = new SnakeEngine({ rng: makeDeterministicRng(7), storage, skipSplash: true });
  assert.equal(engine2.highScore.score, 6);
  assert.equal(engine2.highScore.level, 6);
}

// 9. Active bonus on last 2 free cells must NOT cause premature victory when food is eaten
{
  const engine = new SnakeEngine({ rng: makeDeterministicRng(8), skipSplash: true, mazeIndex: 0 });
  engine.startNewGame();
  // Build a snake occupying every cell except (0,0), (1,0), (2,0)
  const segs = [];
  for (let y = GRID_ROWS - 1; y >= 0; y--) {
    const xs = y % 2 === 0
      ? Array.from({ length: GRID_COLS }, (_, i) => GRID_COLS - 1 - i)
      : Array.from({ length: GRID_COLS }, (_, i) => i);
    for (const x of xs) {
      if (y === 0 && (x === 0 || x === 1 || x === 2)) continue;
      segs.push({ x, y });
    }
  }
  // Reverse so head is at (3,0) facing left toward (2,0)
  segs.reverse();
  assert.deepEqual(segs[0], { x: 3, y: 0 });
  engine.segments = segs;
  engine.direction = 'left';
  engine.pendingGrowth = 0;
  engine.food = { x: 2, y: 0 };
  engine.bonus = { x: 0, y: 0, type: 'mouse', ticksLeft: 10, maxTicks: 20 };

  engine.step();
  assert.equal(engine.mode, 'playing', 'Eating food while bonus covers remaining 2 cells must clear bonus and continue');
  assert.equal(engine.bonus, null);
  assert.ok(engine.food !== null && engine.food.y === 0 && (engine.food.x === 0 || engine.food.x === 1));
}

// 10. Rapid 2-step U-turn rescue during collision grace & corrupted storage normalization
{
  const storage = createMemoryStorage();
  storage.setItem('snake3310_topscore', JSON.stringify({ score: 42, mazeIndex: -5, level: 99 }));
  const engine = new SnakeEngine({
    rng: makeDeterministicRng(9),
    storage,
    skipSplash: true,
    mazeIndex: 1, // Box
  });
  assert.equal(engine.highScore.score, 42);
  assert.equal(engine.highScore.level, 9);
  assert.ok(engine.highScore.mazeIndex >= 0 && engine.highScore.mazeIndex < MAZES.length);

  engine.startNewGame();
  engine.food = { x: 1, y: 1 };
  // Move head from x=8 to x=19 (11 steps)
  for (let i = 0; i < 11; i++) engine.step();
  // Hit right wall -> enters collision grace
  engine.step();
  assert.equal(engine.inCollisionGrace, true);
  // Direct 180-degree reversal before any rescue turn is still rejected
  assert.equal(engine.setDirection('left'), false);
  // Press 'up' (safe rescue) then immediately 'left' (U-turn 2nd step)
  assert.equal(engine.setDirection('up'), true);
  assert.equal(engine.setDirection('left'), true);

  engine.step();
  assert.equal(engine.mode, 'playing');
  assert.equal(engine.direction, 'up');
  assert.deepEqual(engine.segments[0], { x: 19, y: 3 });

  engine.step();
  assert.equal(engine.mode, 'playing');
  assert.equal(engine.direction, 'left');
  assert.deepEqual(engine.segments[0], { x: 18, y: 3 });
}

// 11. Default beginner-friendly Level 3 speed & level/maze preference persistence
{
  const storage = createMemoryStorage();
  const engine1 = new SnakeEngine({ rng: makeDeterministicRng(10), storage, skipSplash: true });
  assert.equal(engine1.level, 3);
  assert.equal(engine1.stepMs, 255);
  // Navigate to Level submenu and increase to 4, then Mazes and select Box
  engine1.setDirection('down'); // level
  engine1.pressSelect();
  engine1.setDirection('right'); // level 4
  engine1.pressSelect();
  engine1.setDirection('down'); // mazes
  engine1.pressSelect();
  engine1.setDirection('right'); // Box (index 1)
  engine1.pressSelect();

  const engine2 = new SnakeEngine({ rng: makeDeterministicRng(10), storage, skipSplash: true });
  assert.equal(engine2.level, 4);
  assert.equal(engine2.mazeIndex, 1);
}

console.log(`check-snake-engine: OK (${MAZES.length} mazes validated, all mechanics passed)`);
