/**
 * legends.js — render the data-layers section and zone legend section
 * into the left panel.
 */

/**
 * Render the Data Layers toggle section.
 *
 * @param {string} containerId
 * @param {(id: string) => void} onToggle  called with layer id when toggled
 * @param {{ haras: boolean, hospitals: boolean, towers: boolean, arcs: boolean }} layerState
 */
export function renderLayersSection(containerId, onToggle, layerState) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const layers = [
    { id: 'haras',     label: 'Neighborhood Boundaries', count: '21,943', color: 'var(--z1)',   on: layerState.haras     },
    { id: 'hospitals', label: 'PCI Hospitals',            count: '26',     color: 'var(--hosp)', on: layerState.hospitals  },
    { id: 'towers',    label: 'Unreachable Population',   count: 'Zone X', color: 'var(--zx)',   on: layerState.towers    },
    { id: 'arcs',      label: 'Access Corridors',         count: '—',      color: 'var(--zx)',   on: layerState.arcs,  countId: 'arc-count' },
  ];

  el.innerHTML = `
    <div class="panel-label">Data Layers</div>
    ${layers.map((l) => `
      <div class="toggle-row" data-layer="${l.id}" role="button" tabindex="0" aria-pressed="${l.on}">
        <div class="toggle-pill${l.on ? ' on' : ''}" id="toggle-${l.id}"><div class="toggle-thumb"></div></div>
        <div class="toggle-dot" style="background:${l.color}"></div>
        <span class="toggle-label">${l.label}</span>
        <span class="toggle-count" ${l.countId ? `id="${l.countId}"` : ''}>${l.count}</span>
      </div>
    `).join('')}
  `;

  el.querySelectorAll('.toggle-row').forEach((row) => {
    const handler = () => onToggle(row.dataset.layer);
    row.addEventListener('click',   handler);
    row.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') handler(); });
  });
}

/**
 * Update toggle pill visual state (called when layerState changes externally).
 *
 * @param {string} layerId
 * @param {boolean} on
 */
export function updateToggle(layerId, on) {
  const pill = document.getElementById(`toggle-${layerId}`);
  if (pill) pill.classList.toggle('on', on);
}

/**
 * Render the zone classification legend.
 *
 * @param {string} containerId
 */
export function renderZoneLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="panel-label">Zone Classification</div>
    <div class="zone-legend">
      <div class="zone-legend-row">
        <div class="zone-swatch" style="background:var(--z1)"></div>
        <span class="zone-legend-label">Zone 1</span>
        <span class="zone-legend-desc">60 min drive</span>
      </div>
      <div class="zone-legend-row">
        <div class="zone-swatch" style="background:var(--z2)"></div>
        <span class="zone-legend-label">Zone 2</span>
        <span class="zone-legend-desc">60-120 min</span>
      </div>
      <div class="zone-legend-row">
        <div class="zone-swatch" style="background:var(--zx)"></div>
        <span class="zone-legend-label">Zone X</span>
        <span class="zone-legend-desc">&gt;120 min / unreachable</span>
      </div>
    </div>
  `;
}
