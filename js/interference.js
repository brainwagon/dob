// Interference check by CONSERVATIVE ADVANCEMENT — a rigorous, complete sweep test.
//
// The OTA is a rigid body rotating about one fixed axis (the altitude axis, along X
// through (0, axisHeight, 0)) over [0°, 90°]. For that single-DOF motion we can be
// CERTAIN, not just sample-and-hope:
//
//   • For two disjoint convex polytopes the exact minimum distance is the largest
//     projection gap over the SAT candidate axes (face normals + edge×edge), which we
//     already enumerate. So one pass over those axes gives the true separation d(θ).
//   • No point of the moving body moves farther than ρ·Δθ when rotating by Δθ, where ρ
//     is the max distance of any vertex from the rotation axis (constant over the sweep).
//   • Therefore advancing by Δθ = d(θ)/ρ can never step over a contact. Reaching 90° is
//     a certificate of no collision across the whole continuous range; d→0 locates a hit.
//
// Convexity holds: we test the convex cradle box and tube against the convex rocker
// front board and bottom disk. The non-convex saddle sides are excluded — the cradle
// slides in the parallel gap between them and cannot intersect them.

const TOL = 1e-3;          // inches: separation at or below this counts as contact
const MAX_ITERS = 20000;   // guard; only reached when approaching a true graze

// ---- tiny vec/mat -------------------------------------------------------------
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
function norm(v) { const m = Math.hypot(v[0], v[1], v[2]); return m < 1e-12 ? null : [v[0] / m, v[1] / m, v[2] / m]; }
const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
function Rx(a) { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; }

// ---- profile helpers ----------------------------------------------------------
function rect(w, h) { const x = w / 2, y = h / 2; return [[-x, -y], [x, -y], [x, y], [-x, y]]; }
function ngonCirc(r, n) {           // circumscribed n-gon (contains the circle of radius r)
  const R = r / Math.cos(Math.PI / n), pts = [];
  for (let i = 0; i < n; i++) { const a = (i + 0.5) / n * 2 * Math.PI; pts.push([Math.cos(a) * R, Math.sin(a) * R]); }
  return pts;
}

// ---- convex prism collider (verts + candidate axes + edge dirs) ----------------
function prism(name, profile, thickness, rx, pos) {
  const M = Rx(rx);
  const verts = [];
  for (const [px, py] of profile) for (const z of [-thickness / 2, thickness / 2])
    verts.push(add(mv(M, [px, py, z]), pos));
  const zAxis = norm(mv(M, [0, 0, 1]));
  const faceAxes = [zAxis], edgeDirs = [zAxis];
  for (let i = 0; i < profile.length; i++) {
    const a = profile[i], b = profile[(i + 1) % profile.length];
    const ed = [b[0] - a[0], b[1] - a[1], 0];
    const dir = norm(mv(M, ed)); if (dir) edgeDirs.push(dir);
    const nrm = norm(mv(M, [ed[1], -ed[0], 0])); if (nrm) faceAxes.push(nrm);
  }
  return { name, verts, faceAxes, edgeDirs };
}

function xform(c, R, t) {            // extra rotation R + translation t (axes only rotate)
  return {
    name: c.name,
    verts: c.verts.map(v => add(mv(R, v), t)),
    faceAxes: c.faceAxes.map(a => mv(R, a)),
    edgeDirs: c.edgeDirs.map(e => mv(R, e)),
  };
}

// exact signed separation: >0 = min distance between disjoint bodies, <=0 = overlapping
function separation(A, B) {
  const axes = [...A.faceAxes, ...B.faceAxes];
  for (const ea of A.edgeDirs) for (const eb of B.edgeDirs) { const c = norm(cross(ea, eb)); if (c) axes.push(c); }
  let maxGap = -Infinity;
  for (const ax of axes) {
    let aLo = Infinity, aHi = -Infinity, bLo = Infinity, bHi = -Infinity;
    for (const v of A.verts) { const d = dot(v, ax); if (d < aLo) aLo = d; if (d > aHi) aHi = d; }
    for (const v of B.verts) { const d = dot(v, ax); if (d < bLo) bLo = d; if (d > bHi) bHi = d; }
    const gap = Math.max(bLo - aHi, aLo - bHi); // positive if separated along this axis
    if (gap > maxGap) maxGap = gap;
  }
  return maxGap;
}

const rhoOf = c => c.verts.reduce((r, v) => Math.max(r, Math.hypot(v[1], v[2])), 0);

// sweep one moving body vs one static body across [0, altMax]; complete & certain
function sweepPair(moving, stat, tAxis, altMax) {
  const rho = rhoOf(moving) || 1e-9;
  let theta = 0, minD = Infinity, minAng = 0, iters = 0;
  while (theta <= altMax + 1e-9) {
    const d = separation(xform(moving, Rx(-theta), tAxis), stat);
    if (d < minD) { minD = d; minAng = theta; }
    if (d <= TOL) return { contact: true, minD: d, minAng: theta, graze: false };
    if (++iters >= MAX_ITERS) return { contact: true, minD, minAng, graze: true };
    theta += d / rho;                 // provably safe step — cannot skip a contact
  }
  return { contact: false, minD, minAng, graze: false };
}

// ---- public -------------------------------------------------------------------
export function checkInterference(d) {
  const moving = [
    prism('cradle', rect(d.cradleOuter, d.cradleOuter), d.Lc, 0, [0, 0, 0]),
    prism('tube', ngonCirc(d.D / 2, 16), d.L, 0, [0, 0, (1 - 2 * d.pf) * d.L / 2]),
  ];
  const stat = [prism('bottom', ngonCirc(d.rockerBottomRadius, 24), d.t, -Math.PI / 2, [0, -d.t / 2, 0])];
  if (d.frontH > 0)
    stat.push(prism('front board', rect(d.rockerInnerWidth, d.frontH), d.t, 0,
                    [0, d.frontH / 2, d.rockerDepth / 2 - d.t / 2]));

  const tAxis = [0, d.axisHeight, 0], altMax = Math.PI / 2;
  const hits = [];
  let minClear = Infinity, minClearAng = 0;
  for (const m of moving) for (const s of stat) {
    const r = sweepPair(m, s, tAxis, altMax);
    if (r.minD < minClear) { minClear = r.minD; minClearAng = r.minAng; }
    if (r.contact) {
      const deg = Math.round(r.minAng * 180 / Math.PI);
      hits.push(`Interference: ${m.name} ∩ rocker ${s.name} near ${deg}°${r.graze ? ' (grazing)' : ''}.`);
    }
  }
  return { hits, minClearance: minClear, minClearanceAngle: Math.round(minClearAng * 180 / Math.PI) };
}
