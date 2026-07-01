// AI copilot — pure helpers: whitelisted feature edits and the scene summary
// the LLM reasons over. Tests the shipped code inside cad-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };

const { applyFeatureChanges, chatSceneSummary } =
  loadFunctions('cad-studio.html', ['applyFeatureChanges', 'chatSceneSummary']);

// ---------- applyFeatureChanges ----------
let f = { id: 1, type: 'box', name: 'Plate', color: '#f0803c', w: 80, d: 50, h: 8, x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, visible: true, suppressed: false };
let r = applyFeatureChanges(f, { h: 18, x: 5 });
ok(f.h === 18 && f.x === 5, 'numeric dims & position applied');
ok(r.applied.h === 18 && r.rejected.length === 0, 'applied map reported');

r = applyFeatureChanges(f, { h: '25' });
ok(f.h === 25, 'numeric strings coerced');

r = applyFeatureChanges(f, { h: 'tall', q: 9, __proto__x: 1 });
ok(f.h === 25 && r.rejected.includes('h') && r.rejected.includes('q'), 'NaN and unknown keys rejected');

r = applyFeatureChanges(f, { name: '  Base  ', color: '#00ff00' });
ok(f.name === 'Base' && f.color === '#00ff00', 'name trimmed, valid color applied');
r = applyFeatureChanges(f, { color: 'red', name: '' });
ok(f.color === '#00ff00' && f.name === 'Base' && r.rejected.length === 2, 'bad color/name rejected');

r = applyFeatureChanges(f, { visible: false, suppressed: 'true' });
ok(f.visible === false && f.suppressed === true, 'booleans coerced');

// r only exists on cylinders — must not be invented on a box
r = applyFeatureChanges(f, { r: 10 });
ok(!('r' in f) && r.rejected.includes('r'), 'dim not present on the feature is rejected (no shape morphing)');
// but x/y/z always allowed
const cyl = { id: 2, type: 'cylinder', name: 'C', color: '#4c9ffe', r: 6, h: 30 };
r = applyFeatureChanges(cyl, { r: 8, y: 15 });
ok(cyl.r === 8 && cyl.y === 15, 'position keys allowed even when absent initially');

// ---------- chatSceneSummary ----------
const features = [
  { id: 1, type: 'box', name: 'Plate', color: '#f0803c', visible: true, suppressed: false, w: 80, d: 50, h: 8, x: 0, y: 4, z: 0, rx: 0, ry: 0, rz: 0 },
  { id: 2, type: 'cylinder', name: 'Hole 1', color: '#4c9ffe', visible: true, suppressed: false, r: 6, h: 30, seg: 48, x: -24, y: 0, z: 0, rx: 0, ry: 0, rz: 0 },
  { id: 3, type: 'boolean', op: 'subtract', name: 'Cut hole', color: '#f0803c', visible: true, suppressed: false, aId: 1, bId: 2 },
];
const bboxes = { 3: { min: [-40, 0, -25], max: [40, 8, 25] } };
const s = chatSceneSummary(features, bboxes, { wall: 3 }, [3]);

ok(s.units === 'mm' && /Y/.test(s.up_axis), 'units + up axis documented');
ok(s.named_parameters.wall === 3, 'params included');
ok(s.selected_ids.length === 1 && s.selected_ids[0] === 3, 'selection included');
const plate = s.features.find(x => x.id === 1);
ok(plate.consumed_by_boolean === 3, 'consumed inputs marked with their boolean');
ok(plate.dims.w === 80 && plate.dims.h === 8, 'dims picked per type');
ok(plate.position.y === 4, 'center position included');
const cut = s.features.find(x => x.id === 3);
ok(cut.op === 'subtract' && cut.input_ids.join() === '1,2', 'boolean op + inputs');
ok(!cut.dims && !cut.position, 'boolean has no dims/position');
ok(cut.world_bbox.size.join() === '80,8,50', 'world bbox size computed');
ok(cut.world_bbox.center.join() === '0,4,0', 'world bbox center computed');
ok(!plate.world_bbox, 'consumed body has no live bbox');

// suppressed boolean does not consume
const s2 = chatSceneSummary(
  [{ ...features[0] }, { ...features[1] }, { ...features[2], suppressed: true }], {}, {}, []);
ok(!s2.features.find(x => x.id === 1).consumed_by_boolean, 'suppressed boolean does not consume inputs');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
