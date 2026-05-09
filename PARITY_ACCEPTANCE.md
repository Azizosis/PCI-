# Parity Acceptance Criteria
## HHC PCI Access Intelligence — Modular App vs. hhc-pci-access-map_10.html

This document defines the expected observable behavior for each view mode.
A parity pass requires all items in each mode to match the reference HTML file.

---

## Smoke Test (automated, runs at startup)

| Check | Expected Value |
|---|---|
| HARAS_GEOJSON features | 23,360 |
| HARA_INDEX size (access-indexed haras) | 21,943 |
| HOSPITALS count | 26 |
| Placement candidates | 272 |
| Top placement site name | Yanbu |

Results logged to browser console under `[HHC-PCI Smoke Test]`.

---

## Mode 1: Zone

**Entry**: default on load, or clicking the "Zone" button in the view-mode section.

**Map layer behavior**:
- All 23,360 haras polygons visible as filled polygons
- Fill color reflects zone classification:
  - Zone 1 (<=60 min drive): `#00e5b4` (teal)
  - Zone 2 (60-120 min): `#d4a017` (amber)
  - Zone X (>120 min / unreachable): `#e03e3e` (red)
- Outline layer (`haras-outline`) matches fill color expression exactly
- 26 hospital markers visible as blue circles

**Left panel**:
- List label: "Regions — % Pop in Zone 1"
- 13 region rows, sorted descending by `z1.pct_pop`
- Each row shows zone-1 percentage badge, region name, and Zone X alert if `zx.pct_pop >= 0.35`

**Interactions**:
- Hovering a haras polygon: MapLibre popup with HARA_NAME_ENG, HARA_NAME (Arabic), drive time, zone badge, population
- Clicking a haras polygon: closes popup, opens region dossier for the haras's region
- Clicking a region row: flies to region, opens region dossier
- Clicking a hospital marker: opens hospital/catchment dossier

**Dossier — Region**:
- Badge shows region name
- Zone breakdown: Z1/Z2/ZX haras counts and population percentages
- Severity label based on `zx.pct_pop` ladder (Critical/High/Moderate/Low)
- Top governorates by Zone X population
- Impact SVG minimap

---

## Mode 2: Catchment

**Entry**: clicking the "Catchment" button.

**Map layer behavior**:
- Haras polygons recolored by `Nearest_Hospital` property
- Each hospital assigned a unique color from `HOSPITAL_COLORS`
- Outline layer matches fill color expression
- Hospital markers remain visible

**Left panel**:
- List label: "Hospitals — Catchment Size"
- Rows sorted descending by catchment population
- Each row shows hospital color dot, short hospital name, population in thousands

**Interactions**:
- Clicking a hospital row or marker: opens hospital dossier
- Hospital dossier shows: name, catchment haras count, catchment population, zone breakdown within catchment, fragility score

---

## Mode 3: Priority

**Entry**: clicking the "Priority" button.

**Map layer behavior**:
- Haras polygons colored by `priority_score` (computed as `POPULATION * Driving_Min / 60`)
- Fill expression is a 5-stop `step` expression at quantile thresholds, not a linear `interpolate`
- Color ramp (dark blue → orange-red): `#1a2840`, `#3a5a90`, `#d4a017`, `#ff6b3e`, `#ff1e3c`
- Outline layer matches fill
- Camera resets to KSA overview

**Left panel**:
- List label: "Regions — Person-Hours of Access Burden"
- 13 rows sorted descending by aggregate `priority_score` sum
- Each row shows score in thousands (K) with color-coded badge

**Interactions**:
- Clicking a region row: opens region dossier
- Clicking a haras polygon: opens region dossier for that haras's region

---

## Mode 4: Placement

**Entry**: clicking the "Placement" button.

**Map layer behavior**:
- Non-Zone-X haras: `#1a2236` (dark background)
- Zone X haras rescued by top-10: `#00e5b4` (teal)
- Zone X haras not rescued: `#ff1e3c` (red)
- When a site is selected, Zone X haras recolor by `site_focus`:
  - `site_focus=1` (<=60 min gain): `#00e5b4`
  - `site_focus=2` (60-120 min gain): `#d4a017`
  - still Zone X: `#3a1a22`
- 10 numbered purple circle markers on the map at candidate site coordinates

**Marker interaction**:
- Markers start in `idle` state (`data-state="idle"`)
- Hovering: `borderColor` becomes `#00e5b4`, `transform: scale(1.18)` if not selected
- Clicking: marker moves to `selected` state (`data-state="selected"`, `scale(1.25)`, teal border + glow)
- Other markers move to `dimmed` state (`opacity: 0.45`, `scale(0.85)`)
- Closing dossier: all markers return to `idle` state
- No GeoJSON source mutation occurs during hover events

**Left panel**:
- Placement summary block: top site name, total rescued, top-5 vs top-10 stats, do-nothing STEMI comparator
- 10 ranked rows with site name, classification badge (`Build PCI Hub` / `tPA Spoke` / `Transfer Optimization`), invScore, Z1 and Z2 population gains
- Marginal/cumulative curve SVG

**Placement dossier** (opens on marker click or row click):
- Site name and rank
- Facility classification with recommendation type
- invScore and component breakdown
- Population gaining <=60-min access (Zone 1 promotion)
- Population gaining 60-120-min access (Zone 2 promotion)
- Total haras count rescued
- Fragility / redundancy impact
- Top affected governorates with haras and population breakdown
- Do-nothing comparator block
- Marker remains visible and highlighted while dossier is open

**Zone X reverse popup** (clicking an unreached Zone X haras in placement mode):
- Header: region name, HARA_NAME_ENG, HARA_NAME (Arabic), Zone X badge, current drive time, population
- Three branches:
  1. Covered in top 10: shows which site covers it and new drive time
  2. Not in top 10 but has a best alternative: shows best candidate and drive time improvement
  3. Unreachable: confirms no candidate reaches within 120 min

---

## Cross-mode invariants

- The `haras-outline` layer color expression is always kept in sync with `haras-fill`
- Switching view modes clears any open dossier and resets the camera (except Catchment, which retains current view)
- Layer toggles (Boundaries, Hospitals, Unreachable Population, Access Corridors) persist their ON/OFF state across mode switches
- The loading overlay is visible from page load until `dataReady` resolves and the map enters Zone mode
- If `dataReady` rejects, the overlay shows an error message and the map does not initialize
