// DOM chrome: toolbar, scene chips, inspector panel, help dialog.

import { labelOf } from './objects.js';
import { wavelengthToRGB } from './optics.js';
import { cssColor } from './render.js';
import { SCENES } from './scenes.js';
import { helpSeen, markHelpSeen } from './storage.js';

const ICONS = {
  laser: '<rect x="3" y="9" width="11" height="6" rx="2"/><path d="M16.5 12H21"/>',
  mirror: '<path d="M6 19 18 5"/><path d="M10 18l-2 2M14 14l-2 2M18 10l-2 2"/>',
  prism: '<path d="M12 4l8 15H4Z"/>',
  convex: '<path d="M12 3c4.5 4.5 4.5 13.5 0 18-4.5-4.5-4.5-13.5 0-18Z"/>',
  concave: '<path d="M8 4c2.5 5 2.5 11 0 16M16 4c-2.5 5-2.5 11 0 16M7 4h10M7 20h10"/>',
  wall: '<rect x="4" y="9" width="16" height="6" rx="1.5"/><path d="M9.5 9v6M14.5 9v6"/>',
  filter: '<rect x="9.5" y="4" width="5" height="16" rx="2"/>',
};

const TOOLS = [
  { icon: 'laser', label: 'Laser', aria: 'Ajouter un laser', type: 'laser' },
  { icon: 'mirror', label: 'Miroir', aria: 'Ajouter un miroir', type: 'mirror' },
  { icon: 'prism', label: 'Prisme', aria: 'Ajouter un prisme', type: 'prism' },
  {
    icon: 'convex',
    label: 'Lentille +',
    aria: 'Ajouter une lentille convergente',
    type: 'lens',
    extra: { kind: 'convex' },
  },
  {
    icon: 'concave',
    label: 'Lentille −',
    aria: 'Ajouter une lentille divergente',
    type: 'lens',
    extra: { kind: 'concave' },
  },
  { icon: 'wall', label: 'Mur', aria: 'Ajouter un mur', type: 'wall' },
  { icon: 'filter', label: 'Filtre', aria: 'Ajouter un filtre coloré', type: 'filter' },
];

function svg(iconKey) {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" ' +
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
    ICONS[iconKey] +
    '</svg>'
  );
}

export function initUI(app) {
  const { state } = app;

  // Toolbar
  const toolbar = document.getElementById('toolbar');
  for (const tool of TOOLS) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', tool.aria);
    btn.innerHTML = `${svg(tool.icon)}<span>${tool.label}</span>`;
    btn.addEventListener('click', () => app.addObject(tool.type, tool.extra));
    toolbar.append(btn);
  }

  // Scene chips
  const nav = document.querySelector('.scenes');
  for (const scene of SCENES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = scene.name;
    btn.addEventListener('click', () => app.loadSceneById(scene.id));
    nav.append(btn);
  }

  document.getElementById('reset').addEventListener('click', () => app.resetScene());

  // Help dialog
  const help = document.getElementById('help');
  document.getElementById('help-btn').addEventListener('click', () => help.showModal());
  help.addEventListener('close', markHelpSeen);
  if (!helpSeen()) help.showModal();

  // Inspector
  const inspector = document.getElementById('inspector');
  const title = document.getElementById('inspector-title');
  const colorRow = document.getElementById('color-row');
  const whiteBtn = document.getElementById('white-btn');
  const slider = document.getElementById('lambda-slider');
  const valueOut = document.getElementById('lambda-value');
  const dot = document.getElementById('lambda-dot');

  function selectedObj() {
    return state.objects.find((o) => o.id === state.selectedId);
  }

  function syncColorControls(obj) {
    const isWhite = obj.type === 'laser' && obj.lambda == null;
    whiteBtn.hidden = obj.type !== 'laser';
    whiteBtn.setAttribute('aria-pressed', String(isWhite));
    slider.disabled = isWhite;
    slider.value = String(obj.lambda ?? 560);
    valueOut.textContent = isWhite ? '—' : `${slider.value} nm`;
    dot.style.background = isWhite ? '#ffffff' : cssColor(wavelengthToRGB(Number(slider.value)));
  }

  whiteBtn.addEventListener('click', () => {
    const obj = selectedObj();
    if (!obj || obj.type !== 'laser') return;
    obj.lambda = obj.lambda == null ? Number(slider.value) : null;
    syncColorControls(obj);
    app.changed();
  });

  slider.addEventListener('input', () => {
    const obj = selectedObj();
    if (!obj) return;
    obj.lambda = Number(slider.value);
    syncColorControls(obj);
    app.changed();
  });

  document
    .getElementById('rot-ccw')
    .addEventListener('click', () => app.rotateSelected(-Math.PI / 12));
  document
    .getElementById('rot-cw')
    .addEventListener('click', () => app.rotateSelected(Math.PI / 12));
  document.getElementById('delete-btn').addEventListener('click', () => app.deleteSelected());

  function onSelection() {
    const obj = selectedObj();
    if (!obj) {
      // Hiding the panel while focus is inside would drop focus to <body>.
      if (inspector.contains(document.activeElement)) {
        app.canvas.focus({ preventScroll: true });
      }
      inspector.hidden = true;
      return;
    }
    inspector.hidden = false;
    title.textContent = labelOf(obj);
    const hasColor = obj.type === 'laser' || obj.type === 'filter';
    colorRow.hidden = !hasColor;
    if (hasColor) syncColorControls(obj);
  }

  return { onSelection };
}
