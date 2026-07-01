// §6.2 — mass properties (volume via signed tetrahedra, surface area,
// centroid, watertight check with vertex welding, mass from density).
// Tests the massProps() shipped inside cad-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };
const close = (a, b, rel, m) => ok(Math.abs(a - b) <= Math.abs(b) * rel + 1e-9, `${m} (got ${a}, want ${b})`);

const { massProps } = loadFunctions('cad-studio.html', ['massProps']);

// ---------- helpers: build triangle soups ----------
function quad(a, b, c, d) { return [[...a, ...b, ...c], [...a, ...c, ...d]]; }
// axis-aligned cube [0,s]^3 centered at (ox,oy,oz), outward CCW winding
function cubeTris(s, ox = 0, oy = 0, oz = 0) {
  const p = (x, y, z) => [x * s + ox, y * s + oy, z * s + oz];
  const t = [];
  t.push(...quad(p(0,0,1), p(1,0,1), p(1,1,1), p(0,1,1)));      // +z
  t.push(...quad(p(1,0,0), p(0,0,0), p(0,1,0), p(1,1,0)));      // -z
  t.push(...quad(p(1,0,1), p(1,0,0), p(1,1,0), p(1,1,1)));      // +x
  t.push(...quad(p(0,0,0), p(0,0,1), p(0,1,1), p(0,1,0)));      // -x
  t.push(...quad(p(0,1,1), p(1,1,1), p(1,1,0), p(0,1,0)));      // +y
  t.push(...quad(p(0,0,0), p(1,0,0), p(1,0,1), p(0,0,1)));      // -y
  return t;
}
// UV sphere with per-face (unwelded, duplicated) vertices — the pole case
function sphereTris(r, segU = 48, segV = 24) {
  const P = (u, v) => {
    const th = 2 * Math.PI * u, ph = Math.PI * v;
    return [r * Math.sin(ph) * Math.cos(th), r * Math.cos(ph), r * Math.sin(ph) * Math.sin(th)];
  };
  const t = [];
  for (let i = 0; i < segU; i++) for (let j = 0; j < segV; j++) {
    const u0 = i / segU, u1 = (i + 1) / segU, v0 = j / segV, v1 = (j + 1) / segV;
    const a = P(u0, v0), b = P(u1, v0), c = P(u1, v1), d = P(u0, v1);
    if (j > 0) t.push([...a, ...c, ...b]);           // skip degenerate at north pole
    if (j < segV - 1) t.push([...a, ...d, ...c]);    // skip degenerate at south pole
  }
  return t;
}

// ---------- cube 10×10×10 ----------
let mp = massProps(cubeTris(10));
close(mp.volume, 1000, 1e-9, 'cube: volume = 1000 mm³');
close(mp.area, 600, 1e-9, 'cube: area = 600 mm²');
close(mp.centroid.x, 5, 1e-9, 'cube: centroid x = 5');
close(mp.centroid.y, 5, 1e-9, 'cube: centroid y = 5');
close(mp.centroid.z, 5, 1e-9, 'cube: centroid z = 5');
ok(mp.watertight, 'cube: watertight');
ok(mp.bbox.w === 10 && mp.bbox.h === 10 && mp.bbox.d === 10, 'cube: bbox 10×10×10');

// off-origin cube — signed-tetra volume must be translation-invariant
mp = massProps(cubeTris(10, 100, -50, 30));
close(mp.volume, 1000, 1e-9, 'off-origin cube: volume still 1000');
close(mp.centroid.x, 105, 1e-9, 'off-origin cube: centroid x = 105');

// ---------- open mesh detected ----------
const open = cubeTris(10).slice(2); // remove the +z face
mp = massProps(open);
ok(!mp.watertight, 'open mesh: watertight = false');
ok(mp.openEdges > 0, 'open mesh: open edges reported');

// ---------- sphere within 1% ----------
const r = 20;
mp = massProps(sphereTris(r));
close(mp.volume, 4 / 3 * Math.PI * r ** 3, 0.01, 'sphere: volume within 1%');
close(mp.area, 4 * Math.PI * r * r, 0.01, 'sphere: area within 1%');
close(mp.centroid.x, 0, 1, 'sphere: centroid ~origin x');
ok(mp.watertight, 'UV sphere with duplicated pole verts: watertight after weld (the 10/11 fix)');

// ---------- steel mass exact ----------
mp = massProps(cubeTris(10));
const massSteel = mp.volume / 1000 * 7.85;
close(massSteel, 7.85, 1e-9, 'steel 1 cm³ cube = 7.85 g');

// ---------- non-manifold detection (3 faces sharing an edge) ----------
const nm = cubeTris(10);
nm.push([0,0,10, 10,0,10, 5,-5,15]); // extra fin off a top edge
mp = massProps(nm);
ok(!mp.watertight && mp.openEdges >= 2, 'fin: mesh no longer watertight');

// ---------- empty ----------
mp = massProps([]);
ok(!mp.watertight && mp.volume === 0, 'empty soup: zero volume, not watertight');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
