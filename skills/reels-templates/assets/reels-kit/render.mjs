#!/usr/bin/env node
// Render a job file with one of the templates.
//
//   node render.mjs jobs/my-ad.json                    every language in the job -> exports/<name>/
//   node render.mjs jobs/my-ad.json --lang=en,ja       only these languages
//   node render.mjs jobs/my-ad.json --still=0.5,6,12   QA stills (seconds) -> out/stills/, no video
//   node render.mjs jobs/my-ad.json --still=1 --guides stills with the safe-zone bands drawn on top
//   node render.mjs jobs/my-ad.json --out=some/dir     another output folder
//
// Job file: { "template", "name", "lang"?, "props", "i18n"?: { "<lang>": <partial props merged over props> } }
// The bundle is built once and reused for every language.

import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const root = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const jobPath = args.find((a) => !a.startsWith("--"));
const flag = (name) => {
  const hit = args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
if (!jobPath) {
  console.error("usage: node render.mjs <job.json> [--lang=en,ja] [--still=1,5] [--guides] [--out=dir]");
  process.exit(2);
}

const job = JSON.parse(readFileSync(jobPath, "utf8"));
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
// Objects merge key by key. Arrays of objects merge item by item (null keeps the base item); other arrays replace.
const merge = (base, over) => {
  if (over === undefined || over === null) return base;
  if (isObj(base) && isObj(over)) {
    const out = { ...base };
    for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
    return out;
  }
  if (Array.isArray(base) && Array.isArray(over) && over.some(isObj)) {
    return base.map((b, i) => merge(b, over[i])).concat(over.slice(base.length));
  }
  return over;
};

const baseLang = job.lang ?? "en";
const variants = { [baseLang]: job.props, ...Object.fromEntries(Object.entries(job.i18n ?? {}).map(([l, o]) => [l, merge(job.props, o)])) };
const stills = flag("still");
const wanted = typeof flag("lang") === "string" ? flag("lang").split(",") : stills ? [baseLang] : Object.keys(variants);
const unknown = wanted.filter((l) => !variants[l]);
if (unknown.length) {
  console.error(`No such language in ${jobPath}: ${unknown.join(", ")} (has: ${Object.keys(variants).join(", ")})`);
  process.exit(2);
}

// Every local "src" must exist in public/ before the slow part starts.
const missing = new Set();
const walk = (v) => {
  if (Array.isArray(v)) v.forEach(walk);
  else if (isObj(v)) {
    for (const [k, x] of Object.entries(v)) {
      if (k === "src" && typeof x === "string" && !/^https?:\/\//.test(x) && !existsSync(path.join(root, "public", x))) missing.add(x);
      else walk(x);
    }
  }
};
walk(Object.values(variants));
if (missing.size) {
  console.error(`Missing in public/: ${[...missing].join(", ")}`);
  process.exit(2);
}

// Outputs are grouped per job (exports/<name>/), so one job's videos can be found and removed together.
const outDir = path.resolve(root, typeof flag("out") === "string" ? flag("out") : stills ? "out/stills" : path.join("exports", job.name));
mkdirSync(outDir, { recursive: true });
const multi = Object.keys(variants).length > 1;
// The bundle is a temp folder with a copy of public/ in it. Delete it when done, or every run leaves one behind.
const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const dropBundle = () => rmSync(serveUrl, { recursive: true, force: true });
process.on("exit", dropBundle);
process.on("SIGINT", () => process.exit(130));

for (const lang of wanted) {
  // `_keys` tells the composition which props the job owns; everything else is dropped, not defaulted.
  const own = flag("guides") ? { ...variants[lang], _guides: true } : variants[lang];
  const inputProps = { ...own, _keys: Object.keys(own) };
  const composition = await selectComposition({ serveUrl, id: job.template, inputProps, logLevel: "error" });
  const base = `${job.name}${multi ? `_${lang}` : ""}`;
  const seconds = (composition.durationInFrames / composition.fps).toFixed(2);
  if (stills) {
    for (const t of String(stills).split(",").map(Number)) {
      const output = path.join(outDir, `${base}_${t}s${flag("guides") ? "_GUIDES" : ""}.jpg`);
      const frame = Math.min(composition.durationInFrames - 1, Math.round(t * composition.fps));
      await renderStill({ composition, serveUrl, output, frame, inputProps, imageFormat: "jpeg", jpegQuality: 80, scale: 0.5, logLevel: "error" });
      console.log(`still  ${path.relative(process.cwd(), output)}`);
    }
    continue;
  }
  const output = path.join(outDir, `${base}_1080x1920_60fps.mp4`);
  const t0 = Date.now();
  await renderMedia({
    composition,
    serveUrl,
    inputProps,
    codec: "h264",
    crf: 18,
    audioCodec: "aac",
    audioBitrate: "192k",
    outputLocation: output,
    logLevel: "error",
  });
  console.log(`video  ${path.relative(process.cwd(), output)}  ${seconds}s  (rendered in ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}
