import fs from "fs";
import path from "path";
import zlib from "zlib";

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  }
  crcTable[n] = c >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  const combined = Buffer.concat([typeBuf, data]);
  crc.writeUInt32BE(crc32(combined), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function createIconPng(size) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const raw = Buffer.alloc(size * (size * 4 + 1));
  const radius = size * 0.22;

  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter type None
    for (let x = 0; x < size; x++) {
      const idx = rowStart + 1 + x * 4;
      // Rounded rectangle check
      let dx = 0;
      let dy = 0;
      if (x < radius) dx = radius - x;
      else if (x > size - 1 - radius) dx = x - (size - 1 - radius);
      if (y < radius) dy = radius - y;
      else if (y > size - 1 - radius) dy = y - (size - 1 - radius);

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > radius + 0.5) {
        raw[idx] = 0;
        raw[idx + 1] = 0;
        raw[idx + 2] = 0;
        raw[idx + 3] = 0;
        continue;
      }

      // Indigo/Blue gradient background
      const t = (x + y) / (2 * size);
      let r = Math.round(29 + t * (79 - 29));
      let g = Math.round(78 + t * (70 - 78));
      let b = Math.round(216 + t * (229 - 216));

      // Draw a stylized white "W" + lightning/sparkle accent in center
      const nx = x / size;
      const ny = y / size;
      const inW =
        ny >= 0.28 &&
        ny <= 0.74 &&
        ((Math.abs(nx - (0.22 + (ny - 0.28) * 0.22)) < 0.055) ||
          (Math.abs(nx - (0.5 - (ny - 0.28) * 0.2)) < 0.05 && ny >= 0.42) ||
          (Math.abs(nx - (0.5 + (ny - 0.28) * 0.2)) < 0.05 && ny >= 0.42) ||
          (Math.abs(nx - (0.78 - (ny - 0.28) * 0.22)) < 0.055));

      if (inW) {
        r = 255;
        g = 255;
        b = 255;
      }

      raw[idx] = r;
      raw[idx + 1] = g;
      raw[idx + 2] = b;
      raw[idx + 3] = 255;
    }
  }

  const idat = zlib.deflateSync(raw);
  return Buffer.concat([
    signature,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idat),
    makeChunk("IEND", Buffer.alloc(0)),
  ]);
}

const iconsDir = path.resolve("public/icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 32, 48, 128]) {
  const png = createIconPng(size);
  fs.writeFileSync(path.join(iconsDir, `icon${size}.png`), png);
}
console.log("Generated extension icons in public/icons/");
