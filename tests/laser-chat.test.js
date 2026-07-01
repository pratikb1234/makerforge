// Laser copilot — pure helpers: y-DOWN preset outlines and whitelisted 2D
// object edits (center conversion, path rescaling). Tests shipped code in
// laser-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };

const { lcPresetProfile, lcApplyChanges } =
  loadFunctions('laser-studio.html', ['lcPresetProfile', 'lcApplyChanges']);

// ---------- presets (y-DOWN screen space) ----------
const span = (pts, i) => Math.max(...pts.map(p => p[i])) - Math.min(...pts.map(p => p[i]));
// signed area NEGATIVE in y-down coords == CCW on screen
const area = pts => { let s = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }); return s / 2; };

const heart = lcPresetProfile('heart', { width: 30 });
ok(heart && heart.length === 48, 'heart: 48 points');
ok(Math.abs(span(heart, 0) - 30) < 1e-9, 'heart: width 30');
// y-down: the heart's point (bottom tip) must be at MAX y, lobes at min y
const tipY = Math.max(...heart.map(p => p[1]));
const lobeY = Math.min(...heart.map(p => p[1]));
const tipPt = heart.find(p => p[1] === tipY);
ok(Math.abs(tipPt[0]) < 1, 'heart: bottom tip on the centreline (not upside-down in y-down space)');
ok(Math.abs(tipY) > Math.abs(lobeY) * 0.9, 'heart: tip extends below centre');

for (const [name, opts, w, h] of [
  ['gear', { width: 40, teeth: 8 }, 40, null],
  ['slot', { width: 40, height: 12 }, 40, 12],
  ['arch', { width: 30, height: 40 }, 30, 40],
  ['arrow', { width: 24, height: 40 }, 24, 40],
  ['cross', { width: 30, thickness: 10 }, 30, 30],
  ['lbracket', { width: 40, height: 40, thickness: 12 }, 40, 40],
]) {
  const pts = lcPresetProfile(name, opts);
  ok(pts && pts.length >= 3, `${name}: generates points`);
  if (w) ok(Math.abs(span(pts, 0) - w) < 0.5, `${name}: width ≈ ${w}`);
  if (h) ok(Math.abs(span(pts, 1) - h) < 0.5, `${name}: height ≈ ${h}`);
}
// arch in y-down space: flat edge at max y (bottom), curve at min y (top)
const arch = lcPresetProfile('arch', { width: 30, height: 40 });
const botPts = arch.filter(p => Math.abs(p[1] - Math.max(...arch.map(q => q[1]))) < 1e-9);
ok(botPts.length === 2, 'arch: flat bottom edge in y-down space');
ok(lcPresetProfile('nope') === null, 'unknown preset → null');

// ---------- lcApplyChanges ----------
let o = { id: 1, type: 'rect', x: 10, y: 20, w: 40, h: 30, rot: 0, rad: 0 };
let r = lcApplyChanges(o, { cx: 100, cy: 50 });
ok(o.x === 80 && o.y === 35, 'cx/cy converted to top-left');
r = lcApplyChanges(o, { w: 60, rot: 45, rad: 5 });
ok(o.w === 60 && o.rot === 45 && o.rad === 5, 'numeric edits applied');
r = lcApplyChanges(o, { sides: 8, q: 1 });
ok(r.rejected.includes('sides') && r.rejected.includes('q'), 'keys absent on the type rejected');

// path rescaling: doubling w scales pts x
o = { id: 2, type: 'pen', x: 0, y: 0, w: 20, h: 10, rot: 0, closed: true,
  pts: [{ x: 0, y: 0 }, { x: 20, y: 0 }, { x: 20, y: 10 }] };
r = lcApplyChanges(o, { w: 40 });
ok(o.w === 40 && o.pts[1].x === 40 && o.pts[1].y === 0, 'path w edit rescales points on x only');
r = lcApplyChanges(o, { h: 30 });
ok(o.pts[2].y === 30, 'path h edit rescales points on y');

// text object
o = { id: 3, type: 'text', x: 0, y: 0, w: 40, h: 14, rot: 0, text: 'HI', size: 14 };
r = lcApplyChanges(o, { text: 'BYE', size: 20 });
ok(o.text === 'BYE' && o.size === 20, 'text + size editable');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
