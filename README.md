# MakerForge — browser maker tools with AI copilots

A suite of self-contained, offline-first CAD tools for makers. **No build step, no install** — serve the folder and open a page. Each tool is a single HTML file with a talk-based AI copilot that drives the real modeling engine.

| Tool | What it is |
|---|---|
| [`laser-studio.html`](laser-studio.html) | Pro 2D vector CAD for laser cutting — layers as laser ops (cut/engrave/score), cut-time estimate, SVG / LightBurn `.lbrn` / G-code export, **✨ AI design copilot** |
| [`cad-studio.html`](cad-studio.html) | Parametric 3D CAD with a feature timeline — 10 solid kinds, booleans, patterns, mirror, per-axis scale, solid 3D text, mass properties, STL/OBJ export, **✨ AI modeling copilot** |
| [`cad-brep-opencascade.html`](cad-brep-opencascade.html) | Real B-Rep CAD (OpenCascade via Replicad, self-hosted WASM) — true fillets/chamfers, STEP export |
| [`aero-lab.html`](aero-lab.html) | **F1-in-Schools sim** — NACA-4 airfoil + thin-airfoil (Glauert) lift/moment analysis, and a CO₂ dragster race simulator (RK4: thrust vs. aero drag vs. rolling resistance → run time) |
| [`laser-studio-kids.html`](laser-studio-kids.html) | "Zappy" — the laser studio for young kids |
| [`blocks-3d-kids.html`](blocks-3d-kids.html) | "BlockBuddy" — Tinkercad-style 3D for young kids |
| [`open-cad-launcher.html`](open-cad-launcher.html) | Launcher linking hosted open-source CAD + the local tools |

## Quick start

```bash
python3 -m http.server 8000      # any static server works; file:// breaks the WASM tool
open http://localhost:8000/laser-studio.html
```

## The AI copilots

Open a studio, hit **✨ AI**, paste an API key, and talk:

> *"Make a 60×40 name tag with rounded corners, engrave MIA centred on it, add a 4 mm hanging hole."*
> *"Build a lamp base: 60 mm round plate, truncated cone on top, 4 bolt holes on a 44 mm bolt circle."*
> *"Is it centre aligned?" → answered with real numbers, fixed with exact bbox alignment.*

- **Bring your own key** — Google Gemini (default) or Anthropic Claude. Keys live only in your browser's localStorage (or an optional git-ignored `local-keys.js`); calls go straight from your browser to the provider.
- The copilot uses **tool-calls over the real engine** (scene reading with world bboxes, primitives, booleans, patterns, alignment, mass properties, laser layers…), so every AI edit lands in the normal timeline and **undoes with Ctrl+Z**.

Optional `local-keys.js` (git-ignored — never commit it):

```js
window.MKF_KEYS = { gemini: "…", anthropic: "…" };
```

## Tests

Pure geometry/engine logic is tested by extracting the shipped functions from the HTML files:

```bash
for t in tests/*.test.js; do node "$t"; done   # 381 asserts
```

## Notes

- Mesh tools use a BSP CSG kernel (based on Evan Wallace's csg.js, MIT). Booleans are mesh booleans — no fillets there; the B-Rep tool has real ones.
- Laser text uses the public-domain Hershey *futural* stroke font, so text is genuine cut/engrave geometry in every exporter.
- `HANDOFF.md` documents the architecture, per-tool internals, and test matrix; `ACCESSIBILITY.md` is the WCAG 2.1 AA audit.

## License

MIT © Pratik Bhatt — see [LICENSE](LICENSE). Bundled third-party components keep their own licenses (csg.js MIT; Three.js MIT; Replicad/opencascade.js LGPL; Hershey fonts public domain).
