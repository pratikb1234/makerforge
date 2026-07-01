// §4.4 — text must vectorize to real Hershey stroke polylines so it renders,
// estimates and exports as genuine geometry. Tests the shipped code in both
// laser tools (HERSHEY table + vectorizeText).
const { sourceOf, extractFunction } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };
const close = (a, b, eps, m) => ok(Math.abs(a - b) < eps, `${m} (got ${a}, want ~${b})`);

for (const file of ['laser-studio.html', 'laser-studio-kids.html']) {
  console.log('\n' + file);
  const src = sourceOf(file);
  const table = src.match(/const HERSHEY=\{.*?\};/s);
  ok(!!table, 'HERSHEY table present');
  const code = table[0] + '\n' + extractFunction(src, 'vectorizeText');
  const { vectorizeText, HERSHEY } = new Function(code + '\nreturn {vectorizeText, HERSHEY};')();

  ok(Object.keys(HERSHEY).length === 96, '96 glyphs (ASCII 32–126)');
  ok(HERSHEY['A'].p.length > 0 && HERSHEY['a'].p.length > 0, 'upper & lower case present');

  // "I" is a single vertical stroke in futural
  const I = vectorizeText('I', 21); // size 21 => scale 1 (glyph units)
  ok(I.polys.length === 1, '"I": one stroke');
  ok(I.polys[0].length === 2, '"I": two points');
  close(Math.abs(I.polys[0][0].y - I.polys[0][1].y), 21, 1e-6, '"I": stroke height = cap height = size');

  // scaling: doubling size doubles every coordinate & metric
  const a1 = vectorizeText('A', 10), a2 = vectorizeText('A', 20);
  close(a2.w / a1.w, 2, 1e-9, 'A: width scales with size');
  close(a2.polys[0][0].x / (a1.polys[0][0].x || 1e-12), 2, 1e-6, 'A: coords scale with size');

  // advance: two chars are wider than one, space advances without strokes
  const one = vectorizeText('W', 14), two = vectorizeText('WW', 14), sp = vectorizeText('W W', 14);
  ok(two.w > one.w * 1.8, 'WW roughly twice as wide as W');
  ok(sp.w > two.w, 'space adds advance');
  ok(sp.polys.length === two.polys.length, 'space adds no strokes');

  // multi-line: second line lower than first
  const ml = vectorizeText('A\nA', 14);
  const ys = ml.polys.map(p => Math.min(...p.map(pt => pt.y)));
  ok(Math.max(...ys) > Math.min(...ys) + 14, 'newline moves second line down');

  // unknown glyph: skipped but still advances
  const un = vectorizeText('é', 14); // é not in futural
  ok(un.polys.length === 0 && un.w > 0, 'unknown char: no strokes, still advances');

  // top of caps sits at local y=0 (box origin)
  const capTop = Math.min(...vectorizeText('H', 21).polys.flat().map(p => p.y));
  close(capTop, 0, 1e-6, 'cap top at y=0');

  // total stroke length of "HELLO" is stable & positive (estimate feed)
  const hello = vectorizeText('HELLO', 14);
  let len = 0;
  hello.polys.forEach(p => { for (let i = 1; i < p.length; i++) len += Math.hypot(p[i].x - p[i-1].x, p[i].y - p[i-1].y); });
  ok(len > 50 && len < 400, `HELLO stroke length sane (${len.toFixed(1)} mm at 14mm)`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
