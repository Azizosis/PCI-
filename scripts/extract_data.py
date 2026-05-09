#!/usr/bin/env python3
"""
extract_data.py
---------------
Extracts verbatim JS variable declarations from hhc-pci-access-map_10.html
and writes them into the modular ES-module files.

Variables extracted:
  haras.geojson.js  ← HARAS_GEOJSON, HARA_AUX_IDS, HARA_AUX_DIST,
                       HARA_AUX_HAV, HARA_AUX_D2, HARA_AUX_D3,
                       HARA_GOV_TABLE, HARA_GOV_IDX
  hospitals.js      ← HOSPITALS
  placement-data.js ← PLACEMENT_DATA
"""

import re, sys, os, json, textwrap

SRC   = os.path.join(os.path.dirname(__file__), '..', 'hhc-pci-access-map_10.html')
DEST  = os.path.join(os.path.dirname(__file__), '..', 'hhc-pci-access-map', 'src', 'data')

# ── helpers ────────────────────────────────────────────────────────────────────

def read_src():
    with open(SRC, encoding='utf-8') as f:
        return f.read()

def extract_var(src, varname):
    """
    Find 'const VARNAME=<value>;' or 'const VARNAME = <value>;' in src.
    Returns the raw value string (everything between = and the trailing ;).
    Handles nested braces/brackets robustly by counting depth.
    """
    # Find the assignment start
    pattern = rf'\bconst\s+{re.escape(varname)}\s*='
    m = re.search(pattern, src)
    if not m:
        raise ValueError(f'Could not find: const {varname}')
    
    start = m.end()
    # Skip leading whitespace
    while start < len(src) and src[start] in ' \t\n\r':
        start += 1
    
    first = src[start]
    if first in ('{', '[', '"', "'"):
        openers = {'{': '}', '[': ']', '"': '"', "'": "'"}
        closer  = openers[first]
        depth   = 0
        i       = start
        in_str  = False
        str_ch  = None
        while i < len(src):
            ch = src[i]
            if in_str:
                if ch == '\\':
                    i += 2
                    continue
                if ch == str_ch:
                    in_str = False
            else:
                if ch in ('"', "'", '`'):
                    in_str = True
                    str_ch = ch
                elif ch in ('{', '['):
                    depth += 1
                elif ch in ('}', ']'):
                    depth -= 1
                    if depth == 0:
                        return src[start:i+1].strip()
            i += 1
    else:
        # Scalar / number — read to semicolon
        end = src.index(';', start)
        return src[start:end].strip()

def write_file(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'  wrote {os.path.relpath(path)}')

# ── main ───────────────────────────────────────────────────────────────────────

