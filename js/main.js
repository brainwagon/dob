// UI wiring: build sliders from PARAM_DEFS, rebuild the model on change, show derived
// dimensions + warnings, and drive the altitude/azimuth sliders.

import { PARAM_DEFS, CHOICE_DEFS, PARAM_GROUPS, HELP, defaultParams } from './params.js';
import { buildModel } from './geometry.js';
import { Viewer } from './viewer.js';
import { partToDXF } from './dxf.js';
import { zipStore } from './zip.js';

const STORE_KEY = 'dob-designer-state';

// Restore the last session: defaults overlaid with whatever was saved. Unknown/new
// keys fall back to defaults, so adding parameters later won't break old saved state.
const VIS_GROUPS = [
  { key: 'cradle', label: 'Cradle' }, { key: 'bearings', label: 'Bearings' },
  { key: 'tube', label: 'Tube' }, { key: 'rocker', label: 'Rocker walls' },
  { key: 'rockerbase', label: 'Rocker base' },
  { key: 'ground', label: 'Ground board' }, { key: 'markers', label: 'Pads & markers' },
];

function loadState() {
  const params = defaultParams();
  const pose = { alt: 45, az: 0 };
  const vis = Object.fromEntries(VIS_GROUPS.map(g => [g.key, true]));
  const display = { colorMode: false };
  try {
    const saved = JSON.parse(localStorage.getItem(STORE_KEY) || '{}');
    for (const def of PARAM_DEFS)
      if (typeof saved.params?.[def.key] === 'number') params[def.key] = saved.params[def.key];
    for (const def of CHOICE_DEFS)
      if (def.options.includes(saved.params?.[def.key])) params[def.key] = saved.params[def.key];
    if (typeof saved.pose?.alt === 'number') pose.alt = saved.pose.alt;
    if (typeof saved.pose?.az === 'number') pose.az = saved.pose.az;
    for (const g of VIS_GROUPS)
      if (typeof saved.vis?.[g.key] === 'boolean') vis[g.key] = saved.vis[g.key];
    if (typeof saved.display?.colorMode === 'boolean') display.colorMode = saved.display.colorMode;
  } catch { /* corrupt storage — fall back to defaults */ }
  return { params, pose, vis, display };
}

function saveState() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify({ params, pose: { alt: +altSlider.value, az: +azSlider.value }, vis, display })); }
  catch { /* storage unavailable (private mode / quota) — ignore */ }
}

const { params, pose, vis, display } = loadState();
const viewer = new Viewer(document.getElementById('view'));
viewer.visibility = { ...vis };   // applied as meshes are (re)built
viewer.colorMode = display.colorMode;

const controls = document.getElementById('controls');
const derived = document.getElementById('derived');
const warnings = document.getElementById('warnings');

function row(label, value) {
  return `<div class="d-row"><span>${label}</span><span>${value}</span></div>`;
}

let currentModel = null;

function rebuild() {
  const model = buildModel(params);
  currentModel = model;
  viewer.setModel(model);
  viewer.setAltitude(+altSlider.value);
  viewer.setAzimuth(+azSlider.value);

  const d = model.dims;
  derived.innerHTML =
    row('Rocker side height', d.Hside.toFixed(2) + '"') +
    row('Altitude axis height', d.axisHeight.toFixed(2) + '"') +
    row('Front board height', d.frontH.toFixed(2) + '"') +
    row('Cradle outer', d.cradleOuter.toFixed(2) + '"') +
    row('Bearing separation', d.bearingSep.toFixed(2) + '"') +
    row('Rocker depth', d.rockerDepth.toFixed(2) + '"') +
    row('Ground radius', d.groundRadius.toFixed(2) + '"') +
    row('Min swing clearance', (d.minClearance <= 0 ? 'contact' : d.minClearance.toFixed(2) + '"') + ' @ ' + d.minClearanceAngle + '°');

  warnings.innerHTML = model.warnings.length
    ? model.warnings.map(w => `<div class="warn">⚠ ${w}</div>`).join('')
    : `<div class="ok">✓ No geometry warnings</div>`;
}

