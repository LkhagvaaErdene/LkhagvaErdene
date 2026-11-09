# Mongolian Mushroom Identification — additions to LkhagvaaApp

Built **on top of** the existing vanilla-JS hash-router SPA (Bulma + SCSS, SVG province map). No framework added, no files removed, existing routes/pages/map untouched.

## Run
```bash
npm install                       # sass + bulma (existing)
npm run sass                      # only if you change SCSS (then copy src/css -> docs/css)
cp server/.env.example server/.env   # add ONE API key (see below)
npm start                         # http://localhost:8787  (serves ../docs + /api)
npm test                          # unit + server tests (Node >= 18)
python3 tests/e2e.py              # browser tests (needs: pip install playwright pillow; playwright install chromium)
```
`src/` is the source and `docs/` the published copy; the JS/CSS/data changes were applied to both (identical).

## Image recognition (backend required)
API keys must never be in the browser, so the SPA calls `/api/identify` on `server/server.js` (zero-dependency Node).
| Variable | Meaning |
|---|---|
| `MUSHROOM_PROVIDER` | `kindwise` (default; dedicated Mushroom.id classifier) or `anthropic` (general vision LLM — never reported as "likely"; confidence is uncalibrated) |
| `KINDWISE_API_KEY` / `ANTHROPIC_API_KEY` | provider key (server only) |
| `STATIC_DIR` | optional, serve the SPA from the same server |
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
