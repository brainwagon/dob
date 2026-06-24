// Geometry engine — the single source of truth.
//
// Every plywood part is PRISMATIC: a 2D `profile` polygon (with circular `holes`)
// extruded by a constant `thickness`, then placed with `position` + `rotation` (XYZ
// Euler radians). The same record feeds the 3D viewer (extrude), the flat preview
// (draw the profile) and later the DXF writer (emit the profile). Bearings are
// cylinder primitives (placeholder, per spec). Nothing here is a true 3D solid —
// that's the load-bearing assumption; if it ever breaks, revisit the kernel decision.
//
// World frame:  X = altitude-bearing axis (left-right),  Y = up,  Z = fore-aft (tube axis at horizon).
// Frames: 'ground' (fixed), 'az' (rotates about Y for azimuth), 'ota' (the swinging tube assembly).

import { CONSTANTS } from './params.js';
import { checkInterference } from './interference.js';
import { crenellate, dedupe, cradleXWall, cradleYWall, tabRanges, sideSlots, frontSlots } from './joinery.js';

const deg = Math.PI / 180;

// ---- profile helpers ---------------------------------------------------------
function rect(w, h) {
  const x = w / 2, y = h / 2;
  return [[-x, -y], [x, -y], [x, y], [-x, y]];
}
function circle(r, seg = 64) {
  const pts = [];
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  return pts;
}

// Replace a sharp convex corner at C with a chamfer or fillet, staying in the outline.
// dirIn = unit travel direction arriving at C; dirOut = unit travel direction leaving C.
// For a 90° corner the tangent points sit `size` back along each edge. Returns the points
// to emit in place of C (just [C] when style is 'off').
function treatCorner(C, dirIn, dirOut, style, size) {
  if (style === 'off' || size <= 0) return [C];
  const T1 = [C[0] - dirIn[0] * size, C[1] - dirIn[1] * size];
  const T2 = [C[0] + dirOut[0] * size, C[1] + dirOut[1] * size];
  if (style === 'chamfer') return [T1, T2];
  // fillet: quarter arc of radius `size`, centre offset into the interior (left of travel).
  const n = [-dirIn[1], dirIn[0]];                 // CCW interior normal
  const O = [T1[0] + n[0] * size, T1[1] + n[1] * size];
  let a1 = Math.atan2(T1[1] - O[1], T1[0] - O[0]);
  let a2 = Math.atan2(T2[1] - O[1], T2[0] - O[0]);
  let d = a2 - a1; while (d <= 0) d += Math.PI * 2; // CCW sweep (= +90° here)
  const seg = 8, out = [T1];
  for (let i = 1; i < seg; i++) { const a = a1 + d * (i / seg); out.push([O[0] + size * Math.cos(a), O[1] + size * Math.sin(a)]); }
  out.push(T2);
  return out;
}

