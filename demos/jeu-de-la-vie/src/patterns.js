// Classic Game of Life patterns, drawn as ASCII art ('O' = live cell).
// Names and hints are in French (visible in the UI).

function cellsOf(rows) {
  const cells = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      if (row[x] === 'O') cells.push([x, y]);
    }
  });
  return cells;
}

const RAW = [
  {
    id: 'glider',
    name: 'Planeur',
    hint: 'Le plus petit vaisseau : glisse en diagonale.',
    rows: ['.O.', '..O', 'OOO'],
  },
  {
    id: 'lwss',
    name: 'Vaisseau léger',
    hint: 'Spaceship qui file horizontalement.',
    rows: ['.O..O', 'O....', 'O...O', 'OOOO.'],
  },
  {
    id: 'blinker',
    name: 'Clignotant',
    hint: 'Oscillateur le plus simple (période 2).',
    rows: ['OOO'],
  },
  {
    id: 'toad',
    name: 'Crapaud',
    hint: 'Oscillateur de période 2.',
    rows: ['.OOO', 'OOO.'],
  },
  {
    id: 'pulsar',
    name: 'Pulsar',
    hint: 'Grand oscillateur symétrique (période 3).',
    rows: [
      '..OOO...OOO..',
      '.............',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '..OOO...OOO..',
      '.............',
      '..OOO...OOO..',
      'O....O.O....O',
      'O....O.O....O',
      'O....O.O....O',
      '.............',
      '..OOO...OOO..',
    ],
  },
  {
    id: 'pentadecathlon',
    name: 'Pentadécathlon',
    hint: 'Oscillateur de période 15.',
    rows: ['..O....O..', 'OO.OOOO.OO', '..O....O..'],
  },
  {
    id: 'gosper-gun',
    name: 'Canon de Gosper',
    hint: 'Produit un planeur toutes les 30 générations.',
    rows: [
      '........................O...........',
      '......................O.O...........',
      '............OO......OO............OO',
      '...........O...O....OO............OO',
      'OO........O.....O...OO..............',
      'OO........O...O.OO....O.O...........',
      '..........O.....O.......O...........',
      '...........O...O....................',
      '............OO......................',
    ],
  },
  {
    id: 'r-pentomino',
    name: 'R-pentomino',
    hint: 'Cinq cellules, plus de 1000 générations de chaos.',
    rows: ['.OO', 'OO.', '.O.'],
  },
  {
    id: 'acorn',
    name: 'Gland',
    hint: 'Sept cellules qui explosent pendant 5206 générations.',
    rows: ['.O.....', '...O...', 'OO..OOO'],
  },
  {
    id: 'diehard',
    name: 'Diehard',
    hint: 'Disparaît totalement après 130 générations.',
    rows: ['......O.', 'OO......', '.O...OOO'],
  },
];

export const PATTERNS = RAW.map(({ id, name, hint, rows }) => ({
  id,
  name,
  hint,
  cells: cellsOf(rows),
  width: Math.max(...rows.map((r) => r.length)),
  height: rows.length,
}));

export const GOSPER_GUN = PATTERNS.find((p) => p.id === 'gosper-gun');