def main():
    print('Reading source HTML...')
    src = read_src()

    print('Extracting variables...')
    haras_geojson   = extract_var(src, 'HARAS_GEOJSON')
    aux_ids         = extract_var(src, 'HARA_AUX_IDS')
    aux_dist        = extract_var(src, 'HARA_AUX_DIST')
    aux_hav         = extract_var(src, 'HARA_AUX_HAV')
    aux_d2          = extract_var(src, 'HARA_AUX_D2')
    aux_d3          = extract_var(src, 'HARA_AUX_D3')
    gov_table       = extract_var(src, 'HARA_GOV_TABLE')
    gov_idx         = extract_var(src, 'HARA_GOV_IDX')
    hospitals       = extract_var(src, 'HOSPITALS')
    placement_data  = extract_var(src, 'PLACEMENT_DATA')

    # Sanity-check lengths by parsing the arrays
    ids_len   = len(json.loads(aux_ids))
    idx_len   = len(json.loads(gov_idx))
    table_len = len(json.loads(gov_table))
    print(f'  HARA_AUX_IDS length  : {ids_len}')
    print(f'  HARA_GOV_IDX length  : {idx_len}')
    print(f'  HARA_GOV_TABLE length: {table_len}')
    assert ids_len == idx_len, 'Length mismatch: HARA_AUX_IDS vs HARA_GOV_IDX'

    # Count features in geojson
    gj = json.loads(haras_geojson)
    print(f'  HARAS_GEOJSON features: {len(gj["features"])}')

    sites_len = len(json.loads(placement_data)['sites'])
    print(f'  PLACEMENT_DATA sites: {sites_len}')

    # ── 1. haras.geojson.js ───────────────────────────────────────────────────
    haras_path = os.path.join(DEST, 'haras.geojson.js')
    haras_content = f'''\
/**
 * haras.geojson.js
 *
 * HARAS_GEOJSON — full KSA neighbourhood FeatureCollection ({len(gj["features"])} features)
 * Parallel auxiliary arrays (positionally aligned to HARA_AUX_IDS):
 *   HARA_AUX_IDS  — HARA_ID values
 *   HARA_AUX_DIST — road distance (km) to nearest PCI hospital (-1 = unreachable)
 *   HARA_AUX_HAV  — haversine distance (km) to nearest PCI hospital
 *   HARA_AUX_D2   — drive time (min) to 2nd-nearest PCI hospital
 *   HARA_AUX_D3   — drive time (min) to 3rd-nearest PCI hospital
 * Governorate parallel arrays (positionally aligned to HARA_AUX_IDS):
 *   HARA_GOV_TABLE — deduplicated governorate name strings [{table_len} entries]
 *   HARA_GOV_IDX   — index into HARA_GOV_TABLE for each haras
 *
 * Source: extracted verbatim from hhc-pci-access-map_10.html by scripts/extract_data.py
 */

// ─── GeoJSON FeatureCollection ───────────────────────────────────────────────
export const HARAS_GEOJSON = {haras_geojson};

// ─── Parallel auxiliary arrays ────────────────────────────────────────────────
export const HARA_AUX_IDS  = {aux_ids};
export const HARA_AUX_DIST = {aux_dist};
export const HARA_AUX_HAV  = {aux_hav};
export const HARA_AUX_D2   = {aux_d2};
export const HARA_AUX_D3   = {aux_d3};

// ─── Governorate parallel arrays ──────────────────────────────────────────────
export const HARA_GOV_TABLE = {gov_table};
export const HARA_GOV_IDX   = {gov_idx};
'''
    write_file(haras_path, haras_content)

    # ── 2. hospitals.js ───────────────────────────────────────────────────────
    # HOSPITAL_COLORS is already correct in the stub (hand-curated). 
    # We only need to fill HOSPITALS array. CATCHMENT_MATCH is derived from HOSPITAL_COLORS.
    hosp_path = os.path.join(DEST, 'hospitals.js')
    hosp_content = f'''\
/**
 * hospitals.js
 *
 * Static registry of the 26 PCI hospitals across KSA.
 *
 * HOSPITALS      — array of {{ name, lat, lng }}
 * HOSPITAL_COLORS — name → hex color for catchment visualisation
 * CATCHMENT_MATCH — MapLibre 'match' expression built once from HOSPITAL_COLORS
 *
 * Source: extracted verbatim from hhc-pci-access-map_10.html by scripts/extract_data.py
 */

// ─── Hospital list ────────────────────────────────────────────────────────────
export const HOSPITALS = {hospitals};

// ─── Per-hospital colors ──────────────────────────────────────────────────────
// Order matches the visual legend; every hospital must have an entry.
export const HOSPITAL_COLORS = {{
  'Prince Mohammed bin Nasser Hospital':                      '#e63946',
  'Prince Faisal bin Khalid Cardiac Center':                  '#457b9d',
  'King Fahad Hospital Baha':                                 '#2dc653',
  'King Fahd Specialist Hospital':                            '#f4a261',
  'South Kunfudha General Hospital':                          '#a8dadc',
  'Madinah Cardiac Center':                                   '#e9c46a',
  'King Abdulaziz Hospital Taif':                             '#9b5de5',
  'King Fahad Medical City':                                  '#00b4d8',
  'King Abdullah Hospital Bisha':                             '#f77f00',
  'Cardiac Center at King Khaled Hospital Hail':              '#06d6a0',
  'King Khaled Hospital Najran':                              '#ef476f',
  'King Abdullah Medical Complex':                            '#118ab2',
  'King Fahad Hospital Tabuk':                                '#ffd166',
  'Dammam Medical Complex':                                   '#6a4c93',
  'Prince Sultan Cardiac Center Al Ahssa':                    '#43aa8b',
  'King Fahad Specialist Hospital Dammam':                    '#f3722c',
  'Prince Mohammed Bin Abdulaziz Hospital Riyadh':            '#577590',
  'King Saud Medical City General Hospital':                  '#90be6d',
  'Gurayat General Hospital':                                 '#ff6b6b',
  'King Abdulaziz Specialist Hospital Sakaka':                '#4ecdc4',
  'Prince Abdullah Bin Abdulaziz Bin Musaed Cardiac Center':  '#c77dff',
  'Rafhaa General Hospital':                                  '#ffb703',
  'Hafr Albaten Central Hospital':                            '#219ebc',
  'Al Noor Specialist Hospital Makkah':                       '#fb8500',
  'King Abdallah Medical City':                               '#8ecae6',
  'King Fahd Hospital':                                       '#d62828',
}};

// ─── MapLibre 'match' expression (built once, reused across paint calls) ──────
export const CATCHMENT_MATCH = [
  'match', ['get', 'Nearest_Hospital'],
  ...Object.entries(HOSPITAL_COLORS).flatMap(([name, color]) => [name, color]),
  '#444444', // fallback for unmatched haras
];
'''
    write_file(hosp_path, hosp_content)

    # ── 3. placement-data.js ──────────────────────────────────────────────────
    pd_path = os.path.join(DEST, 'placement-data.js')
    # Compute total_zx_pop from geojson features
    total_zx_pop = sum(
        f['properties'].get('POPULATION', 0)
        for f in gj['features']
        if f['properties'].get('Zone') == 'Zone X'
    )
    print(f'  Computed total_zx_pop: {total_zx_pop:,}')

    pd_obj = json.loads(placement_data)
    # Inject meta if missing
    if 'meta' not in pd_obj:
        pd_obj['meta'] = {}
    pd_obj['meta']['z1_promo_min'] = 60
    pd_obj['meta']['total_zx_pop'] = total_zx_pop

    pd_content = f'''\
/**
 * placement-data.js
 *
 * Precomputed facility-location dataset for the placement engine.
 *
 * Shape:
 *   meta.z1_promo_min  — drive-time threshold for Zone 1 promotion (60 min)
 *   meta.total_zx_pop  — total Zone X population across all KSA haras
 *   sites[]            — candidate PCI sites (n, lat, lng, s, g?)
 *   cov[][]            — coverage matrix: cov[i] = haras rescued by site i
 *                        each entry: [HARA_ID, new_drive_min, population]
 *
 * Source: extracted verbatim from hhc-pci-access-map_10.html by scripts/extract_data.py
 * meta values computed by extract_data.py from HARAS_GEOJSON.
 */
export const PLACEMENT_DATA = {json.dumps(pd_obj, separators=(',', ':'))};
'''
    write_file(pd_path, pd_content)

    print('\nAll data files written successfully.')
    print('Run: pnpm dev   — then open localhost:3000 to validate.')

if __name__ == '__main__':
    main()
