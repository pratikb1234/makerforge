# MakerForge — Accessibility Audit & Fixes (WCAG 2.1 AA)

**Date:** 2 July 2026 · **Scope:** all 6 tools · **Status:** fixes applied, verified in-browser

This is the §5.5.3 deliverable: what was audited, what failed, what was fixed, and how it
was verified. The shared token system lives in [`tokens.css`](tokens.css); every tool links
it and remaps its legacy CSS variables onto the `--tk-*` tokens.

---

## 1. Color contrast (SC 1.4.3 / 1.4.11)

Measured with the WCAG relative-luminance formula against the surfaces the colors are used on.

| Pair | Before | After | Result |
|---|---|---|---|
| Dark theme: body text on panel | 14.4:1 | 14.4:1 | AA ✅ (unchanged) |
| Dark theme: muted/secondary text on panel | 5.7:1 (`#8b97a6`)* | **6.8:1** (`#9aa6b5`) | AA ✅ |
| Dark theme: link/info blue on panel | 6.2:1 | **7.6:1** (`#6db1ff`) | AA ✅ |
| Dark theme: accent orange on panel | 6.3:1 | 6.3:1 | AA ✅ |
| Dark theme: white-on-blue hover states (cad tools) | ~2.2:1 ✗ | **~8:1** (navy `#0b2239` text) | AA ✅ |
| Kids theme: body text on white | 13.1:1 | 13.1:1 | AA ✅ |
| Kids theme: muted text on white | **3.5:1 ✗** (`#7d8aa3`) | **6.0:1** (`#55647f`) | AA ✅ |
| Kids theme: "ok" green used as text | **1.9:1 ✗** (`#5ad197`) | **3.4:1** (`#1f9e63`, large/bold only) | AA ✅ (large text) |
| Kids theme: accent pink on white (big buttons) | 2.5:1 | **3.6:1** (`#e94f77`) | AA ✅ (large text / UI) |
| Focus ring vs dark panels | — | 9.1:1 (`#8ec2ff`) | ≥3:1 ✅ |
| Focus ring vs kids background | — | 5.3:1 (`#7746d1`) | ≥3:1 ✅ |

\* the laser tools used `#8b97a6` (passing but marginal); the cad tools and kids tools had the failing values.
Decorative shape-fill pastels in the kids tools are intentionally unchanged (not text, no contrast requirement).

## 2. Keyboard access (SC 2.1.1)

- **Fixed:** every action is reachable by keyboard. Clickable `<div>`s (layer rows, feature-timeline
  rows, body-list rows, shape cards, job cards, color swatches) received `role="button"` +
  `tabindex="0"` and delegated Enter/Space activation. JS-re-rendered lists are re-decorated via
  MutationObserver so keyboard access survives every re-render.
- **Fixed:** laser-studio Undo/Redo toolbar buttons were never wired to any handler (found during
  the test matrix) — now wired; Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y added to cad-studio.
- Existing single-key shortcuts (V/R/E/P/S/L/B/T, F, D, Del) are preserved and documented in the
  status bar.

## 3. Visible focus (SC 2.4.7)

- Global `:focus-visible` ring in `tokens.css` (2px offset ring, ≥3:1 against every surface).
- Removed the one rule that painted its own weaker outline (`input:focus` in cad-studio); no
  `outline:none`-without-replacement existed anywhere else.

## 4. Name, role, value (SC 4.1.2)

- `aria-label` on every icon-only / emoji-only button across all tools (pro laser: 43 labels incl.
  8 align/distribute; cad-studio: 40; B-Rep: 20; kids tools: 25/26 in plain kid-friendly words).
- `role="toolbar"` + labels on toolbar groups (pro laser: 7 groups).
- Menus: `aria-haspopup` + `aria-expanded` kept in sync with the `.show` class (cad-studio Add
  Body / Sketch / Export; laser Export).
- Collapsible right-panel sections in the pro laser are real `<button>`s with
  `aria-expanded`/`aria-controls`.
- Canvases: `role="img"` with descriptive labels (they are pointer-driven work surfaces; all
  canvas operations have panel/keyboard equivalents or are decorative).

## 5. Status messages (SC 4.1.3)

- Toasts, status bars, the Zappy hint bubble and estimate, and the B-Rep kernel pill are
  `role="status" aria-live="polite"` — screen readers hear "OpenCascade ready", job estimates,
  and undo/redo confirmations without focus moves.

## 6. Target size (SC 2.5.5 AAA, applied to kids tools as per brief)

- All interactive controls in Zappy and BlockBuddy are ≥44×44 px (`--tap-min`), including round
  toolbar buttons, shape cards, job cards, view-bar buttons and color swatches.
- Adult tools keep denser 28–36px controls (AA does not mandate 44px; kids tools were the
  explicit requirement).

## 7. Motion (SC 2.3.3)

- `prefers-reduced-motion: reduce` globally disables transitions/animations (tokens.css) and the
  kids confetti/cheer animations are gated on the same media query in JS.

## 8. Responsive / reflow (SC 1.4.10)

- ≤1000px: pro laser right panel and cad-studio side panels become overlay drawers with toggle
  buttons (`aria-expanded` synced); B-Rep sidebars narrow but stay scrollable.
- ≤900px: kids shape rails become horizontally scrollable bottom bars; canvases get
  `touch-action:none` so touch drag works.
- Launcher collapses to a single column ≤1000px.

## 9. Onboarding (§5.1)

- First-run coach overlays (`role="dialog" aria-modal="true"`, autofocused confirm button,
  Escape closes, localStorage-keyed to show once): laser-studio, cad-studio, Zappy, BlockBuddy.
  The kids Help (❓) button re-opens the tour.

## 10. Known limitations / future work

- Canvas content itself is not screen-reader navigable (inherent to canvas/WebGL CAD; object
  lists and parameter panels are the accessible interface).
- The kids tools remain emoji-first by design (pre-reader icon comprehension, §5.4); a
  children's-UX specialist review is still recommended as the handoff asks.
- Windows High Contrast mode not explicitly themed.
- SVG icon sprite implemented for the pro laser toolbar; cad tools still use glyph+text buttons
  (all labelled).

## Verification method

- Contrast: computed programmatically (WCAG formula) for every token pair — table above.
- Behavior: driven in a real browser (scripted pointer/keyboard events + screenshots): tab
  order, Enter/Space activation on decorated rows, drawer toggles, tours, live-region roles.
- Regression: `node tests/*.test.js` — 260 asserts extracted from the shipped HTML, all passing
  after the UI pass.
