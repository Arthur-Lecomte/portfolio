// Sparse Game of Life engine on an unbounded grid.
// Live cells are stored in a Set keyed by "x,y" so the world has no edges.

export function key(x, y) {
  return x + ',' + y;
}

export function parseKey(k) {
  const i = k.indexOf(',');
  return [Number(k.slice(0, i)), Number(k.slice(i + 1))];
}

const NEIGHBORS = [
  [-1, -1],
  [0, -1],
  [1, -1],
  [-1, 0],
  [1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
];

// Advance one generation (B3/S23). Returns the next cell set plus the
// number of births and deaths, for the live stats display.
export function step(cells) {
  const counts = new Map();
  for (const k of cells) {
    const [x, y] = parseKey(k);
    for (const [dx, dy] of NEIGHBORS) {
      const nk = key(x + dx, y + dy);
      counts.set(nk, (counts.get(nk) || 0) + 1);
    }
  }
  const next = new Set();
  let births = 0;
  for (const [k, n] of counts) {
    if (n === 3 || (n === 2 && cells.has(k))) {
      next.add(k);
      if (!cells.has(k)) births += 1;
    }
  }
  const deaths = cells.size - (next.size - births);
  return { cells: next, births, deaths };
}

// Bounding box of the live cells, or null when the grid is empty.
export function boundingBox(cells) {
  if (cells.size === 0) return null;
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const k of cells) {
    const [x, y] = parseKey(k);
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, minY, maxX, maxY };
}
