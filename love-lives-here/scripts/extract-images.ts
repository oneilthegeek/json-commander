/**
 * Extracts the base64 images embedded in the original single-file site into
 * real files with descriptive names, de-duplicating identical images, and
 * produces a 1200x630 social preview from the hero photograph.
 *
 * Usage: npm run images -- [path/to/love-lives-here.html]
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const NAMES = [
  "hand-holding-wax-sealed-love-letters",
  "handwritten-love-letter-dear-voke",
  "llh-kraft-gift-box-dried-flowers",
  "secret-candle-red-tin",
  "llh-gold-card-nfc",
  "red-roses-full-bouquet-black-wrap",
  "red-roses-white-wrap",
  "yellow-chrysanthemums-full-bouquet",
  "pink-purple-chrysanthemums",
  "llh-gold-card-nfc", // duplicate of #5 in the original file
];

async function main() {
  const src = process.argv[2] ?? "docs/original/love-lives-here.html";
  const html = readFileSync(src, "utf8");
  const re = /data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)/g;
  const out = path.join("public", "images");
  mkdirSync(out, { recursive: true });
  const seen = new Map<string, string>();
  let i = 0;
  for (const m of html.matchAll(re)) {
    const buf = Buffer.from(m[2], "base64");
    const hash = createHash("sha256").update(buf).digest("hex");
    const name = NAMES[i] ?? `image-${i + 1}`;
    i++;
    if (seen.has(hash)) {
      console.log(`#${i} duplicate of ${seen.get(hash)} (skipped)`);
      continue;
    }
    const meta = await sharp(buf).metadata();
    const file = path.join(out, `${name}.jpg`);
    writeFileSync(file, buf);
    seen.set(hash, name);
    console.log(`#${i} -> ${file} ${meta.width}x${meta.height} ${(buf.length / 1024).toFixed(0)}KB`);
  }
  await sharp(path.join(out, `${NAMES[0]}.jpg`))
    .resize(1200, 630, { fit: "cover", position: "attention" })
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(path.join(out, "og-love-lives-here.jpg"));
  console.log("social preview -> public/images/og-love-lives-here.jpg");
}
main().catch((e) => { console.error(e); process.exit(1); });
