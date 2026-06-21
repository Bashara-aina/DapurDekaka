#!/usr/bin/env node
/**
 * Regenerate favicons from the real Dapur Dekaka logo.
 * Replaces the stale "DK monogram" favicon files with proper renderings
 * of /public/assets/logo/logo.png.
 */

import sharp from "sharp";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");

const LOGO_SRC = path.join(PROJECT_ROOT, "public/assets/logo/logo.png");
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const ICONS_DIR = path.join(PUBLIC_DIR, "assets/icons");
const LOGO_DIR = path.join(PUBLIC_DIR, "assets/logo");

const BG_BRAND_RED = { r: 200, g: 16, b: 46 };
const BG_BRAND_CREAM = { r: 240, g: 234, b: 214 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

const ensureDir = async (dir) => {
  await fs.mkdir(dir, { recursive: true });
};

/**
 * Build a square PNG favicon.
 * - `mode: 'red'`: cream logo on solid brand-red background (most visible in tabs)
 * - `mode: 'cream'`: logo on brand-cream background (matches site chrome)
 * - `mode: 'transparent'`: logo only, transparent background
 */
const buildSquareIcon = async (size, mode, outPath) => {
  const logo = await sharp(LOGO_SRC)
    .resize({
      width: Math.round(size * 0.78),
      height: Math.round(size * 0.78),
      fit: "inside",
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  const { width: lw, height: lh } = await sharp(logo).metadata();

  let background;
  if (mode === "red") {
    background = {
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG_BRAND_RED,
      },
    };
  } else if (mode === "cream") {
    background = {
      create: {
        width: size,
        height: size,
        channels: 4,
        background: BG_BRAND_CREAM,
      },
    };
  } else {
    background = {
      create: {
        width: size,
        height: size,
        channels: 4,
        background: TRANSPARENT,
      },
    };
  }

  const left = Math.round((size - lw) / 2);
  const top = Math.round((size - lh) / 2);

  await sharp(background)
    .composite([{ input: logo, left, top }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
};

/**
 * Build a multi-size .ico file by combining 16, 32, 48 PNG buffers.
 * The ICO container format requires each entry to embed the full PNG
 * payload as the image data (Windows supports PNG-in-ICO since Vista).
 */
const buildIco = async (sizes, outPath) => {
  const entries = await Promise.all(
    sizes.map(async (size) => {
      const buffer = await sharp(LOGO_SRC)
        .resize({
          width: size,
          height: size,
          fit: "contain",
          background: BG_BRAND_RED,
        })
        .png()
        .toBuffer();
      return { size, buffer };
    }),
  );

  const HEADER_SIZE = 6;
  const DIR_ENTRY_SIZE = 16;
  const dirSize = HEADER_SIZE + DIR_ENTRY_SIZE * entries.length;

  let offset = dirSize;
  const directory = Buffer.alloc(dirSize);
  directory.writeUInt16LE(0, 0); // reserved
  directory.writeUInt16LE(1, 2); // type: icon
  directory.writeUInt16LE(entries.length, 4); // count

  const imageBuffers = [];
  entries.forEach((entry, i) => {
    const e = DIR_ENTRY_SIZE;
    const o = HEADER_SIZE + i * e;
    const dim = entry.size >= 256 ? 0 : entry.size;
    directory.writeUInt8(dim, o + 0); // width
    directory.writeUInt8(dim, o + 1); // height
    directory.writeUInt8(0, o + 2); // palette
    directory.writeUInt8(0, o + 3); // reserved
    directory.writeUInt16LE(1, o + 4); // planes
    directory.writeUInt16LE(32, o + 6); // bpp
    directory.writeUInt32LE(entry.buffer.length, o + 8); // size
    directory.writeUInt32LE(offset, o + 12); // offset
    offset += entry.buffer.length;
    imageBuffers.push(entry.buffer);
  });

  const ico = Buffer.concat([directory, ...imageBuffers]);
  await fs.writeFile(outPath, ico);
};

/**
 * Build an SVG favicon by rasterizing the PNG into an inline data URI
 * inside a minimal SVG wrapper. Browsers that support SVG favicons
 * will use this for crisp rendering on HiDPI tab strips.
 */
const buildSvgFavicon = async (size, outPath) => {
  const pngBase64 = await sharp(LOGO_SRC)
    .resize({
      width: size,
      height: size,
      fit: "contain",
      background: BG_BRAND_RED,
    })
    .png()
    .toBuffer()
    .then((buf) => buf.toString("base64"));

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <rect width="${size}" height="${size}" fill="#C8102E"/>
  <image href="data:image/png;base64,${pngBase64}" x="0" y="0" width="${size}" height="${size}"/>
</svg>
`;
  await fs.writeFile(outPath, svg);
};

const main = async () => {
  await ensureDir(ICONS_DIR);
  await ensureDir(LOGO_DIR);

  console.log("→ Regenerating favicon.ico (multi-size from logo)...");
  await buildIco([16, 32, 48], path.join(PUBLIC_DIR, "favicon.ico"));
  await buildIco([16, 32, 48], path.join(ICONS_DIR, "favicon.ico"));

  console.log("→ Regenerating favicon.svg (logo on brand-red)...");
  await buildSvgFavicon(64, path.join(ICONS_DIR, "favicon.svg"));

  console.log("→ Generating PWA / manifest icons...");
  await buildSquareIcon(192, "red", path.join(LOGO_DIR, "icon-192.png"));
  await buildSquareIcon(512, "red", path.join(LOGO_DIR, "icon-512.png"));
  await buildSquareIcon(180, "red", path.join(LOGO_DIR, "apple-touch-icon.png"));

  console.log("→ Done.");
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});