// export: one DXF per plywood part, bundled into a zip
const exportBox = document.getElementById('export');
exportBox.innerHTML = `<button>Download DXF (.zip)</button><div class="note"></div>`;
const exportBtn = exportBox.querySelector('button');
const exportNote = exportBox.querySelector('.note');
exportBtn.addEventListener('click', () => {
  const plywood = currentModel.parts.filter(p => p.kind === 'plywood');
  const files = plywood.map(p => ({ name: `${p.id}.dxf`, data: partToDXF(p) }));
  const blob = new Blob([zipStore(files)], { type: 'application/zip' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'dobsonian-parts.zip'; a.click();
  URL.revokeObjectURL(url);
  exportNote.textContent = `${files.length} parts exported (inches, DXF R12).`;
});

// display controls: distinct part colors + randomize
const displayBox = document.getElementById('display');
displayBox.innerHTML = `<label><input type="checkbox" ${display.colorMode ? 'checked' : ''}> Distinct part colors</label><button>Randomize</button>`;
const colorCb = displayBox.querySelector('input');
const randBtn = displayBox.querySelector('button');
colorCb.addEventListener('change', () => { display.colorMode = colorCb.checked; viewer.setColorMode(colorCb.checked); saveState(); });
randBtn.addEventListener('click', () => { viewer.randomizeColors(); display.colorMode = true; colorCb.checked = true; saveState(); });

// visibility checkboxes
const visBox = document.getElementById('visibility');
visBox.className = 'vis';
for (const g of VIS_GROUPS) {
  const label = document.createElement('label');
  label.innerHTML = `<input type="checkbox" ${vis[g.key] ? 'checked' : ''}> ${g.label}`;
  const cb = label.querySelector('input');
  cb.addEventListener('change', () => { vis[g.key] = cb.checked; viewer.setGroupVisible(g.key, cb.checked); saveState(); });
  visBox.appendChild(label);
}

// parameter controls, rendered under group subheadings in PARAM_GROUPS order.
function renderChoice(def) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  wrap.innerHTML = `<label>${def.label}</label>
    <select>${def.options.map(o => `<option ${o === params[def.key] ? 'selected' : ''}>${o}</option>`).join('')}</select>`;
  if (HELP[def.key]) wrap.querySelector('label').title = HELP[def.key];
  const sel = wrap.querySelector('select');
  sel.addEventListener('change', () => { params[def.key] = sel.value; rebuild(); saveState(); });
  controls.appendChild(wrap);
}
function renderSlider(def) {
  const wrap = document.createElement('div');
  wrap.className = 'ctl';
  wrap.innerHTML = `<label>${def.label} <output></output></label>
    <input type="range" min="${def.min}" max="${def.max}" step="${def.step}" value="${params[def.key]}">`;
  if (HELP[def.key]) wrap.querySelector('label').title = HELP[def.key];
  const input = wrap.querySelector('input'), out = wrap.querySelector('output');
  const sync = () => { out.textContent = `${params[def.key]} ${def.unit}`; };
  input.addEventListener('input', () => { params[def.key] = +input.value; sync(); rebuild(); saveState(); });
  sync();
  controls.appendChild(wrap);
}
for (const group of PARAM_GROUPS) {
  const choices = CHOICE_DEFS.filter(d => d.group === group);
  const sliders = PARAM_DEFS.filter(d => d.group === group);
  if (!choices.length && !sliders.length) continue;
  const h = document.createElement('div');
  h.className = 'group-head';
  h.textContent = group;
  controls.appendChild(h);
  choices.forEach(renderChoice);
  sliders.forEach(renderSlider);
}

// pose sliders (restored from saved state)
const altSlider = document.getElementById('alt');
const azSlider = document.getElementById('az');
const altOut = document.getElementById('altOut');
const azOut = document.getElementById('azOut');
altSlider.value = pose.alt; azSlider.value = pose.az;
altOut.textContent = pose.alt + '°'; azOut.textContent = pose.az + '°';
viewer.setAltitude(pose.alt); viewer.setAzimuth(pose.az);
altSlider.addEventListener('input', () => { altOut.textContent = altSlider.value + '°'; viewer.setAltitude(+altSlider.value); saveState(); });
azSlider.addEventListener('input', () => { azOut.textContent = azSlider.value + '°'; viewer.setAzimuth(+azSlider.value); saveState(); });

// pose preset buttons (the three interference check poses)
for (const b of document.querySelectorAll('[data-alt]')) {
  b.addEventListener('click', () => { altSlider.value = b.dataset.alt; altOut.textContent = b.dataset.alt + '°'; viewer.setAltitude(+b.dataset.alt); saveState(); });
}

// hover help for the static pose labels and panel section headings
altOut.closest('label').title = HELP.alt;
azOut.closest('label').title = HELP.az;
for (const id of ['visibility', 'display', 'export']) {
  const h = document.getElementById(id).previousElementSibling;
  if (h && HELP[id]) h.title = HELP[id];
}

rebuild();
