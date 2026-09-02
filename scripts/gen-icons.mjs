import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const svg = readFileSync(fileURLToPath(new URL("../public/icon.svg", import.meta.url)));

const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));

await sharp(svg).resize(192, 192).png().toFile(out("icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("icon-512.png"));
await sharp(svg).resize(512, 512).png().toFile(out("icon-maskable-512.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));

console.log("PWA иконки сгенерированы");
