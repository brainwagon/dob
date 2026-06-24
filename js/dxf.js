// Minimal DXF writer (AutoCAD R12 / AC1009 — the most widely readable flavor).
// One part → one DXF. Outlines and polygon slots become closed POLYLINEs, round holes
// become CIRCLEs, and center markers become small cross LINEs. Coordinates are the
// part's local cut-face profile (inches), exactly what gets cut.

const F = n => (+n).toFixed(4);
const pair = (code, val) => `${code}\n${val}\n`;

function polyline(points) {
  let s = pair(0, 'POLYLINE') + pair(8, '0') + pair(66, 1) + pair(70, 1); // 70=1 closed
  for (const [x, y] of points)
    s += pair(0, 'VERTEX') + pair(8, '0') + pair(10, F(x)) + pair(20, F(y));
  return s + pair(0, 'SEQEND') + pair(8, '0');
}
function circle(cx, cy, r) {
  return pair(0, 'CIRCLE') + pair(8, '0') + pair(10, F(cx)) + pair(20, F(cy)) + pair(40, F(r));
}
function line(x1, y1, x2, y2) {
  return pair(0, 'LINE') + pair(8, '0') + pair(10, F(x1)) + pair(20, F(y1)) + pair(11, F(x2)) + pair(21, F(y2));
}
const cross = (x, y, s = 0.15) => line(x - s, y, x + s, y) + line(x, y - s, x, y + s);

export function partToDXF(part) {
  let e = polyline(part.profile);
  for (const h of part.holes || []) e += h.poly ? polyline(h.poly) : circle(h.x, h.y, h.r);
  for (const m of part.marks || []) e += cross(m[0], m[1]);
  return pair(0, 'SECTION') + pair(2, 'HEADER') + pair(9, '$ACADVER') + pair(1, 'AC1009') +
         pair(9, '$INSUNITS') + pair(70, 1) + pair(0, 'ENDSEC') +     // 1 = inches
         pair(0, 'SECTION') + pair(2, 'ENTITIES') + e + pair(0, 'ENDSEC') +
         pair(0, 'EOF');
}
