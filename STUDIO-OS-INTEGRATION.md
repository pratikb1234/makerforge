# MakerForge → Studio OS · Integration Handoff

**For:** the developer/agent maintaining **Studio OS**.
**From:** Claude (Fable 5) — I built the MakerForge tool suite. This document tells you *what* exists, *how* it's built, and *exactly how* to fold it into Studio OS so it looks and behaves like a native part of your app.
**Status:** everything below is built, tested (430 Node asserts), and running. A full reference integration exists in this repo's `../server.js` + `../index.html` — crib from it.

> **The 30-second version:** MakerForge is a set of self-contained HTML apps (no build, no framework). To integrate: (1) serve the `makerforge/` folder same-origin, (2) embed a tool in an `<iframe>`, (3) exchange 2 `postMessage` events for save/load, (4) recolor **one CSS file** (`tokens.css`) to your brand. That's the whole job. Everything else is optional depth.

---

## 1. What you're integrating (current inventory)

Eight self-contained apps in `makerforge/`. Each is one `.html` file = full app (`<style>` + markup + one `<script>`). **No npm, no build step, no framework.**

| File | Product name | What it does | AI copilot | Studio save/load bridge |
|---|---|---|---|---|
| `cad-studio.html` | **3D CAD Studio** | Parametric feature-timeline solid modeling → STL/OBJ. 10 primitive kinds, booleans, patterns, mirror, per-axis scale, solid 3D text, mass properties. | ✅ Gemini/Claude | ✅ built-in |
| `laser-studio.html` | **Laser CAD Studio** | 2D vector CAD for laser cutting → SVG / LightBurn `.lbrn` / G-code / DXF. Layers, kerf compensation, cut-time estimate, single-stroke text. | ✅ Gemini/Claude | ✅ built-in |
| `cad-brep-opencascade.html` | **B-Rep CAD** | True fillets/chamfers + STEP export (OpenCascade WASM, self-hosted). | — | — |
| `aero-lab.html` | **Aero Lab** | F1-in-Schools sim: NACA airfoil + thin-airfoil (Glauert) lift/moment, and a CO₂ dragster race simulator. Stateless (no save needed). | — | — |
| `laser-studio-kids.html` | **Zappy** | Kids' laser design. | — | add per §5.4 |
| `blocks-3d-kids.html` | **BlockBuddy** | Kids' Tinkercad-style 3D. | — | add per §5.4 |
| `open-cad-launcher.html` | Launcher | Grid of links to all tools. Optional — Studio OS is your launcher now. | — | — |

Supporting files (keep the folder intact — tools resolve `./vendor/`, `./tokens.css`, `./local-keys.js` relatively):
- `vendor/` — self-hosted Three.js + Replicad + OpenCascade WASM (so B-Rep works offline; no CDN dependency).
- `tokens.css` — **the theming layer** (see §6). Shared by every tool.
- `tests/` — 430 Node asserts extracted from the shipped HTML; run `for t in tests/*.test.js; do node "$t"; done`.
- `local-keys.js` — **git-ignored**, holds AI API keys; never commit or serve publicly (§7).
- `HANDOFF.md` (internals/architecture), `ACCESSIBILITY.md` (WCAG audit), `README.md`.

**Hard requirement:** serve over **http(s)**, never `file://` — the B-Rep tool's WASM won't bootstrap otherwise.

---

## 2. Architecture in one screen (so you know what you're dealing with)

- **Zero dependencies at runtime you must manage.** Three.js/Replicad are vendored; the only *optional* external calls are the AI copilots hitting Gemini/Anthropic with a user-supplied key.
- **Each tool owns its full UI** — toolbar, side panels, canvas, keyboard shortcuts. You do **not** rebuild any of that. You provide the *outer shell* (nav, a title bar, save/load chrome) around an iframe.
- **State lives in the tool.** The document (a laser design / a 3D model) is a plain JSON object inside the tool. You get it and set it through the bridge (§4). You never parse it — treat it as an opaque blob to store.
- **Pure logic is unit-tested** by extracting functions straight out of the HTML, so the geometry/physics/exporters are verified, not vibes.
- **Coordinate conventions** (only matters if you go deep): laser = mm, y-down, origin top-left; 3D CAD = Y-up, positions are centers; B-Rep = Z-up.

---

## 3. Hosting (pick one — same-origin strongly preferred)

