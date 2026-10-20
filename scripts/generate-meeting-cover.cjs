// Regenerate the built-in meeting cover without relying on a supplied image.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const width = 480;
const height = 192;
const pixels = Buffer.alloc(width * height * 4);

function paint(x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= height || alpha <= 0) return;
  const at = (y * width + x) * 4;
  for (let channel = 0; channel < 3; channel++) {
    pixels[at + channel] = Math.round(pixels[at + channel] * (1 - alpha) + color[channel] * alpha);
  }
  pixels[at + 3] = 255;
}

function shape(bounds, coverage, color, opacity = 1) {
  const left = Math.max(0, Math.floor(bounds[0]));
  const top = Math.max(0, Math.floor(bounds[1]));
  const right = Math.min(width, Math.ceil(bounds[2]));
  const bottom = Math.min(height, Math.ceil(bounds[3]));
  for (let y = top; y < bottom; y++) {
    for (let x = left; x < right; x++) {
      const coverageValue = coverage(x + 0.5, y + 0.5);
      paint(x, y, color, Math.max(0, Math.min(1, coverageValue)) * opacity);
    }
  }
}

function ellipse(cx, cy, rx, ry, color, opacity = 1) {
  shape([cx - rx - 2, cy - ry - 2, cx + rx + 2, cy + ry + 2], (x, y) => {
    const distance = Math.hypot((x - cx) / rx, (y - cy) / ry);
    return Math.max(0, Math.min(1, (1 - distance) * Math.min(rx, ry)));
  }, color, opacity);
}

function roundedRect(left, top, right, bottom, radius, color, opacity = 1) {
  shape([left - 1, top - 1, right + 1, bottom + 1], (x, y) => {
    if (radius === 0) return x >= left && x < right && y >= top && y < bottom ? 1 : 0;
    const dx = Math.max(left + radius - x, 0, x - (right - radius));
    const dy = Math.max(top + radius - y, 0, y - (bottom - radius));
    return Math.max(0, Math.min(1, radius - Math.hypot(dx, dy) + 0.5));
  }, color, opacity);
}

function line(x1, y1, x2, y2, thickness, color, opacity = 1) {
  shape([Math.min(x1, x2) - thickness, Math.min(y1, y2) - thickness, Math.max(x1, x2) + thickness, Math.max(y1, y2) + thickness], (x, y) => {
    const lengthSquared = (x2 - x1) ** 2 + (y2 - y1) ** 2;
    const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / lengthSquared));
    return Math.max(0, Math.min(1, thickness / 2 + 0.5 - Math.hypot(x - x1 - t * (x2 - x1), y - y1 - t * (y2 - y1))));
  }, color, opacity);
}

const cyan = [0, 173, 252];
const blue = [12, 112, 240];
for (let y = 0; y < height; y++) {
  for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    const mix = (x / width) * 0.55 + (y / height) * 0.25;
    pixels[at] = Math.round(235 - 47 * mix);
    pixels[at + 1] = Math.round(249 - 36 * mix);
    pixels[at + 2] = 255;
    pixels[at + 3] = 255;
  }
}

ellipse(391, 108, 128, 120, [127, 214, 255], 0.27);
ellipse(450, 23, 79, 79, [255, 255, 255], 0.45);
shape([0, 88, width, height], (x, y) => y > 131 + 18 * Math.sin(x / 67) ? 1 : 0, [71, 194, 255], 0.28);
shape([0, 110, width, height], (x, y) => y > 158 + 22 * Math.sin(x / 75 + 1.1) ? 1 : 0, cyan, 0.36);
shape([0, 145, width, height], (x, y) => y > 185 + 14 * Math.sin(x / 85 + 0.2) ? 1 : 0, blue, 0.23);

// Calendar tile and microphone, matching the app's blue meeting palette.
roundedRect(178, 33, 306, 165, 25, [45, 133, 226], 0.18);
roundedRect(172, 27, 300, 159, 25, [255, 255, 255]);
roundedRect(172, 27, 300, 69, 25, cyan);
roundedRect(172, 52, 300, 69, 0, cyan);
roundedRect(197, 20, 207, 48, 5, blue);
roundedRect(266, 20, 276, 48, 5, blue);
roundedRect(219, 81, 253, 119, 17, blue);
shape([205, 91, 266, 137], (x, y) => {
  const distance = Math.hypot((x - 236) / 27, (y - 102) / 30);
  return distance > 0.82 && distance < 0.98 && y > 101 ? 1 : 0;
}, cyan);
line(236, 128, 236, 141, 6, blue);
line(222, 143, 250, 143, 6, blue);

// Small sound marks keep the artwork recognisable at thumbnail size.
ellipse(115, 68, 5, 5, cyan, 0.6);
ellipse(344, 91, 4, 4, blue, 0.5);
line(89, 91, 89, 105, 5, cyan, 0.65);
line(102, 85, 102, 112, 5, cyan, 0.65);
line(115, 95, 115, 107, 5, cyan, 0.65);
line(353, 60, 353, 80, 5, blue, 0.55);
line(366, 53, 366, 88, 5, blue, 0.55);
line(379, 63, 379, 77, 5, blue, 0.55);

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(name, data) {
  const type = Buffer.from(name);
  const length = Buffer.alloc(4);
  const checksum = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  checksum.writeUInt32BE(crc32(Buffer.concat([type, data])));
  return Buffer.concat([length, type, data, checksum]);
}

const rows = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y++) pixels.copy(rows, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', zlib.deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
const target = path.join(__dirname, '..', 'src', 'utils', 'generatedMeetingCover.ts');
fs.writeFileSync(target, `// Generated by scripts/generate-meeting-cover.cjs. Do not edit by hand.\nexport const generatedMeetingCoverBase64 = "${png.toString('base64')}";\n`);
console.log(`Wrote ${target} (${png.length} PNG bytes)`);
