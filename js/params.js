// Input parameters — the user-facing knobs. Every value is in inches (angles in degrees).
// `cradle_length` defaults to tube_OD at load time (see main.js) per the spec.

// Display order of the parameter groups (subheadings in the UI).
export const PARAM_GROUPS = ['Optical tube', 'Altitude bearing', 'Balance & clearance', 'Joinery', 'Fit & tolerances'];

export const PARAM_DEFS = [
  // Optical tube
  { key: 'tube_OD',          group: 'Optical tube', label: 'Tube outside dia',   min: 4,   max: 30,  step: 0.25, value: 10,    unit: 'in' },
  { key: 'tube_length',      group: 'Optical tube', label: 'Tube length (L)',    min: 18,  max: 96,  step: 0.5,  value: 48,    unit: 'in' },
  { key: 'plywood_thickness',group: 'Optical tube', label: 'Plywood thickness',  min: 0.25,max: 1,   step: 0.25, value: 0.5,   unit: 'in' },
  { key: 'base_thickness',   group: 'Optical tube', label: 'Rocker base thickness', min: 0.25,max: 1, step: 0.25, value: 0.5, unit: 'in' },
  { key: 'ground_thickness', group: 'Optical tube', label: 'Ground board thickness',min: 0.25,max: 1, step: 0.25, value: 0.5, unit: 'in' },
  // Altitude bearing
  { key: 'bearing_diameter', group: 'Altitude bearing', label: 'Altitude bearing dia',min: 4,  max: 30,  step: 0.25, value: 16,    unit: 'in' },
  { key: 'bearing_width',    group: 'Altitude bearing', label: 'Bearing width',      min: 0.5, max: 4,   step: 0.25, value: 1,     unit: 'in' },
  { key: 'bolt_circle_radius',group: 'Altitude bearing',label: 'Bolt circle radius',min: 0.5, max: 6,   step: 0.125,value: 3,     unit: 'in' },
  { key: 'pad_angle',        group: 'Altitude bearing', label: 'Pad half-angle θ',   min: 15,  max: 55,  step: 1,    value: 35,    unit: 'deg' },
  // Balance & clearance
  { key: 'balance_point',    group: 'Balance & clearance', label: 'Balance point',      min: 25,  max: 60,  step: 1,    value: 42,    unit: '% from mirror' },
  { key: 'clearance_margin', group: 'Balance & clearance', label: 'Clearance margin',   min: 0,   max: 6,   step: 0.25, value: 2,     unit: 'in' },
  { key: 'cradle_length',    group: 'Balance & clearance', label: 'Cradle length',      min: 4,   max: 30,  step: 0.25, value: 10,    unit: 'in' },
  // Joinery
  { key: 'finger_count',     group: 'Joinery', label: 'Box-joint fingers',  min: 3,   max: 11,  step: 2,    value: 5,     unit: 'per edge' },
  { key: 'corner_size',      group: 'Joinery', label: 'Top corner size',    min: 0.125, max: 3, step: 0.125, value: 0.5,   unit: 'in' },
  // Fit & tolerances
  { key: 'rocker_edge_margin',  group: 'Fit & tolerances', label: 'Rocker edge margin',  min: 0.5, max: 5,  step: 0.125, value: 2,     unit: 'in' },
  { key: 'cradle_tolerance',    group: 'Fit & tolerances', label: 'Cradle fit gap',      min: 0,   max: 0.5,step: 0.0625,value: 0.125, unit: 'in' },
  { key: 'bearing_pad_clearance',group: 'Fit & tolerances',label: 'Bearing saddle gap', min: 0,   max: 0.5,step: 0.02,  value: 0.12,  unit: 'in' },
];

// Discrete (non-slider) choices, rendered as selects within their group.
export const CHOICE_DEFS = [
  { key: 'joint_type', group: 'Joinery', label: 'Corner joints', value: 'box', options: ['box', 'butt'] },
  { key: 'corner_style', group: 'Joinery', label: 'Top corner style', value: 'fillet', options: ['off', 'chamfer', 'fillet'] },
];

// Verbose hover help, keyed by control id (params, choices, pose, panels). Shown as a
// native floating tooltip on the control's label.
export const HELP = {
  // Optical tube
  tube_OD: 'Outside diameter of the telescope tube (sonotube). Sets the cradle size, and with plywood thickness the spacing of the two altitude bearings.',
  tube_length: 'Overall length of the optical tube. Combined with the balance point, this sets how tall the rocker sides must be.',
  plywood_thickness: 'Sheet thickness for the cradle walls and the rocker side/front panels. Box-joint fingers and tabs are sized to the mating panel thickness.',
  base_thickness: 'Sheet thickness for the round rocker base (bottom disk), set independently of the walls. The side/front tabs pass fully through it.',
  ground_thickness: 'Sheet thickness for the ground board, set independently of the rest of the structure.',
  // Altitude bearing
  bearing_diameter: 'Diameter of the round altitude bearings that ride in the rocker saddles. Sets the saddle radius and the derived rocker side width.',
  bearing_width: 'Axial width of each altitude bearing — also the contact width of the Teflon pads it rides on.',
  bolt_circle_radius: 'Radius of the 4-bolt diamond pattern that fastens each bearing to the cradle. One value drives both the bearing and the matching cradle holes.',
  pad_angle: 'Angle of each Teflon pad from vertical (default 35°, i.e. 70° apart). The bearing rests in the saddle on these two pads.',
  // Balance & clearance
  balance_point: 'Fore-aft balance point as a percent from the mirror end. Sets where the altitude axis sits (and thus rocker height). In practice you slide the tube in the cradle to balance here.',
  clearance_margin: 'Gap kept between the mirror end of the tube and the rocker floor when the scope points at the zenith.',
  cradle_length: 'Length of the tube cradle along the tube axis. Longer grips the tube more firmly, but must leave room to slide for balancing.',
  // Joinery
  joint_type: 'Box = interlocking finger joints at the corners (CNC-friendly). Butt = plain square edges joined with screws (common shop tools).',
  finger_count: 'Number of fingers per edge on the box (finger) joints. Odd counts keep both ends of each edge solid.',
  corner_style: 'Treatment for the exposed top corners of the rocker sides: off (sharp 90°), chamfer (45° cut), or fillet (rounded).',
  corner_size: 'Size of the chamfer or fillet applied to the rocker side top corners. Automatically clamped where the front board or saddle leaves little room.',
  // Fit & tolerances
  rocker_edge_margin: 'Solid wood left beyond each end of the bearing saddle on the rocker sides — sets how far the side panel extends fore-and-aft.',
  cradle_tolerance: 'Side-to-side fit gap between the cradle and the rocker interior, so the cradle swings freely.',
  bearing_pad_clearance: 'Gap between the bearing rim and the wood saddle arc. The Teflon pads bridge this gap; the bearing never touches the wood.',
  // Pose
  alt: 'Tilt the optical tube assembly in altitude (0° = horizon, 90° = zenith) to inspect clearance through the full swing.',
  az: 'Rotate the rocker box on the ground board in azimuth.',
  // Panels
  visibility: 'Show or hide each group of parts to inspect the assembly.',
  display: 'Give each plywood part a distinct color (and re-roll the palette) to make the interlocking joints easy to read.',
  export: 'Download one DXF outline per plywood part, bundled in a zip. Units are inches; outlines include joints, slots and holes.',
};

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
