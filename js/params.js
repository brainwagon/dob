// Input parameters — the user-facing knobs. Every value is in inches (angles in degrees).
// `cradle_length` defaults to tube_OD at load time (see main.js) per the spec.

export const PARAM_DEFS = [
  { key: 'tube_OD',          label: 'Tube outside dia',   min: 4,   max: 30,  step: 0.25, value: 10,    unit: 'in' },
  { key: 'tube_length',      label: 'Tube length (L)',    min: 18,  max: 96,  step: 0.5,  value: 48,    unit: 'in' },
  { key: 'plywood_thickness',label: 'Plywood thickness',  min: 0.25,max: 1,   step: 0.25, value: 0.5,   unit: 'in' },
  { key: 'bearing_diameter', label: 'Altitude bearing dia',min: 4,  max: 30,  step: 0.25, value: 16,    unit: 'in' },
  { key: 'balance_point',    label: 'Balance point',      min: 25,  max: 60,  step: 1,    value: 42,    unit: '% from mirror' },
  { key: 'pad_angle',        label: 'Pad half-angle θ',   min: 15,  max: 55,  step: 1,    value: 35,    unit: 'deg' },
  { key: 'clearance_margin', label: 'Clearance margin',   min: 0,   max: 6,   step: 0.25, value: 2,     unit: 'in' },
  { key: 'cradle_length',    label: 'Cradle length',      min: 4,   max: 30,  step: 0.25, value: 10,    unit: 'in' },
  { key: 'bearing_width',    label: 'Bearing width',      min: 0.5, max: 4,   step: 0.25, value: 1,     unit: 'in' },
  { key: 'bolt_circle_radius',label: 'Bolt circle radius',min: 0.5, max: 6,   step: 0.125,value: 3,     unit: 'in' },
  { key: 'finger_count',     label: 'Box-joint fingers',  min: 3,   max: 11,  step: 2,    value: 5,     unit: 'per edge' },
  { key: 'rocker_edge_margin',  label: 'Rocker edge margin',  min: 0.5, max: 5,  step: 0.125, value: 2,     unit: 'in' },
  { key: 'cradle_tolerance',    label: 'Cradle fit gap',      min: 0,   max: 0.5,step: 0.0625,value: 0.125, unit: 'in' },
  { key: 'bearing_pad_clearance',label: 'Bearing saddle gap', min: 0,   max: 0.5,step: 0.02,  value: 0.12,  unit: 'in' },
];

// Discrete (non-slider) choices, rendered as selects.
export const CHOICE_DEFS = [
  { key: 'joint_type', label: 'Corner joints', value: 'box', options: ['box', 'butt'] },
];

// Non-slider constants (fixed defaults from the spec / flagged underspecified items).
export const CONSTANTS = {
  bolt_clearance: 0.266,   // 1/4" bolt clearance hole
  pivot_hole: 0.3125,      // 5/16" azimuth pivot
  pad_thickness: 0.25,     // teflon pad height (azimuth)                  [FLAGGED default]
  foot_radius: 0.75,       // ground-board foot radius
  foot_height: 1.0,
  tab_count: 5,            // odd → flush ends; tabs along each side/front bottom edge into the disk
};

export function defaultParams() {
  const p = {};
  for (const d of PARAM_DEFS) p[d.key] = d.value;
  for (const c of CHOICE_DEFS) p[c.key] = c.value;
  p.cradle_length = p.tube_OD; // spec default: cradle axial length = tube OD
  return p;
}
