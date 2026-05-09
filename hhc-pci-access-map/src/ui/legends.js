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

/**
 * Render the catchment mode legend.
 *
 * @param {string} containerId
 */
export function renderCatchmentLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="panel-label">Hospital Catchments</div>
    <div class="zone-legend">
      <div class="zone-legend-row">
        <div class="zone-swatch" style="background:var(--hosp)"></div>
        <span class="zone-legend-label">Colour</span>
        <span class="zone-legend-desc">per nearest PCI hospital</span>
      </div>
    </div>
  `;
}

/**
 * Render the priority mode legend.
 *
 * @param {string} containerId
 */
export function renderPriorityLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="panel-label">Access Burden (person-hrs)</div>
    <div class="zone-legend">
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#3a5a90"></div><span class="zone-legend-desc">Low (&lt;500)</span></div>
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#d4a017"></div><span class="zone-legend-desc">Medium (500-5K)</span></div>
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#ff6b3e"></div><span class="zone-legend-desc">High (5K-20K)</span></div>
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#ff1e3c"></div><span class="zone-legend-desc">Critical (&gt;20K)</span></div>
    </div>
  `;
}

/**
 * Render the placement mode legend.
 *
 * @param {string} containerId
 */
export function renderPlacementLegend(containerId) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="panel-label">Placement Analysis</div>
    <div class="zone-legend">
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#00e5b4"></div><span class="zone-legend-desc">Rescued (Zone X → Zone 1/2)</span></div>
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#ff1e3c"></div><span class="zone-legend-desc">Still unreachable (Zone X)</span></div>
      <div class="zone-legend-row"><div class="zone-swatch" style="background:#9d4edd"></div><span class="zone-legend-desc">Proposed site marker</span></div>
    </div>
  `;
}

/**
 * Render the data-layers toggle panel using pill-style toggles.
 * Layers that start ON are rendered with the .on class on the pill.
 * main.js wires click listeners and updates pill state on toggle.
 *
 * @param {string} containerId
 * @param {{ haras: boolean, hospitals: boolean, towers: boolean, arcs: boolean }} [initialState]
 */
export function renderTogglePanel(containerId, initialState = { haras: true, hospitals: true, towers: false, arcs: false }) {
  const el = document.getElementById(containerId);
  if (!el) return;

  const layers = [
    { id: 'haras',     label: 'Neighborhood Boundaries', count: '21,943', color: 'var(--z1)'   },
    { id: 'hospitals', label: 'PCI Hospitals',            count: '26',     color: 'var(--hosp)' },
    { id: 'towers',    label: 'Unreachable Population',   count: 'Zone X', color: 'var(--zx)'   },
    { id: 'arcs',      label: 'Access Corridors',         count: null,     color: 'var(--zx)', countId: 'arc-count' },
  ];

  el.innerHTML = `
    <div class="panel-label">Data Layers</div>
    ${layers.map((l) => {
      const on = initialState[l.id] ?? false;
      const countHTML = l.countId
        ? `<span class="toggle-count" id="${l.countId}">Zone X</span>`
        : `<span class="toggle-count">${l.count}</span>`;
      return `
        <div class="toggle-row" data-layer="${l.id}" role="button" tabindex="0" aria-pressed="${on}">
          <div class="toggle-pill${on ? ' on' : ''}" id="toggle-${l.id}"><div class="toggle-thumb"></div></div>
          <div class="toggle-dot" style="background:${l.color}"></div>
          <span class="toggle-label">${l.label}</span>
          ${countHTML}
        </div>
      `;
    }).join('')}
  `;
}
