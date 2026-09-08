#!/usr/bin/env node
"use strict";
const fs = require("fs");
const path = require("path");

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i++) {
    const em = /^--([^=]+)=(.*)$/.exec(argv[i]);
    if (em) { out[em[1]] = em[2]; continue; }
    const sm = /^--([^=]+)$/.exec(argv[i]);
    if (sm) { out[sm[1]] = argv[i + 1] || ""; i++; }
  }
  return out;
}

const args = parseArgs(process.argv);
const seedStr = String(args.seed || "1");
const style = String(args.style || "stripes");
const size = Math.max(16, Math.min(1024, Number(args.size) || 256));
const rand = mulberry32(hashSeed(seedStr));
const colors = ["#0f172a", "#1d4ed8", "#7c3aed", "#db2777", "#f59e0b", "#10b981", "#f97316", "#06b6d4"];

function pick() { return colors[Math.floor(rand() * colors.length)]; }
function svgOpen() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`;
}
function bg() {
  const c = pick();
  return `<rect width="100%" height="100%" fill="${c}"/>`;
}

function stripes() {
  const n = 3 + Math.floor(rand() * 6);
  let s = "";
  for (let i = 0; i < n; i++) {
    const x = (i / n) * size + rand() * size / n;
    const w = size / n + rand() * size / (n * 2);
    s += `<rect x="${x.toFixed(1)}" y="0" width="${w.toFixed(1)}" height="${size}" fill="${pick()}" opacity="0.9"/>`;
  }
  return s;
}
function circles() {
  const n = Math.floor(rand() * 20) + 10;
  let s = "";
  for (let i = 0; i < n; i++) {
    const r = rand() * size * 0.22 + size * 0.02;
    s += `<circle cx="${(rand() * size).toFixed(1)}" cy="${(rand() * size).toFixed(1)}" r="${r.toFixed(1)}" fill="${pick()}" opacity="0.75"/>`;
  }
  return s;
}
function grid() {
  const n = 4 + Math.floor(rand() * 4);
  const cell = size / n;
  let s = "";
  for (let gx = 0; gx < n; gx++) for (let gy = 0; gy < n; gy++) {
    if (rand() < 0.55) s += `<rect x="${(gx * cell).toFixed(1)}" y="${(gy * cell).toFixed(1)}" width="${(cell * 0.9).toFixed(1)}" height="${(cell * 0.9).toFixed(1)}" rx="${(cell * 0.15).toFixed(1)}" fill="${pick()}"/>`;
  }
  return s;
}
function waves() {
  const rows = 3 + Math.floor(rand() * 4);
  const amp = size * 0.06 + rand() * size * 0.08;
  let s = "";
  for (let r = 0; r < rows; r++) {
    const y0 = (r / rows) * size;
    const d = Math.floor(rand() * 2);
    const p = `<path d="M0 ${y0.toFixed(1)} Q ${size / 4} ${(y0 - amp).toFixed(1)} ${size / 2} ${y0.toFixed(1)} T ${size} ${y0.toFixed(1)}" stroke="${pick()}" stroke-width="${(size * 0.02 + rand() * size * 0.02).toFixed(1)}" fill="none" opacity="0.9"/>`;
    s += d ? p.replace(" Q ", " Q ") : p;
  }
  return s;
}
function mosaic() {
  const n = 6 + Math.floor(rand() * 6);
  let s = "";
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    sum: {
      const w = size / n;
      const x = i * w, y = j * w;
      const r = rand();
      const shape = r < 0.33 ? "rect" : r < 0.66 ? "circle" : "path";
      if (shape === "rect") {
        s += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${w.toFixed(1)}" fill="${pick()}"/>`;
      } else if (shape === "circle") {
        const cx = x + w / 2, cyy = y + w / 2, rr = w * 0.38 + rand() * w * 0.1;
        s += `<circle cx="${cx.toFixed(1)}" cy="${cyy.toFixed(1)}" r="${rr.toFixed(1)}" fill="${pick()}"/>`;
      } else {
        s += `<polygon points="${x.toFixed(1)},${y.toFixed(1)} ${(x + w).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + w).toFixed(1)}" fill="${pick()}"/>`;
      }
    }
  }
  return s;
}

function build(styleId) {
  switch (styleId) {
    case "circles": return bg() + circles();
    case "grid": return bg() + grid();
    case "waves": return bg() + waves();
    case "mosaic": return bg() + mosaic();
    case "stripes":
    default: return bg() + stripes();
  }
}

const svg = svgOpen() + build(style) + "</svg>";
const now = new Date().toISOString();
const outDir = path.join(process.cwd(), "patterns");
fs.mkdirSync(outDir, { recursive: true });

fs.writeFileSync(path.join(outDir, "latest.svg"), `${svg}\n`);
fs.writeFileSync(path.join(outDir, `pattern-${seedStr.replace(/[^a-zA-Z0-9_-]/g, "")}-${style}.svg`), `${svg}\n`);

const indexPath = path.join(outDir, "index.json");
let list = [];
try { list = JSON.parse(fs.readFileSync(indexPath, "utf8")); } catch (e) { list = []; }
list.unshift({ seed: seedStr, style, size, created_at: now });
if (list.length > 20) list = list.slice(0, 20);
fs.writeFileSync(indexPath, JSON.stringify(list, null, 2));

console.log(JSON.stringify({ seed: seedStr, style, size, svg_bytes: svg.length, created_at: now }));