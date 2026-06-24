// Minimal ZIP writer — "store" method (no compression), enough to bundle the per-part
// DXF files into one download. Dependency-free, matching the rest of the project.

let CRC;
function crc32(bytes) {
  if (!CRC) { CRC = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      CRC[n] = c >>> 0; } }
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

const u16 = (a, v) => a.push(v & 0xFF, (v >>> 8) & 0xFF);
const u32 = (a, v) => a.push(v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF);
const bytesOf = s => { const a = []; for (let i = 0; i < s.length; i++) a.push(s.charCodeAt(i) & 0xFF); return a; };
const DOS_DATE = 0x21; // 1980-01-01, a valid placeholder

export function zipStore(files) {
  const out = [], central = [];
  let offset = 0;
  for (const f of files) {
    const data = bytesOf(f.data), name = bytesOf(f.name), crc = crc32(Uint8Array.from(data));
    const lh = [];
    u32(lh, 0x04034b50); u16(lh, 20); u16(lh, 0); u16(lh, 0); u16(lh, 0); u16(lh, DOS_DATE);
    u32(lh, crc); u32(lh, data.length); u32(lh, data.length); u16(lh, name.length); u16(lh, 0);
    const local = lh.concat(name, data);
    out.push(...local);

    const cd = [];
    u32(cd, 0x02014b50); u16(cd, 20); u16(cd, 20); u16(cd, 0); u16(cd, 0); u16(cd, 0); u16(cd, DOS_DATE);
    u32(cd, crc); u32(cd, data.length); u32(cd, data.length);
    u16(cd, name.length); u16(cd, 0); u16(cd, 0); u16(cd, 0); u16(cd, 0); u32(cd, 0); u32(cd, offset);
    central.push(...cd, ...name);
    offset += local.length;
  }
  const cdStart = offset;
  out.push(...central);
  const eocd = [];
  u32(eocd, 0x06054b50); u16(eocd, 0); u16(eocd, 0); u16(eocd, files.length); u16(eocd, files.length);
  u32(eocd, central.length); u32(eocd, cdStart); u16(eocd, 0);
  out.push(...eocd);
  return Uint8Array.from(out);
}
