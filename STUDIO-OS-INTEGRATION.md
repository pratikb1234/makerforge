# MakerForge → Studio OS · Integration Handoff

**For:** the developer/agent working inside the **Studio OS** codebase.
**Goal:** embed the MakerForge maker tools (laser CAD, 3D CAD, B-Rep, kids tools) into Studio OS as a first-class feature, with designs saved to Studio OS's own storage.
**Prepared by:** Claude (Fable 5) · reference implementation already built and verified in the Bits & Studios *ops* app.

> You do **not** need to understand MakerForge's internals. It integrates through three small, well-defined seams: (1) serve a static folder, (2) embed one HTML file in an iframe, (3) exchange two `postMessage` events. Everything else is optional polish.

---

## 0. TL;DR — the whole integration in 5 lines

1. Copy the `makerforge/` folder into Studio OS and serve it as static files (any stack).
2. Add a "Maker" entry to your nav that opens `…/makerforge/laser-studio.html` (or `cad-studio.html`) — in an iframe for embedded, or a new tab for a quick win.
3. To let users **save designs into Studio OS**: implement 3 REST endpoints (spec in §4) and talk to the iframe with 2 `postMessage` events (`mkf:get` / `mkf:load`, §3).
4. Keep API keys out of the repo — MakerForge already reads them from the browser or an untracked `local-keys.js` (§5).
5. A complete, working copy of all of the above exists in this repo's `../index.html` + `../server.js` — crib from it (§6).

---

## 1. What you're integrating

MakerForge is **7 self-contained HTML files** — no build step, no framework, no npm install. Each file is a full app (`<style>` + markup + one `<script>`). The ones worth surfacing in Studio OS:

| File | Surface as | Notes |
|---|---|---|
| `laser-studio.html` | **Laser CAD** | 2D vector design → SVG / LightBurn / G-code / DXF. Has AI copilot + Studio bridge. |
| `cad-studio.html` | **3D CAD** | Parametric solids → STL / OBJ. Has AI copilot + Studio bridge. |
| `cad-brep-opencascade.html` | **B-Rep CAD** | True fillets + STEP. Needs http(s) (not `file://`); serves its own WASM from `vendor/`. |
| `laser-studio-kids.html` | **Zappy** (kids laser) | No bridge yet (add if needed, §3.4). |
| `blocks-3d-kids.html` | **BlockBuddy** (kids 3D) | No bridge yet. |

Only `laser-studio.html` and `cad-studio.html` implement the Studio save/load bridge today. The others open fine but won't Save-to-Studio until you add the same 12-line listener (§3.4).

**Hard requirement:** serve over **http(s)**, never `file://` — the B-Rep tool's WebAssembly kernel won't bootstrap otherwise. All tools also assume they're reachable at a path where `./vendor/…` and `./tokens.css` resolve (i.e. keep the folder intact).

---

## 2. Hosting the files (pick one)

### 2a. Same-origin (recommended — required for the design-library bridge)
Serve `makerforge/` from the **same origin** as Studio OS. The `postMessage` bridge and the "save to studio" flow rely on same-origin (`e.origin === location.origin`), and same-origin also avoids iframe/CORS headaches.

- **Node/Express:** `app.use('/makerforge', express.static(pathToMakerforge))`
- **Next.js:** drop the folder in `public/makerforge/` → served at `/makerforge/*` automatically.
- **Vite/CRA:** put it in `public/makerforge/`.
- **Rails/Django/Laravel:** mount it as a static/public directory.
- **Nginx/CDN/static host (Netlify, Vercel, S3+CloudFront):** upload the folder; ensure `.wasm` is served with `Content-Type: application/wasm` (most do automatically; Nginx: add `application/wasm wasm;` to `mime.types`).

### 2b. Different origin (quick, but limited)
Host MakerForge anywhere and link out in a new tab. You lose the in-app design library unless you switch the bridge to `postMessage` with an explicit target origin and add CORS to the API. Fine for a v1 "we have maker tools" link; not the deep integration.

**Iframe embedding note:** if Studio OS sets `Content-Security-Policy: frame-ancestors` or `X-Frame-Options`, allow same-origin framing so the iframe loads.

---

## 3. The embed + bridge (the actual "deep" integration)

### 3.1 Embed
Put the tool in an iframe and give it a way to close:

