/**
 * data-index.js
 *
 * Builds all in-memory lookup structures from the raw data arrays and
 * re-exports everything through a single import point.
 *
 * Consumers should import from this module, not from the raw data files,
 * so that build-time transformations (canonicalisation, Map construction)
 * are performed exactly once.
 */

import {
  HARAS_GEOJSON,
  HARA_AUX_IDS, HARA_AUX_DIST, HARA_AUX_HAV, HARA_AUX_D2, HARA_AUX_D3,
  HARA_GOV_IDS, HARA_GOV_IDX, HARA_GOV_TABLE,
} from './haras.geojson.js';

import { HOSPITALS, HOSPITAL_COLORS, CATCHMENT_MATCH } from './hospitals.js';
import { PLACEMENT_DATA } from './placement-data.js';

// ─── Region summary table (verbatim from original file) ───────────────────────
export const REGIONS = [
  { id: 'AL_BAHAH',   name: 'Al Bahah',          lat: 20.051, lng: 41.308, z1: { nbhd: 416,  pop: 170214,  pct_pop: 0.722, avg: 43.0 }, z2: { nbhd: 869,  pop: 64088,   pct_pop: 0.272, avg: 87.6  }, zx: { nbhd: 59,   pop: 1338,    pct_pop: 0.006, avg: 125.9 }, total: { nbhd: 1344,  pop: 235640   }, hospitals: ['King Fahad Hospital Baha', 'King Abdullah Hospital Bisha'] },
  { id: 'AL_JAWF',    name: 'Al Jawf',            lat: 30.198, lng: 39.323, z1: { nbhd: 123,  pop: 98020,   pct_pop: 0.439, avg: 36.0 }, z2: { nbhd: 56,   pop: 117284,  pct_pop: 0.526, avg: 90.4  }, zx: { nbhd: 17,   pop: 7758,    pct_pop: 0.035, avg: 145.0 }, total: { nbhd: 196,   pop: 223062   }, hospitals: ['Gurayat General Hospital', 'King Abdulaziz Specialist Hospital Sakaka'] },
  { id: 'AL_MADINAH', name: 'Al Madinah',         lat: 24.395, lng: 39.238, z1: { nbhd: 144,  pop: 57792,   pct_pop: 0.081, avg: 43.5 }, z2: { nbhd: 478,  pop: 160370,  pct_pop: 0.224, avg: 92.0  }, zx: { nbhd: 758,  pop: 497788,  pct_pop: 0.695, avg: 162.0 }, total: { nbhd: 1380,  pop: 715950   }, hospitals: ['Madinah Cardiac Center', 'King Fahd Specialist Hospital'] },
  { id: 'AL_QASEEM',  name: 'Al Qaseem',          lat: 25.960, lng: 43.453, z1: { nbhd: 391,  pop: 458626,  pct_pop: 0.586, avg: 37.5 }, z2: { nbhd: 363,  pop: 260255,  pct_pop: 0.332, avg: 84.6  }, zx: { nbhd: 221,  pop: 63995,   pct_pop: 0.082, avg: 155.9 }, total: { nbhd: 975,   pop: 782876   }, hospitals: ['King Fahd Specialist Hospital', 'Cardiac Center at King Khaled Hospital Hail'] },
  { id: 'AR_RIYADH',  name: 'Ar Riyadh',          lat: 24.288, lng: 45.141, z1: { nbhd: 145,  pop: 268273,  pct_pop: 0.163, avg: 46.3 }, z2: { nbhd: 838,  pop: 790277,  pct_pop: 0.480, avg: 93.3  }, zx: { nbhd: 1631, pop: 589489,  pct_pop: 0.358, avg: 180.5 }, total: { nbhd: 2614,  pop: 1648039  }, hospitals: ['Prince Mohammed Bin Abdulaziz Hospital Riyadh', 'King Saud Medical City General Hospital', 'King Fahad Medical City'] },
  { id: 'ASEER',      name: 'Aseer',              lat: 18.638, lng: 42.375, z1: { nbhd: 1043, pop: 801501,  pct_pop: 0.526, avg: 38.3 }, z2: { nbhd: 3259, pop: 606422,  pct_pop: 0.398, avg: 93.5  }, zx: { nbhd: 1016, pop: 116877,  pct_pop: 0.077, avg: 135.2 }, total: { nbhd: 5318,  pop: 1524800  }, hospitals: ['Prince Faisal bin Khalid Cardiac Center', 'King Abdullah Hospital Bisha', 'South Kunfudha General Hospital'] },
  { id: 'EASTERN',    name: 'Eastern Province',   lat: 26.285, lng: 49.235, z1: { nbhd: 490,  pop: 2200989, pct_pop: 0.754, avg: 31.2 }, z2: { nbhd: 215,  pop: 531850,  pct_pop: 0.182, avg: 78.3  }, zx: { nbhd: 247,  pop: 184749,  pct_pop: 0.063, avg: 182.0 }, total: { nbhd: 952,   pop: 2917588  }, hospitals: ['King Fahad Specialist Hospital Dammam', 'Prince Sultan Cardiac Center Al Ahssa', 'Dammam Medical Complex'] },
  { id: 'HAIL',       name: 'Hail',               lat: 26.894, lng: 41.431, z1: { nbhd: 125,  pop: 44154,   pct_pop: 0.151, avg: 43.2 }, z2: { nbhd: 396,  pop: 136275,  pct_pop: 0.468, avg: 87.8  }, zx: { nbhd: 378,  pop: 111036,  pct_pop: 0.381, avg: 141.4 }, total: { nbhd: 899,   pop: 291465   }, hospitals: ['Cardiac Center at King Khaled Hospital Hail'] },
  { id: 'JAZAN',      name: 'Jazan',              lat: 17.205, lng: 42.937, z1: { nbhd: 755,  pop: 756071,  pct_pop: 0.629, avg: 42.5 }, z2: { nbhd: 2101, pop: 415994,  pct_pop: 0.346, avg: 84.3  }, zx: { nbhd: 492,  pop: 30057,   pct_pop: 0.025, avg: 138.0 }, total: { nbhd: 3348,  pop: 1202122  }, hospitals: ['Prince Mohammed bin Nasser Hospital', 'Prince Faisal bin Khalid Cardiac Center'] },
  { id: 'MAKKAH',     name: 'Makkah',             lat: 20.817, lng: 40.773, z1: { nbhd: 1056, pop: 649823,  pct_pop: 0.508, avg: 38.9 }, z2: { nbhd: 1845, pop: 417227,  pct_pop: 0.326, avg: 92.8  }, zx: { nbhd: 1136, pop: 211354,  pct_pop: 0.165, avg: 149.9 }, total: { nbhd: 4037,  pop: 1278404  }, hospitals: ['Al Noor Specialist Hospital Makkah', 'King Abdallah Medical City', 'King Abdulaziz Hospital Taif', 'King Fahd Hospital'] },
  { id: 'NAJRAN',     name: 'Najran',             lat: 17.913, lng: 44.406, z1: { nbhd: 59,   pop: 53385,   pct_pop: 0.256, avg: 46.4 }, z2: { nbhd: 195,  pop: 42759,   pct_pop: 0.205, avg: 85.5  }, zx: { nbhd: 68,   pop: 112412,  pct_pop: 0.539, avg: 188.0 }, total: { nbhd: 322,   pop: 208556   }, hospitals: ['King Khaled Hospital Najran', 'Prince Faisal bin Khalid Cardiac Center'] },
  { id: 'N_BORDERS',  name: 'Northern Borders',   lat: 30.548, lng: 41.238, z1: { nbhd: 26,   pop: 10030,   pct_pop: 0.092, avg: 33.6 }, z2: { nbhd: 73,   pop: 93659,   pct_pop: 0.855, avg: 100.8 }, zx: { nbhd: 32,   pop: 5888,    pct_pop: 0.054, avg: 139.4 }, total: { nbhd: 131,   pop: 109577   }, hospitals: ['Prince Abdullah Bin Abdulaziz Bin Musaed Cardiac Center', 'Rafhaa General Hospital'] },
  { id: 'TABUK',      name: 'Tabuk',              lat: 26.950, lng: 36.766, z1: { nbhd: 22,   pop: 21493,   pct_pop: 0.074, avg: 32.0 }, z2: { nbhd: 37,   pop: 7875,    pct_pop: 0.027, avg: 90.7  }, zx: { nbhd: 368,  pop: 259738,  pct_pop: 0.898, avg: 191.3 }, total: { nbhd: 427,   pop: 289106   }, hospitals: ['King Fahad Hospital Tabuk', 'Madinah Cardiac Center'] },
];

