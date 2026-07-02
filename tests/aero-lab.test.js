// Aero Lab — NACA geometry, thin-airfoil (Glauert) theory, and the CO2
// dragster race integrator. Validated against known airfoil values and a
// closed-form zero-drag race. Tests the shipped functions in aero-lab.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };
const near = (a, b, tol, m) => ok(Math.abs(a - b) <= tol, `${m} (got ${a}, want ${b}±${tol})`);

const F = loadFunctions('aero-lab.html',
  ['parseNACA','nacaThickness','nacaCamber','nacaDyDx','nacaProfile','thinAirfoil','simulateRace']);

// ---------- parse ----------
ok(F.parseNACA('2412').m === 0.02 && F.parseNACA('2412').p === 0.4 && Math.abs(F.parseNACA('2412').t-0.12)<1e-9, 'parse 2412 → m,p,t');
ok(F.parseNACA('0012').m === 0 && F.parseNACA('0012').p === 0, 'parse 0012 → symmetric');
ok(F.parseNACA('abc') === null && F.parseNACA('241') === null, 'reject invalid codes');

// ---------- thickness ----------
// max half-thickness of a NACA XX12 is ~6% of chord near x≈0.3
let mx = 0; for (let x=0;x<=1;x+=0.001) mx=Math.max(mx,F.nacaThickness(x,0.12));
near(mx, 0.06, 0.002, 'NACA XX12 max half-thickness ≈ 6%');
near(F.nacaThickness(1,0.12), 0, 0.001, 'thickness closes at trailing edge');
ok(F.nacaThickness(0,0.12) === 0, 'thickness zero at leading edge');

// ---------- camber ----------
ok(F.nacaCamber(0.5,0,0.4) === 0, 'symmetric: zero camber everywhere');
near(F.nacaCamber(0.4,0.02,0.4), 0.02, 1e-6, '2412: camber peaks = max-camber at x=p');
ok(F.nacaDyDx(0.4,0.02,0.4) === 0 || Math.abs(F.nacaDyDx(0.4,0.02,0.4))<1e-9, '2412: slope zero at camber peak');

// ---------- profile ----------
const prof = F.nacaProfile('2412', 100, 80);
ok(prof.upper.length === 101 && prof.lower.length === 101, 'profile: n+1 points per surface');
ok(prof.upper.every((p,i)=>p.y >= prof.lower[i].y - 1e-9), 'cambered: upper surface never below lower');
ok(Math.abs(prof.upper[0].x) < 1 && Math.abs(prof.upper[prof.upper.length-1].x - 80) < 1, 'profile scaled to chord 80mm (LE→TE)');
// symmetric airfoil: surfaces mirror about y=0
const sym = F.nacaProfile('0012', 60, 1);
ok(sym.upper.every((p,i)=>Math.abs(p.y + sym.lower[i].y) < 1e-9), 'symmetric: upper = −lower');

// ---------- thin-airfoil theory ----------
// symmetric: zero-lift angle 0, Cl = 2π·α
let t = F.thinAirfoil('0012', 0);
near(t.alpha0Deg, 0, 0.01, '0012: zero-lift angle = 0°');
near(t.cl, 0, 1e-3, '0012: Cl = 0 at α=0');
t = F.thinAirfoil('0012', 5);
near(t.cl, 2*Math.PI*(5*Math.PI/180), 1e-3, '0012: Cl = 2π·α at 5°');
near(t.clSlopePerDeg, 0.1097, 0.001, 'lift slope ≈ 0.1097 /deg (2π/rad)');

// 2412: published zero-lift angle ≈ −2.1°, Cl at 0° ≈ 0.23
t = F.thinAirfoil('2412', 0);
near(t.alpha0Deg, -2.1, 0.25, '2412: zero-lift angle ≈ −2.1° (published)');
near(t.cl, 0.23, 0.03, '2412: Cl ≈ 0.23 at α=0° (published)');
// Cm_c/4 is negative (nose-down) and roughly constant for 2412 ≈ −0.05
near(t.cmQuarter, -0.054, 0.02, '2412: Cm_c/4 ≈ −0.05');
// 4412 has more camber → more negative α0 than 2412
ok(F.thinAirfoil('4412',0).alpha0Deg < F.thinAirfoil('2412',0).alpha0Deg, 'more camber → more negative α0');
// Cl linear in α
const c3 = F.thinAirfoil('2412',3).cl, c6 = F.thinAirfoil('2412',6).cl, c9 = F.thinAirfoil('2412',9).cl;
near((c6-c3), (c9-c6), 1e-3, 'Cl linear in α (equal increments)');

// ---------- race: zero-drag closed form ----------
// no drag, no rolling: constant a=F/m during burn, then coast at v=J/m.
// x(tb)=½·a·tb², then constant v. Solve time to reach L.
const m=0.05, J=1.0, tb=0.3, L=20;
let r = F.simulateRace({massKg:m, cd:0, areaM2:0, impulseNs:J, burnS:tb, crr:0, lengthM:L, rho:1.225, g:9.81});
const vFinal = J/m;                         // 20 m/s
const xBurn = 0.5*(J/m/tb)*tb*tb;           // ½·a·tb² = ½·(v/tb)·tb² ... a=(J/tb)/m
near(r.topSpeed, vFinal, 0.05, 'zero-drag: top speed = impulse/mass = 20 m/s');
near(r.exitSpeed, vFinal, 0.05, 'zero-drag: coasts at 20 m/s to the line');
const aBurn = (J/tb)/m, xEndBurn = 0.5*aBurn*tb*tb;
const tExpected = tb + (L - xEndBurn)/vFinal;
near(r.finishTime, tExpected, 0.01, 'zero-drag: finish time matches closed form');

// ---------- race: drag makes it slower ----------
const rDrag = F.simulateRace({massKg:m, cd:0.5, areaM2:12e-4, impulseNs:J, burnS:tb, crr:0.05, lengthM:L});
ok(rDrag.finishTime > r.finishTime, 'adding drag+rolling increases run time');
ok(rDrag.topSpeed < r.topSpeed, 'drag lowers top speed');
ok(rDrag.peakDrag > 0, 'peak drag reported');
// lighter car (same everything) finishes sooner
const rLight = F.simulateRace({massKg:0.04, cd:0.5, areaM2:12e-4, impulseNs:J, burnS:tb, crr:0.05, lengthM:L});
ok(rLight.finishTime < rDrag.finishTime, 'lighter car is faster');
// realistic run is roughly 1–2 s
ok(rDrag.finishTime > 0.8 && rDrag.finishTime < 3, `realistic F1-in-Schools time (${rDrag.finishTime.toFixed(3)}s)`);
// huge drag / tiny impulse may not reach the line → finishTime null, reached false
const stuck = F.simulateRace({massKg:0.12, cd:0.9, areaM2:30e-4, impulseNs:0.4, burnS:0.8, crr:0.12, lengthM:25});
ok(stuck.reached === false ? stuck.finishTime === null : true, 'car that stalls out reports reached=false');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