```html
<iframe id="maker-frame" src="/makerforge/laser-studio.html"
        style="width:100%;height:100%;border:0" title="MakerForge"></iframe>
```

Switch tools by changing `src` to another tool's URL.

### 3.2 The bridge contract (what MakerForge already speaks)
The host (Studio OS) and the tool talk with `window.postMessage`. **Two events, same-origin only.**

**Host → tool:**
| message | meaning |
|---|---|
| `{ type: 'mkf:get' }` | "Send me the current document." |
| `{ type: 'mkf:load', payload }` | "Replace the document with this payload." |

**Tool → host (reply to `mkf:get`):**
| message | meaning |
|---|---|
| `{ type: 'mkf:doc', tool, payload }` | The current document. `tool` is `'laser'` or `'cad'`. |

`payload` is the tool's native document JSON — treat it as an **opaque blob**: store it, hand it back on load, don't parse it. (For the curious: laser = `{v,objects,layers,bed}`, cad = `{v,features,params}`.)

### 3.3 Host-side glue (framework-agnostic)

```js
const frame = document.getElementById('maker-frame');

// Ask the tool for its current document (returns a Promise).
function getDoc() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => { window.removeEventListener('message', h); reject(new Error('tool did not answer')); }, 4000);
    function h(e) {
      if (e.source !== frame.contentWindow || e.origin !== location.origin) return;
      if (e.data && e.data.type === 'mkf:doc') { clearTimeout(timer); window.removeEventListener('message', h); resolve(e.data); }
    }
    window.addEventListener('message', h);
    frame.contentWindow.postMessage({ type: 'mkf:get' }, location.origin);
  });
}

// Push a saved document back into the tool.
function loadDoc(payload) {
  frame.contentWindow.postMessage({ type: 'mkf:load', payload }, location.origin);
}

// Save flow:
async function saveToStudio(name, userId) {
  const { tool, payload } = await getDoc();
  await fetch('/api/maker/designs', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, tool, payload, by: userId })
  });
}
```

That's the entire client integration. Wire `saveToStudio` to a "Save" button and `loadDoc` to a library picker.

