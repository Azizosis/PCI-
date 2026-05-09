/**
 * camera.js — map camera animation helpers
 *
 * All camera animations in the app go through these functions so that:
 *   1) Camera state (pitch/bearing modified by the app) is tracked explicitly.
 *   2) `closeDossier()` only resets the camera when the app changed it.
 */

let _appModifiedCamera = false;

/** Mark that the app changed pitch/bearing (so closeDossier knows to reset). */
function setAppCamera(map, options) {
  _appModifiedCamera = true;
  map.easeTo(options);
}

/**
 * Fly to a region center.
 *
 * @param {maplibregl.Map} map
 * @param {number} lng
 * @param {number} lat
 */
export function flyToRegion(map, lng, lat) {
  _appModifiedCamera = true;
  map.flyTo({
    center:   [lng, lat],
    zoom:     7,
    duration: 1400,
    pitch:    30,
    bearing:  -8,
    curve:    1.4,
    easing:   (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  });
}

/**
 * Fly to a hospital location (catchment mode).
 *
 * @param {maplibregl.Map} map
 * @param {number} lng
 * @param {number} lat
 */
export function flyToHospital(map, lng, lat) {
  _appModifiedCamera = true;
  map.flyTo({ center: [lng, lat], zoom: 8, duration: 1200, pitch: 25, bearing: -5, curve: 1.2 });
}

/**
 * Fly to a placement site.
 *
 * @param {maplibregl.Map} map
 * @param {number} lng
 * @param {number} lat
 */
export function flyToSite(map, lng, lat) {
  _appModifiedCamera = true;
  map.flyTo({ center: [lng, lat], zoom: 7.5, duration: 1200, pitch: 30, bearing: -8, curve: 1.3 });
}

/**
 * Reset pitch and bearing to top-down north-up.
 * Only animates if the app previously changed the camera.
 *
 * @param {maplibregl.Map} map
 */
export function resetCamera(map) {
  if (!_appModifiedCamera) return;
  _appModifiedCamera = false;
  map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
}
