# IceGuard demo recorder

Records a scripted walkthrough of the running app with Playwright, then renders
a GIF + MP4 into `docs/` for the project README.

## Prerequisites
- The app running locally: frontend on `http://localhost:5173`, backend on `:8080`
  (see the repo README / CLAUDE.md). Override with `DEMO_BASE`.
- Demo data present (e.g. `analytics.events` with snapshots).

## Usage
```bash
cd tooling/demo
npm install
npx playwright install chromium
node demo.mjs                 # records out/*.webm
npm run render                # webm -> docs/demo.gif + docs/demo.mp4
```

Edit the scenario (pages, clicks, pacing) in `demo.mjs`.
