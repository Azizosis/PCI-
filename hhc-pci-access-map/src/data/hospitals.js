/**
 * hospitals.js
 *
 * Static registry of the 26 PCI hospitals across KSA.
 *
 * HOSPITALS      — array of { name, lat, lng }
 * HOSPITAL_COLORS — name → hex color for catchment visualisation
 * CATCHMENT_MATCH — MapLibre 'match' expression built once from HOSPITAL_COLORS
 *
 * Source: extracted verbatim from hhc-pci-access-map_10.html by scripts/extract_data.py
 */

// ─── Hospital list ────────────────────────────────────────────────────────────
export const HOSPITALS = [
  {name:'King Fahad Hospital Baha',lat:20.063,lng:41.438},{name:'King Abdullah Hospital Bisha',lat:20.034,lng:42.613},
  {name:'South Kunfudha General Hospital',lat:18.870,lng:41.328},{name:'King Abdulaziz Hospital Taif',lat:21.268,lng:40.373},
  {name:'Gurayat General Hospital',lat:31.329,lng:37.363},{name:'King Abdulaziz Specialist Hospital Sakaka',lat:29.938,lng:40.187},
  {name:'Prince Abdullah Bin Abdulaziz Bin Musaed Cardiac Center',lat:30.996,lng:41.048},{name:'Rafhaa General Hospital',lat:29.626,lng:43.514},
  {name:'King Fahad Hospital Tabuk',lat:28.447,lng:36.514},{name:'Madinah Cardiac Center',lat:24.495,lng:39.562},
  {name:'King Fahd Specialist Hospital',lat:26.350,lng:43.969},{name:'Cardiac Center at King Khaled Hospital Hail',lat:27.509,lng:41.697},
  {name:'Prince Mohammed Bin Abdulaziz Hospital Riyadh',lat:24.709,lng:46.793},{name:'King Saud Medical City General Hospital',lat:24.628,lng:46.691},
  {name:'King Fahad Medical City',lat:24.687,lng:46.702},{name:'Hafr Albaten Central Hospital',lat:28.311,lng:45.954},
  {name:'King Khaled Hospital Najran',lat:17.545,lng:44.233},{name:'Prince Faisal bin Khalid Cardiac Center',lat:18.210,lng:42.498},
  {name:'Prince Mohammed bin Nasser Hospital',lat:16.996,lng:42.620},{name:'King Fahad Specialist Hospital Dammam',lat:26.411,lng:50.101},
  {name:'Prince Sultan Cardiac Center Al Ahssa',lat:25.359,lng:49.561},{name:'Dammam Medical Complex',lat:26.432,lng:50.084},
  {name:'Al Noor Specialist Hospital Makkah',lat:21.385,lng:39.861},{name:'King Abdallah Medical City',lat:21.383,lng:39.881},
  {name:'King Fahd Hospital',lat:21.543,lng:39.167},{name:'King Abdullah Medical Complex',lat:21.768,lng:39.100}
];

// ─── Per-hospital colors ──────────────────────────────────────────────────────
// Order matches the visual legend; every hospital must have an entry.
export const HOSPITAL_COLORS = {
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
};

// ─── MapLibre 'match' expression (built once, reused across paint calls) ──────
export const CATCHMENT_MATCH = [
  'match', ['get', 'Nearest_Hospital'],
  ...Object.entries(HOSPITAL_COLORS).flatMap(([name, color]) => [name, color]),
  '#444444', // fallback for unmatched haras
];