**Same-origin (recommended, required for the design library):** serve `makerforge/` from the same origin as Studio OS.
- Express: `app.use('/makerforge', express.static('/abs/path/to/makerforge'))`
- Next.js: put the folder in `public/makerforge/` → auto-served at `/makerforge/*`
- Vite/CRA: `public/makerforge/`
- Rails/Django/Laravel: mount as a public/static dir
- Nginx/CDN/S3: upload as-is; ensure `.wasm` is served as `application/wasm` (usually automatic; Nginx needs `application/wasm wasm;` in mime.types)

**Different origin (link-out only):** host anywhere and open in a new tab. You lose the in-app design library and the bridge unless you add explicit target origins + CORS. Fine for a v1.

**Framing:** if Studio OS sets `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`, allow same-origin framing (`frame-ancestors 'self'`).

---

## 4. The embed + bridge contract (the actual integration)

### 4.1 Embed
```html
<iframe id="mf" src="/makerforge/laser-studio.html"
        style="width:100%;height:100%;border:0" title="MakerForge"></iframe>
```
Switch tools by changing `src`. That's it for "show a tool."

### 4.2 The message contract (same-origin only — the tools enforce `e.origin === location.origin`)

**Host (Studio OS) → tool**
| message | meaning |
|---|---|
| `{ type: 'mkf:get' }` | "Send me the current document." |
| `{ type: 'mkf:load', payload }` | "Replace the document with this payload." |

**Tool → host** (reply to `mkf:get`)
| message | meaning |
|---|---|
| `{ type: 'mkf:doc', tool, payload }` | The current document. `tool` = `'laser'` or `'cad'`. |

`payload` is the tool's native document JSON. **Treat it as opaque** — store it, hand it back on load, don't parse it. (For reference only: laser = `{v,objects,layers,bed}`, cad = `{v,features,params}`.)

### 4.3 Host-side glue (framework-agnostic — drop into any Studio OS view)
```js
const frame = document.getElementById('mf');

function getDoc() {                     // ask the tool for the current design
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { window.removeEventListener('message', h); reject(new Error('tool did not answer')); }, 4000);
    function h(e) {
      if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
      if (e.data?.type === 'mkf:doc') { clearTimeout(timer); window.removeEventListener('message', h); resolve(e.data); }
    }
    window.addEventListener('message', h);
    frame.contentWindow.postMessage({ type: 'mkf:get' }, location.origin);
  });
}
const loadDoc = payload => frame.contentWindow.postMessage({ type: 'mkf:load', payload }, location.origin);

// Save to Studio OS storage:
async function saveDesign(name, userId) {
  const { tool, payload } = await getDoc();
  await fetch('/api/maker/designs', { method:'POST', headers:{'content-type':'application/json'},
    body: JSON.stringify({ name, tool, payload, by: userId }) });
}
```
Wire `saveDesign` to your Save button and `loadDoc` to your library picker. Done.

---

## 5. The design library API (server side — you own storage & auth)

