export const GRID_COLS = 20;
export const GRID_ROWS = 9;

export function cellKey(x, y) {
  return y * GRID_COLS + x;
}

function addLine(set, x0, y0, x1, y1) {
  const dx = Math.sign(x1 - x0);
  const dy = Math.sign(y1 - y0);
  let x = x0;
  let y = y0;
  while (true) {
    set.add(cellKey(x, y));
    if (x === x1 && y === y1) break;
    x += dx;
    y += dy;
  }
}

function buildMaze({ id, name, solidBorder, buildWalls }) {
  const wallSet = new Set();
  if (buildWalls) buildWalls(wallSet);
  const walls = [];
  for (const key of wallSet) {
    walls.push({ x: key % GRID_COLS, y: Math.floor(key / GRID_COLS) });
  }
  return {
    id,
    name,
    solidBorder,
    wallSet,
    walls,
  };
}

export const MAZES = [
  buildMaze({
    id: 'no-maze',
    name: 'No maze',
    solidBorder: false,
  }),
  buildMaze({
    id: 'box',
    name: 'Box',
    solidBorder: true,
  }),
  buildMaze({
    id: 'tunnel',
    name: 'Tunnel',
    solidBorder: false,
    buildWalls(s) {
      // Four corner brackets leaving side and top/bottom wrap portals
      addLine(s, 0, 0, 2, 0);
      addLine(s, 0, 0, 0, 2);
      addLine(s, 17, 0, 19, 0);
      addLine(s, 19, 0, 19, 2);
      addLine(s, 0, 8, 2, 8);
      addLine(s, 0, 6, 0, 8);
      addLine(s, 17, 8, 19, 8);
      addLine(s, 19, 6, 19, 8);
      // Central tunnel walls
      addLine(s, 6, 2, 13, 2);
      addLine(s, 6, 6, 13, 6);
    },
  }),
  buildMaze({
    id: 'mill',
    name: 'Mill',
    solidBorder: false,
    buildWalls(s) {
      // Four staggered windmill blades with wrap-around edges
      addLine(s, 5, 0, 5, 3);
      addLine(s, 14, 5, 14, 8);
      addLine(s, 0, 6, 5, 6);
      addLine(s, 14, 2, 19, 2);
    },
  }),
  buildMaze({
    id: 'rails',
    name: 'Rails',
    solidBorder: false,
    buildWalls(s) {
      // Top and bottom solid rail bounds (horizontal wrap stays open)
      addLine(s, 0, 0, 19, 0);
      addLine(s, 0, 8, 19, 8);
      // Inner parallel tracks
      addLine(s, 4, 2, 15, 2);
      addLine(s, 4, 6, 15, 6);
    },
  }),
  buildMaze({
    id: 'apartment',
    name: 'Apartment',
    solidBorder: false,
    buildWalls(s) {
      // Top/bottom outer walls with symmetrical doorways
      addLine(s, 0, 0, 5, 0);
      addLine(s, 8, 0, 11, 0);
      addLine(s, 14, 0, 19, 0);
      addLine(s, 0, 8, 5, 8);
      addLine(s, 8, 8, 11, 8);
      addLine(s, 14, 8, 19, 8);
      // Side walls with wide center passage (rows 3..5 open)
      addLine(s, 0, 1, 0, 2);
      addLine(s, 0, 6, 0, 7);
      addLine(s, 19, 1, 19, 2);
      addLine(s, 19, 6, 19, 7);
      // Inner room partitions
      addLine(s, 10, 1, 10, 2);
      addLine(s, 9, 6, 9, 7);
      addLine(s, 3, 2, 7, 2);
      addLine(s, 12, 6, 16, 6);
    },
  }),
];

export function getMazeByIndex(index) {
  const wrapped = ((index % MAZES.length) + MAZES.length) % MAZES.length;
  return MAZES[wrapped];
}
