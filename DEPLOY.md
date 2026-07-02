# MakerForge — Deploy-to-Website Handoff

**Task:** get the MakerForge tools live on the Studio OS website.
**Audience:** the code session doing the upload/deploy.
**One line:** MakerForge is a ~14 MB folder of **static, self-contained HTML** — copy it into the website's public directory and it works. No build, no npm, no bundler config.

---

## 1. Where the code is (pull from GitHub — it's clean, no secrets)

- **Source of truth:** `https://github.com/pratikb1234/makerforge` — branch **`main`** (public, MIT).
- Get it:
  ```bash
  git clone https://github.com/pratikb1234/makerforge.git
  # or, to vendor a snapshot:
  npx degit pratikb1234/makerforge makerforge
  ```
- The repo root **is** the folder to deploy (the `.html` files are at the top level).

---

## 2. What you're deploying

- **Total ~14 MB**, all static. 11 MB of that is one file: `vendor/replicad_single.wasm` (the OpenCascade kernel — only the B-Rep tool needs it; everything else is tiny).
- Entry points (each is a full standalone app):
  `laser-studio.html` · `cad-studio.html` · `cad-brep-opencascade.html` · `aero-lab.html` · `laser-studio-kids.html` · `blocks-3d-kids.html` · `open-cad-launcher.html`
- Support files that **must ship alongside** (tools reference them by relative path): `tokens.css`, the whole `vendor/` folder. `tests/` and the `.md` docs are optional — skip them in the deploy if you want a leaner bundle.

---

## 3. How to add it to the Studio OS site (Vite SPA on Vercel)

The website is a **Vite single-page app on Vercel** (`studio-os-beta-seven.vercel.app`). Vite serves the `public/` directory at the site root, so:

1. Copy the MakerForge files into **`public/makerforge/`** in the Studio OS repo:
   ```
   studio-os-repo/
     public/
       makerforge/
         laser-studio.html
         cad-studio.html
         aero-lab.html
         … (all the .html)
         tokens.css
         vendor/…            ← keep this folder intact
   ```
   (Or add it as a git submodule/subtree of `github.com/pratikb1234/makerforge` so future updates are a `git pull`.)
2. Commit + push. Vercel deploys it automatically to `https://<site>/makerforge/*`.
3. **Done** for "the tools are live." Reachable at e.g. `https://studio-os-beta-seven.vercel.app/makerforge/laser-studio.html`.

> Other stacks (if the repo isn't Vite): Next.js → same, `public/makerforge/`. Plain static host / Nginx → drop the folder in the web root. The only requirement is that it's served over **http(s)** (never `file://`) and `.wasm` is served as `application/wasm` (Vercel and most hosts do this automatically).

---

## 4. Rules — do not break these

- **Keep the folder structure intact.** Tools load `./tokens.css` and `./vendor/…` relatively. If you flatten or move files, they break.
- **Do NOT add `local-keys.js`.** It holds an API key and is git-ignored on purpose. It is not in the GitHub repo, and it must never be in `public/`. Users paste their own AI key in-app, or you wire a server proxy (see the integration doc).
- **Serve over http(s), not `file://`** — the B-Rep tool's WASM won't load otherwise. (Vercel is fine.)
- **Don't run it through the SPA router.** These are standalone `.html` files, not React routes. Serving from `public/` bypasses the SPA router, which is exactly what you want. If the site has a catch-all rewrite to `index.html`, add an exception so `/makerforge/*` serves the static files (Vercel serves `public/` before rewrites, so usually no action needed — just verify §6).

---

## 5. Make it reachable from the UI (minimum)

Add a nav entry / button in Studio OS that opens a tool. Two options:

- **Quick:** link/anchor to `/makerforge/laser-studio.html` (new tab or same tab).
- **Embedded (nicer):** open it in an `<iframe src="/makerforge/laser-studio.html">` inside a Studio OS view.

For the **deep** integration — save/load designs into Studio OS storage, theme the tools to match the site, hide the tool's own brand bar, a server-side AI-key proxy — follow **`STUDIO-OS-INTEGRATION.md`** in this same folder. That doc has the postMessage bridge, the design-library API contract, the **Vercel storage gotcha** (the JSON-file API won't work on Vercel's read-only serverless FS — use Vercel KV/Postgres/Blob), and the `tokens.css` theming lever.

---

## 6. Verify after deploy (paste these, expect 200 + a rendered tool)

```bash
SITE=https://studio-os-beta-seven.vercel.app     # or your deploy URL
curl -s -o /dev/null -w "%{http_code}\n" $SITE/makerforge/laser-studio.html   # → 200
curl -s -o /dev/null -w "%{http_code}\n" $SITE/makerforge/cad-studio.html      # → 200
curl -s -o /dev/null -w "%{http_code}\n" $SITE/makerforge/aero-lab.html        # → 200
curl -s -I $SITE/makerforge/vendor/replicad_single.wasm | grep -i content-type # → application/wasm
```
Then open `…/makerforge/cad-brep-opencascade.html` in a browser — if its 3D kernel loads (status pill goes green), your http + wasm + vendor paths are all correct. If every tool loads but B-Rep hangs, it's a wasm MIME or path issue (§4).

---

## 7. Fastest alternative (if you just want it live NOW)

Deploy the folder as its **own** Vercel project — no Studio OS changes needed:
```bash
git clone https://github.com/pratikb1234/makerforge.git && cd makerforge
vercel deploy --prod        # or drag-drop the folder into vercel.com
```
You get `makerforge-xxxx.vercel.app` immediately. Embed that URL in Studio OS later. (Cross-origin: viewing works out of the box; the in-app save/load bridge needs same-origin hosting or a CORS tweak — see the integration doc.)

---

*Static files, self-contained, ~14 MB. Copy → deploy → verify. Everything beyond "make it reachable" is in `STUDIO-OS-INTEGRATION.md`.*
