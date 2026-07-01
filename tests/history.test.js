// §4.2 — history must be a timeline of committed states where history[hist]
// always equals the current document, so undo→redo round-trips any action
// (including drags). Tests the shipped functions from laser-studio.html.
const { loadFunctions } = require('./extract');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  ✅', m)) : (fail++, console.log('  ❌', m)); };
const tick = () => new Promise(r => setTimeout(r, 5));

(async () => {
  for (const file of ['laser-studio.html', 'laser-studio-kids.html']) {
    console.log('\n' + file);
    // doc is our stand-in document; serialize/restore work on it
    const prelude = `
      const S={history:[],hist:-1,doc:'initial'};
      const toast=()=>{};
      const serialize=()=>JSON.stringify(S.doc);
      const restore=sn=>{S.doc=JSON.parse(sn);};
      const commit=sn=>{S.history=S.history.slice(0,S.hist+1);S.history.push(sn);if(S.history.length>120)S.history.shift();S.hist=S.history.length-1;};
      const commitHist=commit;
      const renderLayers=()=>{},syncPanels=()=>{},sync=()=>{},draw=()=>{};
    `;
    const names = ['pushHist', 'undo', 'redo'];
    const api = loadFunctions(file, names, prelude + 'var __S;\n');
    // re-extract with access to S: wrap so we can inspect state
    const { extractFunction, sourceOf } = require('./extract');
    const src = sourceOf(file);
    const code = names.map(n => extractFunction(src, n)).join('\n');
    const box = new Function(prelude + code + `
      return {
        pushHist, undo, redo,
        set: v => { S.doc = v; },
        get: () => S.doc,
        state: () => ({ len: S.history.length, hist: S.hist }),
        baseline: () => commit(serialize()),
      };`)();

    box.baseline();                    // boot baseline, like the app does
    box.set('A'); box.pushHist(); await tick();
    ok(box.get() === 'A' && box.state().len === 2, 'mutation then pushHist commits POST state');

    // simulate a drag: caller invokes pushHist AFTER mutating (pointerup path)
    box.set('B'); box.pushHist(); await tick();
    ok(box.state().len === 3, 'drag commit adds one timeline entry');

    box.undo();
    ok(box.get() === 'A', 'undo restores pre-drag state');
    box.redo();
    ok(box.get() === 'B', 'redo restores POST-drag state (the §4.2 bug)');

    box.undo(); box.undo();
    ok(box.get() === 'initial', 'undo twice reaches baseline');
    box.undo();
    ok(box.get() === 'initial', 'undo at baseline is a no-op');
    box.redo(); box.redo();
    ok(box.get() === 'B', 'redo walks forward to newest');
    box.redo();
    ok(box.get() === 'B', 'redo at tip is a no-op');

    // branch: undo then new action truncates the redo branch
    box.undo();               // at A
    box.set('C'); box.pushHist(); await tick();
    ok(box.get() === 'C' && box.state().len === 3, 'new action after undo truncates redo branch');
    box.redo();
    ok(box.get() === 'C', 'no redo past a truncation');

    // debounce: several pushHist in one tick commit once
    const before = box.state().len;
    box.set('D'); box.pushHist(); box.pushHist(); box.pushHist(); await tick();
    ok(box.state().len === before + 1, 'multiple pushHist in one handler commit once');

    // no-change pushHist does not spam the timeline
    const b2 = box.state().len;
    box.pushHist(); await tick();
    ok(box.state().len === b2, 'pushHist with unchanged doc adds nothing');
  }
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
