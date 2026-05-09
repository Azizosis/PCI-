/**
 * hospitals.js
 *
 * Static registry of the 26 PCI hospitals across KSA, with coordinates and
 * a color assignment for catchment visualisation.
 *
 * HOSPITALS — array of { name, lat, lng }
 * HOSPITAL_COLORS — map of name → hex color (used by catchment fill + popups)
 * CATCHMENT_MATCH — prebuilt MapLibre 'match' expression (avoids rebuilding on each paint call)
 */

// ─── Hospital list ────────────────────────────────────────────────────────────
// Paste HOSPITALS array from hhc-pci-access-map_10.html here.
export const HOSPITALS = /* INSERT_HOSPITALS */ [];

// ─── Per-hospital colors ──────────────────────────────────────────────────────
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
  '#444', // fallback
];
