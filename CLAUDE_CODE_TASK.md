# Kickoff note for Claude Code

You're taking over the **MakerForge** maker-tools suite in this folder. Start by reading `HANDOFF.md` fully — it's the source of truth (inventory, per-tool features, test matrix, bugs, UI/UX brief, backlog).

## Do this, in order

1. **Read `HANDOFF.md`.** Don't rewrite anything from scratch — the geometry/engine code is unit-tested and correct. Build on it.

2. **Test the 4 offline tools in a real browser** (`laser-studio.html`, `laser-studio-kids.html`, `cad-studio.html`, `blocks-3d-kids.html`). Run a local server first — `npx serve .` — and open via `http://localhost` (not `file://`). Work through the §3 test matrix and log every failure.

3. **Fix the known bugs (§4), highest first:**
   - §4.1 — the OpenCascade B-Rep tool (`cad-brep-opencascade.html`) hangs on load. Try the 4 fixes listed; serving over http + self-hosting the wasm is the most likely fix. If it can't be made reliable, standardize on hosted Chili3d and document that.
   - §4.2 undo/redo off-by-one, §4.3 rotated-object resize, §4.4 laser text isn't cut-ready.

4. **Wire in Mass Properties** (§6 item 2) to `cad-studio.html` — the math is already written and unit-tested (10/11; note the watertight vertex-weld caveat). Add an "Inspect" panel: volume, surface area, bbox, centroid, watertight status, estimated mass by material.

5. **Do the UI/UX pass (§5):** shared `tokens.css`, WCAG 2.1 AA accessibility (contrast, focus rings, ARIA on icon buttons, 44px tap targets, reduced-motion), responsive/touch, real icon set, onboarding. Keep JS logic intact.

## Rules
- **Every new piece of pure logic gets a Node unit test before you wire it to the UI.** Match the existing style (see §8 for what's already covered — don't redo it).
- Keep each tool a single self-contained `.html` unless you deliberately extract shared modules (§4.6) — if you do, document the build step.
- Preserve coordinate conventions (§7): laser = mm/Y-down, exports Y-flipped; 3D mesh tools = Y-up; B-Rep = Z-up.
- Commit per logical change with a clear message. Report what you tested and how.

Deliverables: bug fixes applied, Mass Properties live, a UI/UX pass with an accessibility report, and an updated `HANDOFF.md` reflecting new status.