### 3.4 Adding the bridge to a tool that lacks one (kids tools)
Paste this before `</script></body>` in `laser-studio-kids.html` / `blocks-3d-kids.html` (adjust the payload fields to that tool's state object — see how `laser-studio.html` / `cad-studio.html` do it):

```js
window.addEventListener('message', e => {
  if (e.origin !== location.origin || !e.data) return;
  if (e.data.type === 'mkf:get')
    e.source.postMessage({ type: 'mkf:doc', tool: 'zappy', payload: /* this tool's document */ }, location.origin);
  if (e.data.type === 'mkf:load' && e.data.payload) { /* restore document, then redraw */ }
});
```

---

## 4. The design-library API (server side)

Studio OS owns storage. MakerForge doesn't care **how** you persist — Postgres, Mongo, S3, a JSON file — only that these three routes exist. Scope them per-user/per-workspace using **your existing Studio OS auth** (the reference impl is unauthenticated demo code — do NOT copy that part; gate these behind your session/RBAC).

| Method & path | Body | Returns |
|---|---|---|
| `GET /api/maker/designs` | — | `[{ id, name, tool, by, createdAt, updatedAt }]` — **metadata only, no payloads** (list view). Filter to the caller's workspace. |
| `GET /api/maker/designs/:id` | — | `{ id, name, tool, by, createdAt, updatedAt, payload }` — full doc incl. payload (for load). |
| `POST /api/maker/designs` | `{ id?, name, tool, payload, by }` | `{ ok:true, id }`. If `id` matches an existing design, update it; else create. |
| `DELETE /api/maker/designs/:id` | — | `{ ok:true }` |

**Data model** (one row/document):
```
id         string  (server-generated)
workspace  string  ← ADD THIS: your tenant/user/workspace key for isolation
name       string  (≤120 chars)
tool       'laser' | 'cad' | …
by         string  (author display name/id)
createdAt  number  (epoch ms)
updatedAt  number  (epoch ms)
payload    json    (opaque — the tool's document; can be large, ~KBs–MBs)
```

Notes:
- `payload` can be a few MB for complex designs. Size your column/limit accordingly (`express.json({ limit: '10mb' })` in the reference).
- Consider a thumbnail later: have the tool also emit a PNG dataURL in `mkf:doc` and store it for a gallery view. Not required for v1.

A complete, working reference of all four routes (JSON-file persistence) is in `../server.js` — search for `MAKERFORGE DESIGN LIBRARY`. **Copy the shape, add auth + workspace scoping + your real datastore.**

---

## 5. API keys & security (do this right)

- **The AI copilots are bring-your-own-key.** MakerForge never ships a key. It reads the user's Gemini/Anthropic key from (a) the in-panel field → browser `localStorage`, or (b) an **untracked** `makerforge/local-keys.js` (`window.MKF_KEYS = { gemini:'…' }`). That file is in `.gitignore` and must never be committed or served publicly.
- **If Studio OS is internet-facing, block `local-keys.js`** at the web layer (don't ship it at all in prod, or return 404). Prefer letting each user paste their own key in the copilot panel.
- **Proxy option (recommended for teams):** instead of BYO-key, add a Studio OS endpoint like `POST /api/maker/ai` that injects a server-held key and forwards to Gemini/Anthropic. Then point the copilot's `fetch` at your proxy. This keeps keys server-side and lets you meter/audit usage. (Requires a small edit to `callLLM()` in the two tools — ask if you want it done.)
- **Copilot calls send scene data to the model provider.** Fine for most designs; flag it if users model anything confidential.
- The `postMessage` bridge is hardened to `e.origin === location.origin`. Keep MakerForge same-origin and this stays safe.
- The tools store an autosave in `localStorage` (`mkf_auto`) — harmless, per-browser.

---

## 6. Reference implementation (working, in this repo)

Everything above is already built and verified in the **ops** app that ships alongside MakerForge:

- **`../server.js`** → the 4 design-library routes (`MAKERFORGE DESIGN LIBRARY` block). JSON-file persistence; swap for your datastore + auth.
- **`../index.html`** → the embedded workspace overlay: tool tabs, library dropdown, Save/Open/Delete, the full `postMessage` bridge glue, toasts. Search `maker-overlay`.
- **`laser-studio.html` / `cad-studio.html`** → the tool-side bridge listener. Search `Studio OS bridge`.

Verified round-trip: design drawn in the embedded tool → **Save to Studio** → wiped → **Open** from library → fully restored (objects + engraved text intact). Reuse the front-end code almost verbatim; replace only the server storage/auth to match Studio OS.

---

## 7. Integration checklist

- [ ] Copy `makerforge/` into Studio OS; serve it **same-origin** over http(s) with correct `.wasm` MIME.
- [ ] Confirm `…/makerforge/cad-brep-opencascade.html` loads (proves http + wasm + vendor path are right).
- [ ] Add a "Maker" nav entry → opens `laser-studio.html` (iframe embed or new tab).
- [ ] (Deep) Implement the 3 `/api/maker/designs` routes against Studio OS storage **with auth + per-workspace scoping**.
- [ ] (Deep) Add the host-side bridge glue (§3.3) + a Save button and library picker.
- [ ] Ensure `local-keys.js` is never served in prod (404 it), or wire the AI proxy (§5).
- [ ] Decide key strategy: BYO-key (default) vs. server proxy.
- [ ] (Optional) Add the bridge listener to the kids tools (§3.4) if you want them in the library too.
- [ ] Allow same-origin framing (CSP `frame-ancestors 'self'`).

---

## 8. Open questions for Pratik (answer these to tailor the integration)

1. **Studio OS stack?** (Next.js / plain Express / Rails / …) — determines the static-hosting one-liner and where the API routes go.
2. **Same origin or separate host** for the tools? (Same origin = deep integration with the library; separate = link-out only unless we add CORS.)
3. **AI keys:** BYO-key per user, or a **server-side proxy** with a shared Studio OS key (metered)? If proxy, I'll patch `callLLM()` in both tools.
4. **Storage:** which datastore backs the design library, and what's the workspace/tenant key to scope by?
5. **Auth:** how should the `/api/maker/*` routes read the current user/workspace (session cookie, JWT, header)?

Send me answers to these (or point me at the Studio OS repo) and I'll produce the exact drop-in code for that stack instead of the generic version above.

---
*This document is self-contained. The MakerForge tools are unchanged and continue to work standalone; the Studio bridge is additive and dormant unless a same-origin host speaks to it.*