// Rocker side board: a W×H rectangle with a circular saddle (radius Rcut = Rb+clr)
// bitten out of the top edge so the round bearing nests in; the Teflon pads bridge
// the `clr` gap at ±θ. The arc is part of the OUTLINE, so it flows to the DXF.
// Profile local frame: x = fore-aft (board width), y = up; board centered on origin.
// W = fore-aft (local x, → worldZ), H = height (local y, → worldY). The LEFT edge
// (local x = −W/2) is the rocker FRONT; `frontFinger` cuts box-joint notches into it over
// the lower `frontH` (where the front board overlaps), straight above. `tab` adds disk
// tabs to the bottom edge.
function rockerSideProfile(W, H, Rb, theta, clr, warnings, tab, frontFinger, frontH, corner) {
  const Cy = H / 2 + Rb * Math.cos(theta);   // arc centre = altitude axis, above the top edge
  const Rcut = Rb + clr;
  let xi = Math.sqrt(Math.max(0, Rcut * Rcut - Math.pow(Rb * Math.cos(theta), 2)));
  if (xi >= W / 2) { warnings.push('Altitude bearing wider than rocker side — saddle clipped.'); xi = W * 0.49; }
  // Top-corner treatment, clamped per corner. Horizontal room is the top run beside the
  // saddle (both corners). Vertical room differs: the right (back) edge is full-height; the
  // left (front) edge can only be treated above where the front board / its fingers begin.
  const cStyle = corner ? corner.style : 'off';
  const reqSize = corner ? corner.size : 0;
  const topRun = W / 2 - xi;
  const yTop = frontFinger && frontH > 0 ? -H / 2 + frontH : -H / 2;
  const sizeR = Math.min(reqSize, topRun, H / 2);
  const sizeL = Math.min(reqSize, topRun, H / 2 - yTop);
  if (cStyle !== 'off' && (sizeR < reqSize || sizeL < reqSize))
    warnings.push(`Top corner size clamped to ${Math.min(sizeR, sizeL).toFixed(2)}".`);
  // bottom edge: tabs into the disk (if requested), else straight
  const bottom = tab
    ? crenellate([-W / 2, -H / 2], [W / 2, -H / 2], [0, 1], tab.count, tab.phase, tab.depth, 'tab')
    : [[-W / 2, -H / 2], [W / 2, -H / 2]];
  // top-right corner: arrive going +Y (right edge), leave going −X (top edge)
  const topR = treatCorner([W / 2, H / 2], [0, 1], [-1, 0], cStyle, sizeR);
  const pts = [...bottom, ...topR, [xi, H / 2]];
  const aR = Math.atan2(H / 2 - Cy, xi);     // right intersection angle (4th quadrant)
  const aL = Math.atan2(H / 2 - Cy, -xi);    // left intersection angle  (3rd quadrant)
  const seg = 48;                            // sweep aR → aL passing through the bottom (-π/2)
  for (let i = 1; i < seg; i++) {
    const a = aR + (aL - aR) * (i / seg);
    pts.push([Rcut * Math.cos(a), Cy + Rcut * Math.sin(a)]);
  }
  // top-left corner: arrive going −X (top edge), leave going −Y (left/front edge)
  pts.push([-xi, H / 2], ...treatCorner([-W / 2, H / 2], [-1, 0], [0, -1], cStyle, sizeL));
  // left (front) edge, descending: straight to the front-board top, then notched to the floor
  if (frontFinger && frontH > 0) {
    pts.push([-W / 2, yTop]);
    const fe = crenellate([-W / 2, -H / 2], [-W / 2, yTop], [1, 0], frontFinger.count, frontFinger.phase, frontFinger.depth, 'box');
    fe.reverse();                            // generated from worldY=0; traverse top→bottom
    pts.push(...fe);
  }
  return dedupe(pts);
}

// ---- §4 derived dimensions ---------------------------------------------------
export function deriveDimensions(p) {
  const D = p.tube_OD;
  const t = p.plywood_thickness;
  const L = p.tube_length;
  const Rb = p.bearing_diameter / 2;
  const theta = p.pad_angle * deg;
  const margin = p.clearance_margin;
  const pf = p.balance_point / 100;          // fraction from mirror end
  const Lc = p.cradle_length;

  const axisAboveTop = Rb * Math.cos(theta);
  const Hside = pf * L - axisAboveTop + margin;
  const axisHeight = Hside + axisAboveTop;    // = pf*L + margin
  const frontH = axisHeight - D / 2 - margin;
  const cradleOuter = D + 2 * t;
  const bearingSep = D + 2 * t;               // derived, tied to tube width

  // rocker interior = cradle width + tolerance; sides and front panel both use this.
  const tol = p.cradle_tolerance;
  const rockerInnerWidth = cradleOuter + tol;
  const rockerInnerHalf = rockerInnerWidth / 2;
  // Rocker side fore-aft width is DERIVED from the bearing saddle it must contain.
  // The saddle (radius Rcut = Rb+clr, centred on the altitude axis at height Rb·cosθ
  // above the top edge) opens to a half-width `xi` where the cut arc meets the top edge:
  //     xi = √( Rcut² − (Rb·cosθ)² )
  // The board must span that mouth (2·xi) plus solid material beyond each end (edge_margin),
  // so the saddle is fully captured and there is wood around the pads.
  const clr = p.bearing_pad_clearance, Rcut = Rb + clr;
  const xi = Math.sqrt(Math.max(0, Rcut * Rcut - axisAboveTop * axisAboveTop));
  const rockerDepth = 2 * xi + 2 * p.rocker_edge_margin;
  const halfDiag = Math.hypot(rockerDepth / 2, rockerInnerHalf + t);
  const rockerBottomRadius = halfDiag + 0.5;
  const groundRadius = rockerBottomRadius;
  const azPadRadius = Math.SQRT1_2 * groundRadius; // sqrt(2)/2 * R

  const warnings = [];
  if (Hside <= 0)
    warnings.push(`Rocker side height is ${Hside.toFixed(2)}" — scope can't reach zenith.`);
  if (frontH <= 0)
    warnings.push(`Front board height is ${frontH.toFixed(2)}" — front board gone, rigidity lost.`);

  const tBase = p.base_thickness, tGround = p.ground_thickness;
  return { D, t, tBase, tGround, L, Rb, theta, margin, pf, Lc, axisAboveTop, Hside, axisHeight, frontH,
           cradleOuter, bearingSep, rockerInnerHalf, rockerInnerWidth, rockerDepth,
           rockerBottomRadius, groundRadius, azPadRadius, warnings };
}

