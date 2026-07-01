// §4.3 — resize of rotated objects must work in the object's LOCAL frame and
// keep the opposite handle fixed in world space. Tests run against the code
// shipped inside both laser tools.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log('  ✅', msg); }
  else { fail++; console.log('  ❌', msg); }
}
function close(a, b, eps, msg) { ok(Math.abs(a - b) < (eps ?? 1e-9), msg + ` (got ${a}, want ${b})`); }

function rotPtRef(px, py, cx, cy, a) {
  const s = Math.sin(a), c = Math.cos(a), dx = px - cx, dy = py - cy;
  return { x: cx + dx * c - dy * s, y: cy + dx * s + dy * c };
}
// world position of a local box point after the box's center-rotation
function worldOf(box, rotDeg, lx, ly) {
  return rotPtRef(lx, ly, box.x + box.w / 2, box.y + box.h / 2, rotDeg * Math.PI / 180);
}
// anchor local coords for a handle (opposite point of the o0 box)
function anchorOf(o0, h) {
  return {
    x: h.includes('e') ? o0.x : h.includes('w') ? o0.x + o0.w : o0.x + o0.w / 2,
    y: h.includes('s') ? o0.y : h.includes('n') ? o0.y + o0.h : o0.y + o0.h / 2,
  };
}
// same anchor expressed in the NEW box's local coords
function anchorOfNew(n, h) {
  return {
    x: h.includes('e') ? n.x : h.includes('w') ? n.x + n.w : n.x + n.w / 2,
    y: h.includes('s') ? n.y : h.includes('n') ? n.y + n.h : n.y + n.h / 2,
  };
}

for (const file of ['laser-studio.html', 'laser-studio-kids.html']) {
  console.log('\n' + file);
  const prelude = 'const rad=d=>d*Math.PI/180;' +
    'const rotPt=(px,py,cx,cy,a)=>{const s=Math.sin(a),c=Math.cos(a);const dx=px-cx,dy=py-cy;return{x:cx+dx*c-dy*s,y:cy+dx*s+dy*c};};';
  const { resizeRotatedRect } = loadFunctions(file, ['resizeRotatedRect'], prelude);

  // 1. rot=0 SE drag behaves exactly like the old axis-aligned resize
  let o0 = { x: 10, y: 20, w: 100, h: 50 };
  let r = resizeRotatedRect(o0, 0, 'se', 10 + 100 + 15, 20 + 50 + 5);
  close(r.x, 10, 1e-9, 'rot=0 se: x unchanged');
  close(r.y, 20, 1e-9, 'rot=0 se: y unchanged');
  close(r.w, 115, 1e-9, 'rot=0 se: w grows by 15');
  close(r.h, 55, 1e-9, 'rot=0 se: h grows by 5');

  // 2. rot=0 NW drag moves origin, keeps SE corner
  r = resizeRotatedRect(o0, 0, 'nw', 20, 30);
  close(r.x, 20, 1e-9, 'rot=0 nw: x follows mouse');
  close(r.y, 30, 1e-9, 'rot=0 nw: y follows mouse');
  close(r.x + r.w, 110, 1e-9, 'rot=0 nw: right edge fixed');
  close(r.y + r.h, 70, 1e-9, 'rot=0 nw: bottom edge fixed');

  // 3. any rotation: opposite corner stays FIXED IN WORLD SPACE
  for (const rot of [30, 45, 90, 137, -60]) {
    for (const h of ['se', 'ne', 'sw', 'nw', 'e', 'n', 'w', 's']) {
      const a = anchorOf(o0, h);
      const before = worldOf(o0, rot, a.x, a.y);
      // drag the handle "outward" from an arbitrary world point
      const n = resizeRotatedRect(o0, rot, h, 140, 95);
      const a2 = anchorOfNew(n, h);
      const after = worldOf(n, rot, a2.x, a2.y);
      close(after.x, before.x, 1e-6, `rot=${rot} ${h}: anchor x fixed in world`);
      close(after.y, before.y, 1e-6, `rot=${rot} ${h}: anchor y fixed in world`);
    }
  }

  // 4. rot=90 SE: dragging along world +y grows local w (axes swap)
  o0 = { x: 0, y: 0, w: 40, h: 20 };
  // center (20,10); at 90°, local +x maps to world +y.
  // SE corner local (40,20) → world = center + rot90(20,10) = (20-10, 10+20) = (10,30)
  r = resizeRotatedRect(o0, 90, 'se', 10, 40); // move SE handle 10 further along world +y
  close(r.w, 50, 1e-6, 'rot=90 se: world +y drag grows local w by 10');
  close(r.h, 20, 1e-6, 'rot=90 se: local h unchanged');

  // 5. min clamp: cannot invert
  r = resizeRotatedRect(o0, 0, 'se', -100, -100);
  ok(r.w >= 1 && r.h >= 1, 'min clamp keeps positive dims');

  // 6. snap applies in LOCAL space
  const snap5 = v => Math.round(v / 5) * 5;
  r = resizeRotatedRect({ x: 0, y: 0, w: 40, h: 20 }, 0, 'se', 43, 22, { snap: snap5 });
  close(r.w, 45, 1e-9, 'snap: w snapped to 45');
  close(r.h, 20, 1e-9, 'snap: h snapped to 20');

  // 7. aspect-ratio lock (pro edition passes ratio:true)
  r = resizeRotatedRect({ x: 0, y: 0, w: 100, h: 50 }, 0, 'se', 120, 55, { ratio: true });
  close(r.w / r.h, 2, 1e-9, 'ratio lock keeps 2:1');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
