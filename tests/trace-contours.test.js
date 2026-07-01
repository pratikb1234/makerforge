// Solid 3D text / freeform profiles — the pure contour pipeline that turns a
// binary bitmap into extrudable outlines: traceGridContours (boundary follow),
// simplifyLoop (collinear + RDP), assembleShapes (outer/hole nesting).
// Tests the shipped code inside cad-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };

const { traceGridContours, simplifyLoop, assembleShapes } =
  loadFunctions('cad-studio.html', ['traceGridContours', 'simplifyLoop', 'assembleShapes']);

const gridFn = rows => (x, y) => rows[y] && rows[y][x] === '#';
const totalEdges = loops => loops.reduce((n, l) => n + l.length, 0);

// ---- solid rectangle: one loop, 4 corners after simplify ----
let rows = ['....', '.##.', '.##.', '....'];
let loops = traceGridContours(gridFn(rows), 4, 4);
ok(loops.length === 1, 'solid rect: one loop');
let simp = simplifyLoop(loops[0]);
ok(simp.length === 4, `solid rect: 4 corners after simplify (got ${simp.length})`);
const xs = simp.map(p => p[0]), ys = simp.map(p => p[1]);
ok(Math.min(...xs) === 1 && Math.max(...xs) === 3 && Math.min(...ys) === 1 && Math.max(...ys) === 3, 'solid rect: corner coords exact');

// ---- ring: outer + hole ----
rows = ['.....', '.###.', '.#.#.', '.###.', '.....'];
loops = traceGridContours(gridFn(rows), 5, 5);
ok(loops.length === 2, 'ring: two loops (outer + hole)');
let shapes = assembleShapes(loops.map(l => simplifyLoop(l)));
ok(shapes.length === 1, 'ring: one shape');
ok(shapes[0].holes.length === 1, 'ring: one hole assigned');
const holeXs = shapes[0].holes[0].map(p => p[0]);
ok(Math.min(...holeXs) === 2 && Math.max(...holeXs) === 3, 'ring: hole is the inner square');

// ---- two islands: two independent shapes ----
rows = ['#..#', '#..#'];
loops = traceGridContours(gridFn(rows), 4, 2);
ok(loops.length === 2, 'two islands: two loops');
shapes = assembleShapes(loops.map(l => simplifyLoop(l)));
ok(shapes.length === 2 && shapes.every(s => s.holes.length === 0), 'two islands: two shapes, no holes');

// ---- island inside a hole (letter "©"-style nesting): outer, hole, inner outer ----
rows = [
  '#######',
  '#.....#',
  '#.###.#',
  '#.###.#',
  '#.....#',
  '#######',
];
loops = traceGridContours(gridFn(rows), 7, 6);
ok(loops.length === 3, 'nested: three loops');
shapes = assembleShapes(loops.map(l => simplifyLoop(l)));
ok(shapes.length === 2, 'nested: island in a hole becomes its own shape');
const withHole = shapes.find(s => s.holes.length === 1);
ok(!!withHole, 'nested: outer keeps exactly one hole');

// ---- L-shape: 6 corners, staircase preserved by collinear removal ----
rows = ['#..', '#..', '###'];
loops = traceGridContours(gridFn(rows), 3, 3);
simp = simplifyLoop(loops[0]);
ok(loops.length === 1 && simp.length === 6, `L-shape: 6 corners (got ${simp.length})`);

// ---- every boundary edge used exactly once (conservation) ----
rows = ['##.#', '####', '.##.'];
loops = traceGridContours(gridFn(rows), 4, 3);
let expected = 0;
for (let y = 0; y < 3; y++) for (let x = 0; x < 4; x++) {
  if (rows[y][x] !== '#') continue;
  [[0,-1],[1,0],[0,1],[-1,0]].forEach(([dx,dy]) => {
    const r = rows[y+dy]; if (!r || r[x+dx] !== '#') expected++;
  });
}
ok(totalEdges(loops) === expected, `edge conservation (${totalEdges(loops)} = ${expected})`);

// ---- RDP: a noisy near-straight staircase collapses ----
const stair = []; for (let i = 0; i < 20; i++) { stair.push([i, Math.floor(i/2)]); }
stair.push([19, 20], [0, 20]);
simp = simplifyLoop(stair, 1.2);
ok(simp.length < stair.length / 2, `RDP shrinks staircase ${stair.length}→${simp.length}`);

// ---- empty grid ----
ok(traceGridContours(() => false, 4, 4).length === 0, 'empty grid: no loops');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