// ─── Canonical governorate name map ──────────────────────────────────────────
const GOV_CANONICAL = {
  'Al Is': 'Al Ais',
};

// ─── HARA_AUX lookup: HARA_ID → { dist, hav, d2, d3 } ───────────────────────
export const HARA_AUX = (() => {
  const m = new Map();
  for (let i = 0; i < HARA_AUX_IDS.length; i++) {
    m.set(HARA_AUX_IDS[i], {
      dist: HARA_AUX_DIST[i],
      hav:  HARA_AUX_HAV[i],
      d2:   HARA_AUX_D2[i],
      d3:   HARA_AUX_D3[i],
    });
  }
  return m;
})();

// ─── HARA_GOV lookup: HARA_ID → canonicalised governorate name ───────────────
export const HARA_GOV = (() => {
  const m = new Map();
  for (let i = 0; i < HARA_GOV_IDS.length; i++) {
    const raw = HARA_GOV_TABLE[HARA_GOV_IDX[i]];
    m.set(HARA_GOV_IDS[i], GOV_CANONICAL[raw] || raw);
  }
  return m;
})();

// ─── HARAS_TO_BEST_CANDIDATE: HARA_ID → best single candidate across all sites
// Used for placement reverse-lookup ("what site best covers this red haras?")
export const HARAS_TO_BEST_CANDIDATE = (() => {
  const m = new Map();
  for (let i = 0; i < PLACEMENT_DATA.cov.length; i++) {
    for (const e of PLACEMENT_DATA.cov[i]) {
      const cur = m.get(e[0]);
      if (!cur || e[1] < cur.newMin) {
        m.set(e[0], { siteIdx: i, newMin: e[1], pop: e[2] });
      }
    }
  }
  return m;
})();

// ─── Re-export raw data and processed structures ──────────────────────────────
export {
  HARAS_GEOJSON,
  HOSPITALS,
  HOSPITAL_COLORS,
  CATCHMENT_MATCH,
  PLACEMENT_DATA,
};
