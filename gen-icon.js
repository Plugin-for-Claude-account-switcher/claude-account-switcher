// Generates a 128×128 PNG icon for the Claude Account Switcher extension.
// Requires only Node.js built-ins (zlib, fs). Run: node gen-icon.js
'use strict';

const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 (required by PNG spec) ──────────────────────────────────────────
const CRC_TABLE = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
        t[n] = c;
    }
    return t;
})();

function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
    const t   = Buffer.from(type, 'ascii');
    const len = Buffer.allocUnsafe(4); len.writeUInt32BE(data.length);
    const crc = Buffer.allocUnsafe(4); crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
}

// ── Icon design ───────────────────────────────────────────────────────────
// 128×128 px, RGB colour type.
// Background: deep navy (#1A1B2E)
// Disc: dark purple-blue radial gradient
// Logo: bold rounded "C" arc in Anthropic lavender (#CF9FFF)
// Thin outer ring: semi-transparent lavender

const W = 128, H = 128;
const raw = [];

function clamp(v) { return Math.max(0, Math.min(255, Math.round(v))); }

for (let y = 0; y < H; y++) {
    raw.push(0); // filter byte = None
    for (let x = 0; x < W; x++) {
        const cx = x - W / 2 + 0.5;
        const cy = y - H / 2 + 0.5;
        const dist = Math.sqrt(cx * cx + cy * cy);
        const R = W / 2 - 1;      // disc radius
        const arc_r = 36;          // "C" arc centre radius
        const arc_t = 13;          // "C" arc thickness (half)

        // ── Background ────────────────────────────────────────────
        let r = 26, g = 27, b = 46;

        // ── Disc fill (radial gradient, dark → medium purple-blue) ─
        if (dist <= R) {
            const t = 1 - dist / R;
            r = clamp(30 + t * 25);
            g = clamp(25 + t * 18);
            b = clamp(60 + t * 55);
        }

        // ── "C" arc ───────────────────────────────────────────────
        if (dist <= R - 5) {
            const inBand = Math.abs(dist - arc_r) < arc_t;
            if (inBand) {
                const angle = Math.atan2(cy, cx); // -π … +π (0 = right)
                // Gap on the right: −35° to +35°
                const GAP = (35 * Math.PI) / 180;
                const inGap = angle > -GAP && angle < GAP;

                if (!inGap) {
                    // Blend towards lavender, full coverage at band centre
                    const blend = 1 - Math.abs(dist - arc_r) / arc_t;
                    r = clamp(r * (1 - blend) + 207 * blend);
                    g = clamp(g * (1 - blend) + 159 * blend);
                    b = clamp(b * (1 - blend) + 255 * blend);
                }
            }
        }

        // ── Outer ring ─────────────────────────────────────────────
        if (dist > R - 5 && dist <= R) {
            const fade = (dist - (R - 5)) / 5;
            r = clamp(r * (1 - fade * 0.6) + 180 * fade * 0.6);
            g = clamp(g * (1 - fade * 0.6) + 130 * fade * 0.6);
            b = clamp(b * (1 - fade * 0.6) + 255 * fade * 0.6);
        }

        raw.push(r, g, b);
    }
}

// ── Encode PNG ────────────────────────────────────────────────────────────
const ihdr = Buffer.allocUnsafe(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8]  = 8; // bit depth
ihdr[9]  = 2; // colour type: RGB
ihdr[10] = 0; // compression: deflate
ihdr[11] = 0; // filter: adaptive
ihdr[12] = 0; // interlace: none

const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const idat = zlib.deflateSync(Buffer.from(raw), { level: 9 });

const png = Buffer.concat([
    PNG_SIG,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
]);

const out = path.join(__dirname, 'media', 'icon.png');
fs.writeFileSync(out, png);
console.log(`✓ icon.png written — ${png.length} bytes (${W}×${H} px RGB)`);
