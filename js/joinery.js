// Joinery generators — finger/box joints and tab/slot joints, all expressed as edits
// to the 2D part PROFILE (and matching holes), so they flow straight to the viewer and
// the eventual DXF. Nothing here is 3D; joints are profile features by construction.
//
// Conventions: a profile is a centered polygon (points [x,y]); the panel spans
// x∈[-W/2,W/2], y∈[-H/2,H/2]. `phase` selects which segments are "raised" (a finger in
// box mode, a protruding tab in tab mode): raised ⇔ (i + phase) is even.

const EPS = 1e-7;

function offsetFor(i, phase, depth, mode) {
  const raised = ((i + phase) % 2) === 0;
  if (mode === 'tab') return raised ? -depth : 0; // tab protrudes OUTWARD (−inward)
  return raised ? 0 : depth;                       // box: notch cuts INWARD
}

// Crenellate the straight edge P0→P1. `inward` is a unit vector pointing into the panel.
// Returns the square-wave points from P0 to P1 inclusive.
export function crenellate(P0, P1, inward, count, phase, depth, mode) {
  const dx = P1[0] - P0[0], dy = P1[1] - P0[1], len = Math.hypot(dx, dy);
  const ax = dx / len, ay = dy / len, seg = len / count, pts = [];
  for (let i = 0; i < count; i++) {
    const o = offsetFor(i, phase, depth, mode), a0 = i * seg, a1 = (i + 1) * seg;
    pts.push([P0[0] + ax * a0 + inward[0] * o, P0[1] + ay * a0 + inward[1] * o]);
    pts.push([P0[0] + ax * a1 + inward[0] * o, P0[1] + ay * a1 + inward[1] * o]);
  }
  return pts;
}

// The local-x ranges of the "raised" (tab) segments along a width-W edge.
export function tabRanges(W, count, phase) {
  const seg = W / count, out = [];
  for (let i = 0; i < count; i++)
    if (((i + phase) % 2) === 0) out.push([-W / 2 + i * seg, -W / 2 + (i + 1) * seg]);
  return out;
}

export function dedupe(pts) {
  const out = [];
  for (const p of pts)
    if (!out.length || Math.hypot(p[0] - out[out.length - 1][0], p[1] - out[out.length - 1][1]) > EPS) out.push(p);
  if (out.length > 1 && Math.hypot(out[0][0] - out[out.length - 1][0], out[0][1] - out[out.length - 1][1]) < EPS) out.pop();
  return out;
}

// ---- cradle walls (box joints), all teeth indexed from −Z so mates interlock ---
// X-wall: profile (local-x = Z ∈ [-Lc/2,Lc/2], local-y = Y ∈ [-O/2,O/2]); fingers on
// top & bottom edges.
export function cradleXWall(Lc, O, count, phase, depth) {
  const BL = [-Lc / 2, -O / 2], BR = [Lc / 2, -O / 2], TR = [Lc / 2, O / 2], TL = [-Lc / 2, O / 2];
  let pts = crenellate(BL, BR, [0, 1], count, phase, depth, 'box'); // bottom, inward +y
  pts.push(TR);                                                     // right side straight
  const top = crenellate(TL, TR, [0, -1], count, phase, depth, 'box'); top.reverse(); // index from −Z
  pts = pts.concat(top);
  pts.push(BL);                                                     // left side straight
  return dedupe(pts);
}

// Y-wall: profile (local-x = X ∈ [-O/2,O/2], local-y = Z ∈ [-Lc/2,Lc/2]); fingers on
// left & right edges. Use the opposite phase so it interlocks with the X-walls.
export function cradleYWall(O, Lc, count, phase, depth) {
  const BL = [-O / 2, -Lc / 2], BR = [O / 2, -Lc / 2], TR = [O / 2, Lc / 2], TL = [-O / 2, Lc / 2];
  let pts = [BL, BR];                                              // bottom (Z−) straight
  pts = pts.concat(crenellate(BR, TR, [-1, 0], count, phase, depth, 'box')); // right edge, inward −x
  pts.push(TL);                                                    // top (Z+) straight
  const left = crenellate(BL, TL, [1, 0], count, phase, depth, 'box'); left.reverse();
  pts = pts.concat(left);
  return dedupe(pts);
}

// ---- disk slot holes (disk-local coords: localX = worldX, localY = −worldZ) -----
// Holes must be wound CLOCKWISE — opposite the CCW disk outline — or Earcut won't cut them.
export function sideSlots(ranges, sX, t) {        // side board at worldX = sX
  return ranges.map(([a0, a1]) => ({ poly: [[sX - t / 2, a0], [sX - t / 2, a1], [sX + t / 2, a1], [sX + t / 2, a0]] }));
}
export function frontSlots(ranges, frontZ, t) {   // front board at worldZ = frontZ
  const y0 = -frontZ - t / 2, y1 = -frontZ + t / 2;
  return ranges.map(([a0, a1]) => ({ poly: [[a0, y0], [a0, y1], [a1, y1], [a1, y0]] }));
}
