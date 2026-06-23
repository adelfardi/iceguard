# IceGuard demo recorder

Records a scripted walkthrough of the running app with Playwright, then renders a
GIF + MP4. The rendered files are **not committed** — they are published as **GitHub
release assets** and the project README points at those URLs (keeps big binaries out of git).

## Prerequisites
- The app running locally: frontend on `http://localhost:5173`, backend on `:8080`
  (see the repo README). Override the base URL with `DEMO_BASE`.
- Demo data present — e.g. `analytics.events` with snapshots, and a few catalogs.
  Avoid any catalog whose URI is confidential (it shows on the Catalogs page).
- For the Spark maintenance step (rewrite-data-files with result + logs), the backend
  must have Spark available (the `docker-compose.dev.yml` backend bundles it).

## 1. Generate
```bash
cd tooling/demo
npm install
npx playwright install chromium
node demo.mjs                 # records out/*.webm  (full walkthrough)
npm run render                # webm -> docs/demo.gif + docs/demo.mp4
```

Tuning knobs (env vars):
- `DEMO_PACE` (default `0.7`) — per-step pacing while recording (`<1` = snappier).
- `DEMO_SPEED` (default `1.3`) — playback speed-up applied at render time.
- GIF output is 760px / 8fps / sped-up (~7 MB). Edit `render.mjs` to change.

Edit the scenario (pages, clicks, pacing) in `demo.mjs`.

## 2. Publish as release assets
The README references `…/releases/download/<tag>/demo.gif` (and `demo.mp4`), so upload the
freshly rendered files to the matching release:
```bash
# create the release if it doesn't exist yet (notes from the changelog), else just upload
gh release create v0.2.0 docs/demo.gif docs/demo.mp4 \
  --title "IceGuard 0.2.0" --notes-file <(awk '/^## \[0\.2\.0\]/{f=1;next} /^## \[/{if(f)exit} f' ../../CHANGELOG.md)

# updating an existing release: overwrite the assets
gh release upload v0.2.0 docs/demo.gif docs/demo.mp4 --clobber
```

Then make the README point at that tag (only if it changed):
```
README.md → <img src=".../releases/download/<tag>/demo.gif" ...>
            <a href=".../releases/download/<tag>/demo.mp4">▶ MP4 version</a>
```

`docs/demo.gif` / `docs/demo.mp4` and `tooling/demo/out/` are git-ignored — only the
scenario (`demo.mjs`) and renderer (`render.mjs`) are committed.
