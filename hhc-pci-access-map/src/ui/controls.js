/**
 * controls.js — view-mode button grid and zoom controls wiring
 */

const MODES = [
  { id: 'zone',      label: 'ZONE',      activeColor: 'var(--z1)',  activeAlpha: 'var(--z1)22'    },
  { id: 'catchment', label: 'CATCHMENT', activeColor: 'var(--hosp)', activeAlpha: '#0077ff22'     },
  { id: 'priority',  label: 'PRIORITY',  activeColor: '#ff1e3c',    activeAlpha: '#ff1e3c22'      },
  { id: 'placement', label: 'PLACEMENT', activeColor: '#9d4edd',    activeAlpha: '#9d4edd22'      },
];

/**
 * Render the view-mode button grid.
 *
 * @param {string} containerId
 * @param {string} currentMode
 * @param {(mode: string) => void} onSelect
 */
export function renderViewModeSection(containerId, currentMode, onSelect) {
  const el = document.getElementById(containerId);
  if (!el) return;

  el.innerHTML = `
    <div class="panel-label" style="margin-bottom:8px">View Mode</div>
    <div class="viewmode-grid">
      ${MODES.map((m) => `
        <button
          class="viewmode-btn"
          id="btn-${m.id}"
          data-mode="${m.id}"
          style="${m.id === currentMode ? `background:${m.activeAlpha};border-color:${m.activeColor};color:${m.activeColor}` : ''}"
        >${m.label}</button>
      `).join('')}
    </div>
  `;

  el.querySelectorAll('.viewmode-btn').forEach((btn) => {
    btn.addEventListener('click', () => onSelect(btn.dataset.mode));
  });
}

/**
 * Update which view-mode button appears active.
 *
 * @param {string} activeMode
 */
export function updateViewModeButtons(activeMode) {
  MODES.forEach((m) => {
    const btn = document.getElementById(`btn-${m.id}`);
    if (!btn) return;
    if (m.id === activeMode) {
      btn.style.background    = m.activeAlpha;
      btn.style.borderColor   = m.activeColor;
      btn.style.color         = m.activeColor;
    } else {
      btn.style.background    = 'transparent';
      btn.style.borderColor   = 'var(--border)';
      btn.style.color         = 'var(--muted)';
    }
  });
}

/**
 * Wire zoom in/out buttons to the map.
 *
 * @param {maplibregl.Map} map
 */
export function wireZoomControls(map) {
  document.getElementById('btn-zoom-in')?.addEventListener('click',  () => map.zoomIn());
  document.getElementById('btn-zoom-out')?.addEventListener('click', () => map.zoomOut());
}

/**
 * Wire the dossier close button.
 *
 * @param {() => void} onClose
 */
export function wireDossierClose(onClose) {
  document.getElementById('dossier-close')?.addEventListener('click', onClose);
}