// ---- part assembly -----------------------------------------------------------
export function buildModel(p) {
  const d = deriveDimensions(p);
  const t = d.t, D = d.D, parts = [];
  const ply = 0xc8a06a, woodDark = 0xb08850;

  const board = (id, frame, profile, holes, position, rotation, color = ply, thickness = t) => {
    const o = { id, kind: 'plywood', frame, profile, holes, thickness, position, rotation, color };
    parts.push(o); return o;
  };
  const tBase = d.tBase, tGround = d.tGround;

  // --- Cradle (OTA frame): square box around the tube ---
  const bcr = p.bolt_circle_radius, br = CONSTANTS.bolt_clearance / 2;
  const boltDiamond = [{ x: 0, y: bcr, r: br }, { x: 0, y: -bcr, r: br },
                       { x: bcr, y: 0, r: br }, { x: -bcr, y: 0, r: br }];
  const O = d.cradleOuter, box = p.joint_type === 'box', N = p.finger_count;
  // X-faces (bearing mounts): thickness along X. Box mode interlocks with the Y-faces.
  const xProfile = box ? cradleXWall(d.Lc, O, N, 0, t) : rect(d.Lc, O);
  for (const s of [1, -1])
    board(`cradle_side_${s > 0 ? 'R' : 'L'}`, 'ota',
          xProfile, boltDiamond, [s * (D / 2 + t / 2), 0, 0], [0, Math.PI / 2, 0], woodDark)
      .marks = [[0, 0]]; // altitude-bearing centre marker (not a hole)
  // Y-faces (top/bottom): thickness along Y. Box mode = full-outer with opposite-phase
  // fingers; butt mode = inset rectangles between the X-faces.
  const yProfile = box ? cradleYWall(O, d.Lc, N, 1, t) : rect(D, d.Lc);
  for (const s of [1, -1])
    board(`cradle_${s > 0 ? 'top' : 'bottom'}`, 'ota',
          yProfile, [], [0, s * (D / 2 + t / 2), 0], [-Math.PI / 2, 0, 0]);

  // --- Tube (reference cylinder, OTA frame) ---
  parts.push({ id: 'tube', kind: 'cylinder', frame: 'ota', radius: D / 2, height: d.L,
               position: [0, 0, (1 - 2 * d.pf) * d.L / 2], rotation: [Math.PI / 2, 0, 0],
               color: 0x888888, opacity: 0.35 });

  // --- Altitude bearings (placeholder cylinders, OTA frame) ---
  for (const s of [1, -1])
    parts.push({ id: `bearing_${s > 0 ? 'R' : 'L'}`, kind: 'cylinder', frame: 'ota',
                 radius: d.Rb, height: p.bearing_width, opacity: 0.25, color: 0x3a7bd5,
                 position: [s * (D / 2 + t + p.bearing_width / 2), 0, 0], rotation: [0, 0, Math.PI / 2] });

  // altitude axis marker
  parts.push({ id: 'axis_marker', kind: 'marker', frame: 'ota', shape: 'sphere',
               size: Math.max(0.3, D * 0.03), position: [0, 0, 0], color: 0xff3030 });

  // --- Rocker box (az frame) ---
  // Sides and the front board land on the bottom disk via tabs-in-slots. Each board's
  // bottom edge grows tabs; the disk gets matching slot holes, co-generated so they align.
  const sideCenterX = d.rockerInnerHalf + t / 2;
  const TN = CONSTANTS.tab_count, TPH = 1;          // phase 1 → flush ends, tabs interior
  const tab = { count: TN, phase: TPH, depth: tBase }; // tab depth = disk (base) thickness
  const slots = [];
  // side↔front box joint: side front edge notched (box), front edges fingered (protrude),
  // opposite phases so they interlock. Only in box mode and where the front board exists.
  const corner = box && d.frontH > 0;
  // phase 0 on the side → solid fingers at the floor & top corners (N is odd), so the
  // front edge never notches into the shared bottom/disk corner. Front uses opposite phase.
  const sideFront = corner ? { count: N, phase: 0, depth: t } : null;

  // sides: thickness along X, bearing saddle in the top edge, tabs in the bottom edge.
  const cornerCfg = { style: p.corner_style, size: p.corner_size };
  const sideProfile = rockerSideProfile(d.rockerDepth, d.Hside, d.Rb, d.theta,
                                        p.bearing_pad_clearance, d.warnings, tab, sideFront, d.frontH, cornerCfg);
  for (const s of [1, -1]) {
    board(`rocker_side_${s > 0 ? 'R' : 'L'}`, 'az', sideProfile, [],
          [s * sideCenterX, d.Hside / 2, 0], [0, Math.PI / 2, 0]);
    slots.push(...sideSlots(tabRanges(d.rockerDepth, TN, TPH), s * sideCenterX, t));
  }
  // front board (lowered so the tube clears at the horizon) — tabs in its bottom edge,
  // and protruding fingers on its left/right edges that fill the side notches (box mode).
  const frontZ = d.rockerDepth / 2 - t / 2, wi = d.rockerInnerWidth, fh = d.frontH;
  if (fh > 0) {
    const fBottom = crenellate([-wi / 2, -fh / 2], [wi / 2, -fh / 2], [0, 1], TN, TPH, tBase, 'tab');
    const fRight = corner ? crenellate([wi / 2, -fh / 2], [wi / 2, fh / 2], [-1, 0], N, 1, t, 'tab') : [[wi / 2, fh / 2]];
    let fLeft;
    if (corner) { fLeft = crenellate([-wi / 2, -fh / 2], [-wi / 2, fh / 2], [1, 0], N, 1, t, 'tab'); fLeft.reverse(); }
    else fLeft = [[-wi / 2, -fh / 2]];
    const fProfile = dedupe([...fBottom, ...fRight, [-wi / 2, fh / 2], ...fLeft]);
    board('rocker_front', 'az', fProfile, [], [0, fh / 2, frontZ], [0, 0, 0]);
    slots.push(...frontSlots(tabRanges(wi, TN, TPH), frontZ, t));
  }
  // bottom disk — pivot hole + the side/front tab slots. Its own (base) thickness; top
  // face stays at the rocker floor (y=0), so it extends downward by tBase.
  board('rocker_bottom', 'az', circle(d.rockerBottomRadius),
        [{ x: 0, y: 0, r: CONSTANTS.pivot_hole / 2 }, ...slots], [0, -tBase / 2, 0], [-Math.PI / 2, 0, 0], ply, tBase);

  // teflon pad markers, TANGENT to the bearing at ±θ. The pad's inner face sits at
  // radius Rb (touching the bearing), so its centre is at Rb + padThk/2, and it's
  // tilted ∓θ about the bearing axis so the face lies along the bearing's tangent.
  const padThk = 0.25, padR = d.Rb + padThk / 2;
  for (const s of [1, -1]) for (const sgn of [1, -1])
    parts.push({ id: `altpad_${s}_${sgn > 0 ? 'f' : 'b'}`, kind: 'marker', frame: 'az', shape: 'box',
                 size: [t, padThk, 1],
                 position: [s * sideCenterX, d.axisHeight - padR * Math.cos(d.theta), sgn * padR * Math.sin(d.theta)],
                 rotation: [-sgn * d.theta, 0, 0], color: 0xeeeeee });

  // --- Ground board (ground frame, fixed) ---
  // Top of ground board sits below the rocker disk (thickness tBase) plus the azimuth pad.
  const gY = -tBase - CONSTANTS.pad_thickness;    // top of ground board
  board('ground_board', 'ground', circle(d.groundRadius),
        [{ x: 0, y: 0, r: CONSTANTS.pivot_hole / 2 }], [0, gY - tGround / 2, 0], [-Math.PI / 2, 0, 0], ply, tGround);
  // azimuth teflon pad markers at 0.707R, 120° (sit on the ground board, under the disk)
  for (let i = 0; i < 3; i++) {
    const a = i * 120 * deg, x = Math.cos(a) * d.azPadRadius, z = Math.sin(a) * d.azPadRadius;
    parts.push({ id: `azpad_${i}`, kind: 'marker', frame: 'ground', shape: 'box',
                 size: [1, CONSTANTS.pad_thickness, 1], position: [x, gY + CONSTANTS.pad_thickness / 2, z], color: 0xeeeeee });
  }
  // 3 feet (below the bottom face of the ground board)
  for (let i = 0; i < 3; i++) {
    const a = (i * 120 + 60) * deg, R = d.groundRadius * 0.85;
    parts.push({ id: `foot_${i}`, kind: 'cylinder', frame: 'ground', color: 0x444444,
                 radius: CONSTANTS.foot_radius, height: CONSTANTS.foot_height,
                 position: [Math.cos(a) * R, gY - tGround - CONSTANTS.foot_height / 2, Math.sin(a) * R],
                 rotation: [0, 0, 0] });
  }

  const ic = checkInterference(d); // complete swept collision check over [0°,90°]
  d.warnings.push(...ic.hits);
  d.minClearance = ic.minClearance;
  d.minClearanceAngle = ic.minClearanceAngle;
  return { dims: d, parts, warnings: d.warnings };
}