MakerForge doesn't care *how* you persist. Implement these routes against **Studio OS's own datastore and auth**. The reference impl (`../server.js`, block `MAKERFORGE DESIGN LIBRARY`) is a JSON-file demo — **copy its shape, not its lack of auth.**

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/maker/designs` | — | `[{ id, name, tool, by, createdAt, updatedAt }]` — metadata only (list view), scoped to the caller's workspace. |
| `GET /api/maker/designs/:id` | — | full record incl. `payload`. |
| `POST /api/maker/designs` | `{ id?, name, tool, payload, by }` | `{ ok:true, id }`. If `id` matches, update; else create. |
| `DELETE /api/maker/designs/:id` | — | `{ ok:true }` |

Data model (add the **bold** field for real multi-user use):
```
id, name (≤120), tool ('laser'|'cad'), by, createdAt, updatedAt, payload (json, opaque, up to a few MB),
**workspace/tenant key**  ← scope every query by this, from your session/JWT
```
- Set your JSON body limit high enough for payloads (reference uses `express.json({ limit:'10mb' })`).
- Optional later: store a thumbnail (have the tool also emit a PNG dataURL in `mkf:doc`) for a gallery view. Not required for v1; ask me and I'll add the thumbnail emit.

---

## 6. Making it feel NATIVE — theming & UI/UX (the part you asked about)

Everything visual in every tool is driven by **`makerforge/tokens.css`** — one file, shared by all tools. Each tool remaps its internal CSS variables onto these tokens, so **override the tokens and the whole suite reskins.**

```css
/* tokens.css — the design contract. Override these to match Studio OS. */
[data-theme="dark"], :root {
  --tk-bg: #12151a;      /* app background            */
  --tk-panel: #191d24;   /* toolbars / side panels    */
  --tk-panel-2: #20252e; /* inputs / raised surfaces  */
  --tk-line: #2b323d;    /* hairline borders          */
  --tk-text: #e8edf3;    /* primary text              */
  --tk-mut: #9aa6b5;     /* secondary text            */
  --tk-acc: #f0803c;     /* brand accent / primary btn*/
  --tk-blue: #6db1ff;    /* links / info              */
  --tk-ok / --tk-warn / --tk-danger / --tk-focus ...
}
/* radius, spacing, font, focus ring, 44px tap target, prefers-reduced-motion — all here too */
```

**To match Studio OS's look, choose one:**
1. **Edit `tokens.css` directly** (simplest, permanent). Set `--tk-*` to Studio OS's palette + fonts. Every tool — CAD, laser, Aero Lab, kids — instantly adopts your brand. All values already meet WCAG 2.1 AA; keep contrast ≥4.5:1 for text when you change them.
2. **Serve a Studio-OS override of `tokens.css`** at the same path (leave the original in git). Same effect, keeps the repo pristine for updates.
3. **Runtime theming** (if you want per-user/light-dark to follow Studio OS live): I can add a tiny `mkf:theme` message so the host pushes token overrides into the iframe on the fly. It's ~15 lines per tool — **say the word and I'll build it.**

**Chrome you provide vs. chrome the tool provides:**
- The tool renders its **own** toolbar + panels. Your job is the **outer shell**: your app's nav, a slim title/tab bar above the iframe, and your Save/Open/Library controls. The reference `../index.html` (`maker-overlay`) is a working example — a full-screen overlay with tool tabs, a library dropdown, Save/Open/Delete, and a close button.
- **Want the tool's own top brand bar hidden** so only Studio OS chrome shows? That's the cleanest "native" feel. I did **not** build an `?embed=1` chrome-less mode yet — it's a small, clean addition (hide the tool's brand row + redundant New/Open when embedded). **Ask and I'll add `?embed=1` to each tool.**

**Layout/responsive notes:**
- Tools assume a wide canvas; give the iframe as much space as you can (they have their own responsive breakpoints ≤1000px that collapse panels into drawers).
- They're keyboard- and screen-reader-instrumented already (ARIA, focus rings, ≥44px kid tap targets, reduced-motion) — see `ACCESSIBILITY.md`. Don't trap focus in your shell; let Escape reach the tool.

---

## 7. AI copilots & API keys (do this deliberately)

Two tools (laser, cad) have a talk-to-model copilot ("✨ AI"). It drives the real engine via tool-calls (read scene, add/edit/boolean/pattern/align/mass-props/layers…), so **every AI edit is a normal, undoable operation** — not a magic overwrite.

- **Keys are bring-your-own.** MakerForge ships **no** key. It reads the user's Gemini/Anthropic key from (a) the in-panel field → browser `localStorage`, or (b) an untracked `local-keys.js` (`window.MKF_KEYS = { gemini:'…' }`). **Never commit or publicly serve `local-keys.js`** — it's git-ignored; in prod, 404 it.
- **Recommended for a team product: a server-side AI proxy.** Add a Studio OS route (e.g. `POST /api/maker/ai`) that injects a server-held key and forwards to Gemini/Anthropic. Point the copilot's `fetch` at your proxy — keys stay server-side, and you can meter/audit/rate-limit per user. This is a ~10-line change in each tool's `callLLM()`. **Tell me your provider + auth and I'll wire it.**
- **Privacy note:** the copilot sends scene data to the model provider. Fine for most designs; flag it if users model anything confidential.

---

## 8. Reference implementation (working, in this repo — copy from it)

- `../server.js` → the 4 design-library routes (search `MAKERFORGE DESIGN LIBRARY`). Swap JSON-file for your datastore + auth.
- `../index.html` → the embedded workspace overlay: tool tabs, library dropdown, Save/Open/Delete, the full postMessage glue, toasts (search `maker-overlay`).
- `cad-studio.html` / `laser-studio.html` → the tool-side bridge listener (search `Studio OS bridge`).

**Verified round-trip:** design drawn in the embedded tool → Save to Studio → wiped → Open from library → fully restored (objects + text intact). Reuse the front-end almost verbatim; replace only storage/auth.

---

## 8b. Deploying on Vercel (the current Studio OS target)

Studio OS is a **Vite SPA on Vercel** (`studio-os-beta-seven.vercel.app`, `/assets/*`, `<title>Studio OS — Bits & Studios</title>`). As of this writing MakerForge is **not** deployed there — `/makerforge/*` and `/api/maker/*` all 404. To get it live:

**Static tools — easy:**
1. Copy the `makerforge/` folder into the Studio OS repo at **`public/makerforge/`** (Vite serves `public/` at the site root, so it deploys to `https://…/makerforge/*` with no config).
   - Or add it as a git **submodule/subtree** pointed at `github.com/pratikb1234/makerforge` so updates are a pull.
2. Make sure `.wasm` is served correctly — Vercel does this automatically for `public/` assets.
3. **Do NOT ship `local-keys.js`** — it's git-ignored; keep it out of `public/`. Users paste their own key, or use the proxy below.
4. Add a nav item + the `<iframe>` embed (§4) in the SPA.

**⚠️ Storage — the Vercel gotcha:** my reference API (`../server.js`) persists with `fs.writeFileSync`. **That does not work on Vercel** — serverless functions have an ephemeral, read-only filesystem, so saved designs would vanish. On Vercel, implement the §5 routes as **Vercel Serverless/Edge Functions** (`/api/maker/designs.js`) backed by **Vercel KV, Vercel Postgres, or Vercel Blob** (Blob is ideal for the potentially-MB `payload`; KV/Postgres for the metadata list). Same 3-route contract, different storage line.

**AI keys on Vercel:** don't put keys in the client bundle. Add a serverless proxy function (`/api/maker/ai`) that reads the key from a Vercel **Environment Variable** and forwards to Gemini/Anthropic; point the copilots' `callLLM()` at it (§7). This keeps keys server-side and lets you meter usage. (I can make this `callLLM()` edit.)

**Fastest path to see it live:** because the tools are static, you can deploy just the folder as its own Vercel project (drag-drop `makerforge/` or `vercel deploy`) to get `makerforge.vercel.app` immediately, then embed that URL in Studio OS via iframe (cross-origin: works for viewing; for the save/load bridge either host same-origin per above, or ask me to switch the bridge to explicit target origins + add CORS to the API).

## 9. Getting updates / staying in sync

The suite is published at **https://github.com/pratikb1234/makerforge** (public, MIT, no keys in tree or history). To pull a newer MakerForge into Studio OS: replace the `makerforge/` folder (or `git subtree pull`) — the integration seams (§4 message contract, §5 API, §6 tokens) are stable, so drop-in updates won't break your wiring. If you fork it, keep your `tokens.css` overrides in a separate layer so updates don't clobber your theme.

---

## 10. Integration checklist

- [ ] Serve `makerforge/` **same-origin** over http(s); confirm `…/makerforge/cad-brep-opencascade.html` loads (proves http + wasm + vendor path).
- [ ] Add a "Maker" entry to Studio OS nav → opens a view with the `<iframe>`.
- [ ] Recolor `tokens.css` to Studio OS's palette/fonts (§6).
- [ ] (Deep) Implement the 3 `/api/maker/designs` routes against your storage **with auth + workspace scoping**.
- [ ] (Deep) Add the host-side bridge glue (§4.3) + your Save button and library picker.
- [ ] Decide key strategy: BYO-key (default) vs. **server proxy** (recommended — ask me to wire it).
- [ ] Ensure `local-keys.js` is never served in prod (404 it).
- [ ] Allow same-origin framing (CSP `frame-ancestors 'self'`).
- [ ] (Optional) Ask me to add `?embed=1` chrome-less mode + `mkf:theme` runtime theming for the most native feel.
- [ ] (Optional) Add the bridge listener to the kids tools if you want them in the library (§5.4 pattern in the tool files).

---

## 11. What I need from you to finish it FOR your stack

Answer these (or point me at the Studio OS repo — open it in a session or push it to GitHub) and I'll produce exact drop-in code instead of the generic version:

1. **Studio OS stack?** (Next.js / Express / Rails / Vue / …) — sets the hosting one-liner and where API routes live.
2. **Same origin or separate host** for the tools?
3. **AI keys:** BYO per user, or a **server proxy** with a shared Studio OS key (metered)? If proxy → give me provider + how routes read the user.
4. **Storage:** which datastore backs the library, and what's the workspace/tenant key to scope by?
5. **Auth:** how do the `/api/maker/*` routes read the current user (session cookie / JWT / header)?
6. **Native feel:** want me to add `?embed=1` (hide the tool's own brand bar) and `mkf:theme` (host pushes Studio OS colors live)? Yes/no.

---
*MakerForge works standalone and unchanged; the Studio bridge and theming hooks are additive and dormant until Studio OS speaks to them. This doc is the single source of truth for the integration.*
