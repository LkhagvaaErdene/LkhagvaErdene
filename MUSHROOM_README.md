# Mongolian Mushroom Identification — additions to LkhagvaaApp

Built **on top of** the existing vanilla-JS hash-router SPA (Bulma + SCSS, SVG province map). No framework added, no files removed, existing routes/pages/map untouched.

## Run
```bash
npm install                          # sass + bulma
npm run sass                         # only if you change SCSS (outputs src/css/main.css)
cp server/.env.example server/.env   # then put ONE API key in it (comments go on their own line)
npm start                            # http://localhost:8787  (serves the SPA + /api)
npm test                             # unit + server tests (Node >= 18)
python3 tests/e2e_ui.py              # browser tests: navbar, safety hub, identification (pip install playwright pillow; playwright install chromium)
```
`src/` is the single source. The server serves `../docs` if it exists, otherwise `../src` (override with `STATIC_DIR`).
If you publish via GitHub Pages, build/copy `src/` into `docs/` yourself and set `MUSHROOM_API_BASE_URL` in `src/js/config.js`.

## Connecting the page to the backend
Photo identification always needs the Node server (it keeps the API key). The page finds it by itself, trying in order:
1. `?api=https://your-server` (saved in the browser; `?api=` with no value clears it)
2. same origin `/api` (when `npm start` serves the page), then `http://localhost:8787/api` (page opened from Live Server / another static server; CORS for localhost is allowed outside production)
3. on a public host: `MUSHROOM_API_PRODUCTION` in `src/js/config.js`, otherwise same-origin `/api`

Hosting options:
* **Simplest: one deployment for app + API.** Deploy this repo with the included `Dockerfile` (or `render.yaml` on Render.com), set `KINDWISE_API_KEY` in the host's dashboard, and share that URL. Same origin, so no CORS or config. (Deployment files are not tested against a real host.)
* **GitHub Pages + separate API.** Deploy the Docker image somewhere, set `ALLOWED_ORIGINS=https://<user>.github.io` on it and `MUSHROOM_API_PRODUCTION` in `config.js`.

## Navbar
Desktop layout from 1408px; below that a burger menu (accordion dropdowns). The breakpoint lives in two places that must match:
`$navbar-breakpoint` in `src/scss/main.scss` and `NAV_BREAKPOINT` in `src/js/components/navbar.js`.

## Safety hub
`#/mushroom-safety-sos`, `-check`, `-facts` (and `#/mushroom-safety` = checklist) in `src/js/pages/mushroomSafetyPage.js`, with 103/105 call buttons in the navbar dropdown and at the top of every tab. General information only; the first-aid wording should be reviewed by a medical professional.

## Image recognition (backend required)
API keys must never be in the browser, so the SPA calls `/api/identify` on `server/server.js` (zero-dependency Node).
| Variable | Meaning |
|---|---|
| `MUSHROOM_PROVIDER` | `kindwise` (default; dedicated Mushroom.id classifier) or `anthropic` (general vision LLM — never reported as "likely"; confidence is uncalibrated) |
| `KINDWISE_API_KEY` / `ANTHROPIC_API_KEY` | provider key (server only) |
| `STATIC_DIR` | optional; default is `../docs` if present, else `../src` |
| `TRUST_PROXY` | `1` only behind a reverse proxy (uses `X-Forwarded-For` for rate limiting) |
| `ALLOWED_ORIGINS` | needed only if SPA is hosted elsewhere (e.g. GitHub Pages); then set `MUSHROOM_API_BASE_URL` in `src/js/config.js` (+ docs copy) to the backend URL |
| `MAX_IMAGE_BYTES`, `RATE_LIMIT_PER_MIN` | limits |

Without a configured backend the page says so and disables identification; nothing is simulated.
**Status: the Kindwise/Anthropic adapters have NOT been run against the live services** (no keys, and the sandbox cannot reach them). They were exercised against a local stand-in server. The Kindwise response fields (`result.classification.suggestions`, `result.is_mushroom`) were taken from its public docs/SDK descriptions; I could not fetch its OpenAPI file to confirm them. Unexpected responses return an error rather than a result. Test with a real key before relying on it.

## Safety logic (`src/js/fn/mushroomClassify.js`)
Never "confirmed". "Likely" only if service is calibrated, top ≥ 0.80 and ≥ 0.25 ahead of the 2nd; otherwise headline = *Identification inconclusive*. Poisonous candidates ≥ 10% are always flagged; dangerous look-alikes are listed. Species not in the database → *Toxicity unknown*.

## Data
`src/data/`: `mushrooms.json` (16 species), `mushroomSources.json`, `mushroomRegions.json`, `mushroomRecords.json` (**empty**).
* Presence in Mongolia, phytogeographic regions, herbarium vouchers, regional conservation status: Kherlenchimeg et al. 2024, *Mycobiology* 52(1):13–29 (CC BY-NC 4.0; confirm licence fits your use). It publishes **no coordinates**.
* Toxicity: Pegler & Watling list (BioImages), mycetism reviews (PMC4057534, PMC11774429), EXCLI J 2024, Michelot & Melendez-Howell 2003, Merck Vet Manual (animals), Beug 2009. Edibility: non-Mongolian papers (Bulam 2018, Niveiro 2009, Studies in Fungi 2022, Foods 2022, Sensors 2024), labelled as such.
* **Not verified / needs expert review:** Mongolian common names (all `null` — none could be verified), morphology/identification/look-alike text and seasons (general mycological knowledge, flagged `unreviewed`), animal toxicity (only where a source was found), and the **region → aimag crosswalk** (`mushroomRegions.json`, approximate; regions without a confident mapping are not shaded).
* Several edible entries rest on one or two secondary sources (`confidenceLevel` low/medium).

## Real observation records
`node tools/importGbifRecords.mjs` (needs internet) pulls GBIF occurrences (`country=MN`, with coordinates) per species, keeps GBIF licences/URLs, maps province only on an exact name match, and writes `mushroomRecords.json` in `src` and `docs`. Records outside Mongolia's extent are dropped by the app. The importer's mapping is unit-tested offline; it has **not** been run against live GBIF.

## Map
Same `map.svg`, loader and labels. Added: `fn/geo.js` (lat/lon → SVG; approximate, province-scale — 18/22 aimag centres land in the right polygon), a marker layer, province shading (approximate region crosswalk), legend, click panels. Original decorative pins are hidden on the atlas map only. In `map.js`: two exports added, and the missing Orkhon / Govi-Sumber names.

## Files
Modified: `src/js/{config,routes}.js`, `components/{navbar,map}.js`, `i18n/translations.js`, `scss/main.scss`, `package.json`, `.gitignore` (+ mirrored in `docs/`, plus compiled CSS).
New: `js/fn/{geo,mushroomClassify}.js`, `js/services/{mushroomService,identifyService}.js`, `js/components/{mushroomUi,mushroomMap}.js`, `js/pages/{mushroomIdentifyPage,mushroomAtlasPage}.js`, `scss/components/_mushroom.scss`, `data/mushroom*.json`, `server/*`, `tools/importGbifRecords.mjs`, `tests/*`.
Untouched: the duplicate nested `LkhagvaaApp/LkhagvaaApp/` copy in your archive.

## Known limitations
* Existing navbar already overflows below ~1400 px wide in Mongolian (and the page scrolls sideways on phones); not changed. Mushroom entries were grouped in one "Мөөг" dropdown to avoid making it worse.
* No species photos (none with a verified licence).
