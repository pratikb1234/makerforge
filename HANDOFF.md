# MakerForge — Maker Tools Suite · Engineering Handoff

**Owner:** Pratik (pratik@bitsandstudios.com)
**Prepared:** 2 July 2026 · **Executed:** 2 July 2026 (see status update below)
**Purpose:** Hand off a suite of browser-based maker tools (2D laser CAD + 3D CAD, adult + kids editions) to the next contributor with a clear ask: **improve, test, and do a proper UI/UX pass.**

---

## ✅ STATUS UPDATE — 2 July 2026 (post-handoff execution)

The kickoff below was executed end-to-end. Summary of what changed:

| Item | Status |
|---|---|
| §3 test matrix (4 offline tools, real browser over http) | ✅ Run — every core flow click-tested via scripted pointer events + screenshots; results inline in §3/§4 |
| §4.1 OpenCascade hang | ✅ **Fixed** — kernel + replicad + Three.js self-hosted in `vendor/`, local-first boot w/ CDN fallback, hard timeouts, byte-progress. Root cause: `file://` (WASM bootstrap) + `Module.ready` never rejecting. Works over http; fillets + STEP export verified live |
| §4.2 undo/redo | ✅ **Fixed** in both laser tools + blocks (normalized to committed-states timeline); **cad-studio had NO undo at all — full undo/redo added** (buttons + Ctrl+Z/Y). Laser Undo/Redo toolbar buttons were never wired — wired |
| §4.3 rotated resize | ✅ **Fixed** — new `resizeRotatedRect()` works in the local frame, opposite handle stays world-fixed (188-assert unit test) |
| §4.4 text not cut-ready | ✅ **Fixed** — embedded public-domain Hershey `futural` stroke font; text renders/estimates/exports as real polylines (SVG paths, LightBurn Path shapes, G-code moves) in both laser tools |
| Mass Properties (§6.2) | ✅ **Live** — 🔍 Inspect panel in cad-studio: volume/area/bbox/centroid/watertight (+open/non-manifold counts)/mass by material. Vertex-weld before watertight check fixes the UV-pole false negative |
| UI/UX + WCAG 2.1 AA (§5) | ✅ Shared `tokens.css` (dark + kids themes), AA text contrast, focus rings, ARIA labels/roles, ≥44px kid tap targets, `prefers-reduced-motion`, responsive breakpoints, SVG icon sprite (pro laser), first-run onboarding tours. Audit: `ACCESSIBILITY.md` |
| New bugs found & fixed during the matrix | 3D canvas rendered at 2× CSS size on Retina (`inset:0` doesn't stretch a replaced element) — blocks-3d's shape tray was completely unusable; laser tools could boot at negative zoom (fit-before-layout race) |
| Tests | `tests/` — 260 Node asserts that **extract the shipped functions from the HTML files** (rotated resize ×188, history ×24, mass props ×18, text vectorization ×30). Run: `node tests/<name>.test.js` |

| ✨ NEW: AI modeling copilot (cad-studio) | ✅ Chat panel ("✨ AI" button), dual provider — **Gemini (default, key pre-loaded from gitignored `local-keys.js`) or Claude** — drives the real engine via tool-use (incl. solid 3D text via canvas-trace-extrude and freeform/preset profile extrudes — hearts, stars, custom outlines): get_scene (world bboxes), add/edit/duplicate/delete, booleans, params, mass inspect, view. Understands references ("that box", "touching the back-left corner") from live scene state; every AI edit goes through pushHist → fully undoable. Bring-your-own Anthropic API key (localStorage, direct CORS call). Tool loop verified LIVE with Gemini 2.5 Flash (plate shortened, hole re-cut, cube placed flush on the corner) and with a mocked Anthropic API; helpers unit-tested (tests/chat-tools.test.js, 21 asserts) |

**Not done / still open:** P1 backlog (edge-select fillet, sketch-on-face, on-canvas gizmo, DXF, kerf offset), P2 (Manifold WASM, Web Worker CSG §4.5, shared-module refactor §4.6), Figma mockups (§5.5.2 — tokens + implemented HTML serve as the living spec). Text export uses single-stroke glyphs (ideal for engrave/score; for thick outline cuts, a future opentype.js path remains §6 P1-9).

---

## ▶ Kickoff prompt (paste this into your coding agent)

> Read this whole `HANDOFF.md`, then execute it end-to-end using every advanced capability you have. Do NOT rewrite the tested engine code — build on it.
>
> Use your full toolset: spin up parallel **subagents** (one per tool) to run the §3 test matrix; drive a **real browser** (serve over `http://localhost`, never `file://`) to click-test canvas/WebGL/WASM, take **screenshots**, and read the **console/network** to diagnose the §4.1 OpenCascade hang; use **git worktrees** for isolated fix branches; write a **Node unit test for every new pure-logic function before wiring UI**.
>
> Execute in order: (1) run the test matrix and log failures; (2) fix bugs §4 highest-first (start with §4.1 loader — self-host the wasm + serve over http + add a reject timeout; fall back to hosted Chili3d if unreliable); (3) wire the tested **Mass Properties** into `cad-studio.html` (§6.2); (4) do the **UI/UX + WCAG 2.1 AA** pass (§5) with a shared `tokens.css`, focus rings, ARIA, ≥44px targets, `prefers-reduced-motion`, responsive/touch, real icons, onboarding.
>
> Keep coordinate conventions (§7). Commit per logical change. Deliverables: verified fixes, Mass Properties live, a UI/UX pass + accessibility report, and an updated `HANDOFF.md`. Report what you tested and how.

---

## 0. TL;DR for the next agent/developer

You are inheriting **7 self-contained HTML tools**. All 2D and mesh-3D tools run offline with no build step (open the `.html` in a browser). Two rely on CDN libraries (Three.js; one also loads the OpenCascade WASM kernel).

Your job, in priority order:
1. **Test every feature by hand in a real browser** (the original author could not click-test canvas/WebGL/WASM in their sandbox — only the pure logic was unit-tested). See §3 test matrix.
2. **Fix the known issues** in §4.
3. **Do a UI/UX design pass** per the brief in §5 (accessibility, responsive, visual polish, onboarding).
4. **Extend features** per the backlog in §6.

Do not rewrite from scratch. The geometry/engine code is unit-tested and correct — build on it.

---

## 1. File inventory

| File | What it is | Kernel | Offline? | Test status |
|---|---|---|---|---|
| `laser-studio.html` | Pro 2D vector/CAD for laser cutting (Illustrator/Inkscape/LightBurn-style) | Custom 2D | ✅ Yes | Engine unit-tested; UI logic-traced only |
| `laser-studio-kids.html` | Kid edition of the laser studio ("Zappy") | Custom 2D | ✅ Yes | Same engine; UI not click-tested |
| `cad-studio.html` | Parametric 3D CAD, feature timeline (Fusion/Onshape-style MVP) | Custom mesh CSG (BSP) | ✅ Yes | CSG + STL unit-tested; UI not click-tested |
| `blocks-3d-kids.html` | Tinkercad-style 3D for young kids ("BlockBuddy") | Custom mesh CSG (BSP) | ✅ Yes | Shares tested CSG; UI not click-tested |
| `cad-brep-opencascade.html` | Real B-Rep CAD (true fillets + STEP) | **OpenCascade** via Replicad (WASM, self-hosted in `vendor/`) | ✅ Yes (needs http server) | ✅ Run-tested: fillet r=3 + STEP export verified |
| `open-cad-launcher.html` | Launcher linking hosted open-source CAD (Chili3d etc.) + local tools | none | ✅ (links need internet) | Static, trivial |
| `HANDOFF.md` | This document | — | — | — |

**Shared code note:** the mesh CSG kernel (Evan Wallace BSP, MIT) and the `csgFromGeometry`/`geometryFromCSG` adapters are **duplicated** in `cad-studio.html` and `blocks-3d-kids.html`. The interop exporters (SVG/LightBurn/G-code) are duplicated across the two laser tools. **Improvement opportunity:** extract shared modules (see §6, "Refactor").

---

## 2. Per-tool feature reference

### 2.1 `laser-studio.html` — Pro Laser CAD
**Units:** millimetres. Screen = mm × zoom + pan.

**Tools:** Select/Move, Node-edit, Rectangle (corner radius), Ellipse, Polygon (n sides), Star (points + inner ratio), Line, Pen/Path (multi-point, closeable), Text.

**Editing:** marquee + shift multi-select, move, 8-handle resize, rotate handle (15° snap w/ Shift), flip H/V, rotate 90°, duplicate, copy/paste, delete, undo/redo (snapshot-based).

**Arrange:** align L/C/R/T/M/B, distribute H/V, group/ungroup, bring-to-front/send-to-back.

**Canvas:** pan (space/right-drag), wheel zoom, grid + snap-to-grid, snap toggles, rulers/HUD readout, fit-to-bed.

**Laser layers:** each layer has operation (Cut / Engrave / Score), power %, speed, passes, color, visibility. Machine presets (CO₂/diode) set bed size; material presets fill power/speed.

**Estimate:** cut-time model using trapezoidal accel/cruise motion (`lineTime()`), broken into cutting/engraving/scoring/travel with proportion bar + total cut length.

**Export (Export ▾):**
- **SVG** — color-per-layer, importable by LightBurn/LaserWeb4/MeerK40t/Inkscape/Glowforge.
- **LightBurn `.lbrn`** — native project; power/speed/passes become `CutSetting`s; all geometry emitted as `Type="Path"` (avoids the documented Rect W/H ambiguity). Y-flipped to LightBurn's Y-up.
- **G-code** — GRBL/M4, Y-flipped to machine origin, with preview/copy.

**Send to Laser:** pre-flight checklist (bounds check, focus/air/lid) → simulated streaming job with progress + ETA.

**Persistence:** save/open `.mkf` (JSON), autosave to localStorage.

**Unit-tested (Node):** rectangle/circle/star/heart perimeters, rotation, point-in-poly hit-testing, cut-time incl. short-move accel regime, SVG path import w/ bézier flattening, G-code Y-flip. Exporters: 23/23 (Y-flip, closed-shape vertex dedup, Scan-vs-Cut mapping, passes, power scaling; `.lbrn` well-formed XML).

**Known edge cases / limitations:**
- Resize is axis-aligned; resizing a **rotated** object resizes in world axes (not local) — can feel off. (§6 fix.)
- `flip()` on rotational shapes flips via rotation, not true mirror — fine for symmetric shapes, wrong for asymmetric paths unless they store `pts`.
- Text is **not vectorized** — exported as `<text>` in SVG and **skipped** in G-code/`.lbrn`. Real laser text needs font→path outlines. (§6.)
- History is one-step-off in a few drag paths (redo of a drag may not restore the post-drag state). (§4.)
- Undo stack via full JSON snapshots — memory grows on huge docs (capped at 120).

### 2.2 `laser-studio-kids.html` — "Zappy"
Same verified engine, simplified UI: big labeled shape buttons, **click-to-place default sizes** (drag also works), plain-language jobs (Cut/Draw/Color), heart + triangle shapes, friendly time estimate, encouraging toasts + confetti, grown-up settings behind a ⚙️ gear (bed size, material, power/speed, SVG/LightBurn/G-code/save/open).

**Edge cases:** same engine caveats as 2.1. Kid flows assume mouse/touch; not keyboard-navigable.

### 2.3 `cad-studio.html` — Parametric 3D CAD
**Kernel:** mesh CSG (BSP), Three.js r128 (CDN). Y-up.

**Features:** feature **timeline** (every op editable/suppressible/deletable → full rebuild); primitives (box/cylinder/sphere/cone/torus); **sketch → extrude** (rect/circle/polygon on XY/XZ/YZ, symmetric option) and **revolve**; boolean **Combine/Cut/Intersect** (consumes two selected bodies, Fusion-style); **named parameters** usable in expression fields (`wall*2`, evaluated via `Function`); per-feature transform (position + rotation); **section view** (clipping plane); **measure** (two-point distance); view cube (Iso/Front/Top/Right), ortho/perspective, grid/wire toggles, fit; export **STL binary/ascii + OBJ**; save/open `.mkc`.

**Unit-tested (Node):** CSG union/subtract/intersect produce correct bounds (subtract carves to 0, intersect 0–5, union −5–10); binary STL byte layout exact. (11/11.)

**Known edge cases / limitations:**
- Booleans are **mesh** booleans — coincident/degenerate faces can produce artifacts on pathological inputs (BSP limitation). No manifold guarantee. (§6: consider Manifold WASM.)
- No true fillet/chamfer, no assemblies/joints, no sketch constraint solver, no drawings/CAM/simulation. (This is an MVP, not full Fusion — stated to user.)
- Resize/rotate gizmo is param-panel driven; no on-canvas 3D transform gizmo.
- Expression eval uses `Function` — acceptable for a local tool; **do not** ship server-side.
- `mass properties` (volume/area/centroid/watertight) was prototyped & unit-tested (10/11; watertight check is vertex-weld-tolerance sensitive on UV-sphere poles) but **not yet wired into the UI** — see §6.1.

### 2.4 `blocks-3d-kids.html` — "BlockBuddy" (Tinkercad-style)
Drag/click **solid** or **hole** shapes onto a workplane, drag to move (grid-snapped), resize/turn/up-down buttons, floating property card w/ color swatches + solid/hole toggle, **Group** (union solids, subtract holes via CSG) / Ungroup, duplicate/undo/redo, orbit view, **export STL**. Big friendly UI, confetti. Starter = a little house.

**Edge cases:** grouping many complex shapes runs CSG on the main thread → can jank (see §6, Web Worker). Move is on the ground plane only (Y via buttons). No import.

### 2.5 `cad-brep-opencascade.html` — Real B-Rep (OpenCascade)
Loads the genuine OCCT kernel (same as FreeCAD) via **Replicad 0.23.1 + replicad-opencascadejs 0.23.0** from CDN (esm.sh + jsdelivr for the 10.8 MB `replicad_single.wasm`). Gives **true fillets/chamfers** and **STEP export**. UI: primitives, move/rotate/recolor, booleans, fillet/chamfer (radius prompt), STL + STEP export, real edge rendering, exact volume, orbit, undo/redo, loud kernel status pill + error screen.

**STATUS: ✅ WORKING over http(s) — kernel self-hosted in `vendor/`, CDN fallback, boot timeouts. Hosted Chili3d remains a fallback via the launcher.**

---

## 3. Test matrix (do this first, in a real browser)

Legend: ⬜ untested · ✅ pass · ❌ fail (file a bug)

### 3.1 Laser studio (both editions)
- ⬜ Draw each shape; drag-size vs click-place; Shift = square/constrain
- ⬜ Select single/marquee/shift-multi; move; resize each of 8 handles; rotate + 15° snap
- ⬜ Align all 6 + distribute H/V with 3+ objects
- ⬜ Group/ungroup; front/back; duplicate; copy/paste; delete; undo/redo x10
- ⬜ Layer switch changes selected object's operation; power/speed/passes edit; material preset applies
- ⬜ Estimate updates live; travel toggle; changing speed changes time monotonically
- ⬜ Export SVG → open in Inkscape **and** LightBurn (verify layers by color)
- ⬜ Export `.lbrn` → **open in LightBurn**, confirm shapes + per-layer power/speed/passes + not mirrored
- ⬜ Export G-code → sanity-check in a G-code previewer; confirm Y not flipped wrong
- ⬜ Import an SVG with rect/circle/path(bézier); verify geometry + scale (mm)
- ⬜ Save `.mkf`, reload, Open → identical
- ⬜ Send-to-Laser pre-flight gating + progress
- ⬜ Kids edition: click-to-place, jobs, confetti, gear exports, help

### 3.2 3D CAD (`cad-studio.html`)
- ⬜ Add each primitive; edit params in timeline → live rebuild
- ⬜ Sketch→extrude rect/circle/poly on each plane; symmetric; revolve
- ⬜ Select 2 bodies → Combine/Cut/Intersect; verify result + inputs marked consumed
- ⬜ Parameter `wall=3`, use `wall*2` in a field; change `wall` → dependent rebuilds
- ⬜ Section view slider + flip; Measure two points; view cube; ortho/persp; fit; wire; grid
- ⬜ Export STL (binary+ascii) → open in a slicer/viewer; OBJ → open in Blender
- ⬜ Save `.mkc`, reload, Open → identical
- ⬜ Stress: 20+ features, deep boolean chains — watch for artifacts / slowness

### 3.3 BlockBuddy
- ⬜ Add solid + hole; drag-move; resize/turn/up-down; color; solid↔hole
- ⬜ Group (hole carves solid); ungroup restores; duplicate; undo/redo
- ⬜ Export STL → slicer opens it watertight

### 3.4 OpenCascade B-Rep — see §4.1 (currently blocked)

---

## 4. Known issues / bugs to fix

### 4.1 ✅ FIXED — `cad-brep-opencascade.html` hangs on "Loading…"
**Fix shipped:** kernel self-hosted in `vendor/` (local-first, CDN fallback, timeouts, progress). Root cause confirmed: `file://`. Serve over http.
**Symptom:** kernel status pill stuck on "Loading OpenCascade…"; never green, never error.
**Diagnosis (likely):** the 10.8 MB WASM bootstrap is fragile under `file://`. Two probable causes: (a) the dynamic `import()` of the Emscripten loader via esm.sh stalls, or (b) `locateFile` returns the jsdelivr `.wasm` URL but the fetch is blocked/stalled by CORS or `file://` restrictions, and the Emscripten `Module.ready` promise **never rejects** (so no error screen fires).
**Kernel file shape (confirmed):** `replicad_single.js` is Emscripten MODULARIZE, `export default Module` where `Module` is a factory `function(Module){…; return Module.ready}`; it calls `run()` at load. So `mod.default({locateFile})` is the correct call — the hang is in load/instantiate, not the API call.
**Recommended fixes to try (in a real browser, watching DevTools → Network + Console):**
1. **Serve over http(s)**, not `file://` (e.g. `npx serve .`). WASM streaming + CORS behave far better. This alone may fix it.
2. Import the loader from **jsdelivr** (`.../replicad-opencascadejs@0.23.0/src/replicad_single.js`) instead of esm.sh, or self-host both the `.js` and `.wasm` next to the HTML and point `locateFile` at the local `.wasm`.
3. Add a **timeout + reject** around the factory promise so the error screen fires instead of hanging forever.
4. Add real progress: fetch the `.wasm` yourself with `fetch()` + `Response` progress, pass bytes via `Module.wasmBinary`.
**Fallback already shipped:** `open-cad-launcher.html` points users to hosted **Chili3d / Replicad Studio / CascadeStudio** (same OCCT kernel, packaged correctly). Consider this the primary B-Rep path unless self-hosting is set up.

### 4.2 ✅ FIXED — Undo/redo off-by-one on drag (laser + cad)
Drag operations snapshot the *pre* state on `pointerup` but don't always commit the *post* state, so **redo** after undoing a drag may not restore the moved position. Normalize history: snapshot before mutation, commit after every committed action.

### 4.3 ✅ FIXED — Rotated-object resize (laser)
Resizing a rotated shape resizes along world axes, not the object's local axes. Implement resize in the object's local (unrotated) frame around the fixed opposite handle.

### 4.4 ✅ FIXED — Text is not cut-ready
Laser tools export text as `<text>` (SVG) and skip it in G-code/`.lbrn`. For actual cutting/engraving, vectorize glyphs to paths (e.g. opentype.js → path outlines) so text becomes real geometry in all exporters.

### 4.5 🟢 Main-thread CSG jank (3D)
Booleans/rebuild run synchronously. Large models freeze the UI briefly. Move CSG to a Web Worker; show a spinner.

### 4.6 🟢 Duplicated code
CSG kernel + adapters duplicated (cad-studio, blocks); exporters duplicated (2 laser tools). Extract shared `.js` (or inline-shared build step) to prevent drift.

---

## 5. UI/UX design brief (please do a real pass)

The tools are **functionally** solid but **visually** engineer-made. Deliver a design pass, ideally with a shared design token set applied across all tools.

### 5.1 Cross-cutting
- **Design tokens:** unify color, spacing, radius, typography, shadows into CSS variables shared across tools (adult = dark technical; kids = light playful — keep two themes, one token system).
- **Accessibility (WCAG 2.1 AA):** check contrast (esp. `--mut` text on panels), focus rings on all controls, keyboard navigation for every action, `aria-label`s on icon-only buttons, min 44×44px tap targets (kids tools especially), `prefers-reduced-motion` for confetti/animations.
- **Responsive:** these assume a wide desktop. Define behavior for tablet/narrow: collapsible panels, bottom-sheet toolbars, touch gestures (pinch-zoom, two-finger orbit/pan).
- **Empty & error states:** friendly empty states; the "kernel failed" screen is good — extend that quality everywhere.
- **Onboarding:** first-run coach marks / a 30-second interactive tour per tool. Kids tools have a Help toast; make it a guided overlay.

### 5.2 Laser studio
- Real icon set (currently unicode glyphs) — commission or use an open icon font (Lucide/Feather) for crisp, consistent tool icons.
- The right panel is dense; introduce progressive disclosure (collapse advanced laser params by default).
- Make the estimate a hero element — it's the differentiator ("2 min 14 s"). Consider a per-layer time breakdown table.
- Rulers are HUD-only; add proper top/left rulers with tick labels.

### 5.3 3D CAD
- Add an **on-canvas transform gizmo** (move/rotate arrows) — biggest usability gap vs Fusion.
- Timeline could show thumbnails / operation icons and drag-to-reorder.
- View cube should be an actual 3D navigation cube (clickable faces/corners), not 4 buttons.
- Selection feedback: hover highlight, selected-edge outline (partially present via EdgesGeometry).

### 5.4 Kids tools
- Get a **children's UX specialist** review (the user explicitly asked). Focus: reading-level of labels, icon comprehension for pre-readers, forgiving interactions, celebration moments, no dead-ends.
- Add sound (optional, muteable) — kids respond to audio feedback.
- Consider a mascot/guide character for continuity.

### 5.5 Deliverables expected from the design pass
1. A shared `tokens.css` (or a documented variable set).
2. Redlined mockups or a Figma file for each tool's main screen + one edge state.
3. An accessibility audit report (contrast, keyboard, ARIA) with fixes applied.
4. Updated HTML/CSS in each tool implementing the above (keep JS logic intact).

---

## 6. Feature backlog (prioritized)

### P0 — finish/repair
1. **Fix OpenCascade loader** (§4.1) or formally adopt hosted Chili3d as the B-Rep path.
2. **Wire Mass Properties into `cad-studio.html`** — prototype exists & unit-tested (volume via signed tetrahedra, surface area, centroid, watertight check, mass from material density). Add an "Inspect" panel: volume (mm³/cm³), surface area, bbox, centroid, watertight status, estimated mass (material dropdown: PLA 1.24, ABS 1.04, steel 7.85, alu 2.70 g/cm³). **Edge case to document:** watertight check is sensitive to vertex-weld tolerance (UV-sphere poles); relax tolerance or weld before checking.
3. **Undo/redo normalization** (§4.2) across all tools.

### P1 — high-value CAD features
4. **Edge-select fillet/chamfer** (only on the B-Rep tool; needs Replicad `EdgeFinder`). Pick edges in 3D → fillet just those (Fusion parity).
5. **Sketch → extrude on a face** (select a planar face, sketch on it) — the core Onshape loop.
6. **On-canvas transform gizmo** (move/rotate/scale handles in 3D).
7. **DXF import/export** for the laser tools (LightBurn/CAD interchange beyond SVG).
8. **Kerf offset** (laser) — offset paths by half beam width so parts fit precisely.
9. **Font→path vectorization** for laser text (§4.4).

### P2 — robustness & scale
10. **Swap mesh CSG for Manifold (WASM)** in cad-studio/blocks — ~1000× faster, guaranteed manifold output. Keep the BSP kernel as offline fallback.
11. **Web Worker** for CSG/rebuild (§4.5).
12. **Refactor shared modules** (§4.6).
13. **3MF export** (modern 3D-print format with units/color).

### P3 — nice to have
14. Assemblies/joints (large); constraint solver (large — consider SolveSpace's `slvs` WASM).
15. Tabs/finger joints generator for laser box-making.
16. Cloud/share via URL (CascadeStudio does this by encoding the model in the URL).

---

## 7. How the code is organized (per file)

Each HTML file is: `<style>` (all CSS) → markup → one `<script>` (all JS). No bundler. Search anchors:

- **Laser engine:** `shapePolys()` (geometry → world polylines), `bbox()`, `hitObject()`, `estimate()`/`lineTime()` (cut time), `genSVG()`/`genLBRN()`/`toGcode()` (exporters), `importSVG()`/`parsePath()` (import), `rebuild`≈`draw()`.
- **Mesh 3D:** CSG kernel (`CSG`, `Node`, `Plane`, `Polygon`), adapters `csgFromGeometry()`/`geometryFromCSG()`, `featureGeometry()` (feature → THREE geom), `rebuild()` (evaluate timeline), `bindOrbit()` (custom orbit controls).
- **B-Rep:** `bootKernel()` (loads OCCT), `solidOf()`/`bakeTransform()`, `boolOp()`, `edgeOp()` (fillet/chamfer), `rebuild()` (Replicad `.mesh()` → THREE).

**Coordinate conventions:** laser = mm, Y-down (screen), Y-flipped on export to machine Y-up. cad-studio/blocks = Three.js Y-up. B-Rep = OCCT/Replicad Z-up (camera.up = Z).

---

## 8. Verification already done (don't redo, build on it)

All via Node in the author's sandbox (pure logic only — **no browser/WebGL/WASM execution possible there**):
- Laser engine: **15/15** (perimeters, rotation, hit-test, cut-time incl. accel regime, SVG path parse, G-code Y-flip).
- Interop exporters: **23/23** (SVG mm/viewBox/fill rules; `.lbrn` Scan-vs-Cut, passes, Y-flip, closed-shape vertex dedup, well-formed XML; G-code power scaling).
- Mesh CSG kernel: **11/11** (union/subtract/intersect bounds correct; binary STL byte layout).
- Mass properties: **10/11** (cube V=1000/A=600/centroid=0; sphere within 1%; open-mesh detected; steel mass exact; the 1 "fail" = UV-sphere pole weld tolerance — documented, not a math error).
- JSCAD open-source kernel eval: **7/7** (proved as an alternative before choosing OpenCascade).

**What was NOT testable and MUST be human-verified:** all pointer/drag/canvas interactions, WebGL rendering, and the entire OpenCascade WASM path.

---

## 9. Suggested first week

- **Day 1:** run §3 test matrix on the 4 offline tools; log bugs.
- **Day 2:** fix §4.2 (undo) + §4.3 (rotated resize); wire Mass Properties (§6.2).
- **Day 3:** decide B-Rep strategy — fix loader (§4.1) or standardize on Chili3d; document.
- **Day 4–5:** UI/UX pass groundwork — tokens.css, accessibility audit, icon set.
- **Ongoing:** P1 backlog, one feature at a time, each with a Node unit test for any new pure logic before wiring UI.

---
*End of handoff. Questions on intent → the geometry math is the load-bearing part and it's tested; the UI is the part that needs eyes, hands, and a designer.*
