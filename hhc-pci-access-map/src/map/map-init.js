/**
 * map-init.js — MapLibre map instantiation and coordinate readout
 *
 * Exports a single `initMap(containerId)` function that returns the map
 * instance.  All layer setup, interaction wiring, and camera animation
 * live in separate modules.
 */

/**
 * Initialise and return the MapLibre GL map.
 *
 * @param {string} containerId  DOM id of the map container element
 * @returns {maplibregl.Map}
 */
export function initMap(containerId) {
  const map = new maplibregl.Map({
    container: containerId,
    style: {
      version: 8,
      sources: {
        'carto-dark': {
          type: 'raster',
          tiles: ['https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'],
          tileSize: 256,
          attribution: '© CARTO',
          maxzoom: 19,
        },
      },
      layers: [{ id: 'bg', type: 'raster', source: 'carto-dark' }],
    },
    center:        [44.5, 23.5],
    zoom:          5.0,
    minZoom:       3,
    maxZoom:       14,
    attributionControl: false,
  });

  // Coordinate readout
  const coordEl = document.getElementById('coord-readout');
  if (coordEl) {
    map.on('mousemove', (e) => {
      coordEl.textContent =
        `${e.lngLat.lat.toFixed(4)}° N \u00a0 ${e.lngLat.lng.toFixed(4)}° E`;
    });
  }

  return map;
}
