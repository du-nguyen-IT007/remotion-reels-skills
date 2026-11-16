#!/usr/bin/env node
// Disk space for the reels workspace. Do not run it while a render is in progress.
//
// Media is kept per job: inputs in public/<job>/, outputs in exports/<job>/ (<job> = the job file's "name").
//
//   node clean.mjs --auto --keep=<job>     the standard run after every job (see below)
//   node clean.mjs                         remove scratch (Remotion temp bundles, out/), then print a media report
//   node clean.mjs --report                only print the media report, delete nothing
//   node clean.mjs --job=a,b               also remove the media of these jobs: public/<job>/ and exports/<job>/
//   node clean.mjs --older-than=30         also remove the media of every job untouched for 30+ days
//   node clean.mjs --max-gb=20             also remove media, oldest job first, until job folders fit in 20 GB:
//                                          inputs of every eligible job go before any outputs
//        add --inputs or --outputs         to limit --job / --older-than to public/<job>/ or exports/<job>/
//   node clean.mjs --cache                 also remove node_modules/.cache (webpack cache, rebuilt on the next render)
//   node clean.mjs ... --dry-run           show what would be removed and how big it is; delete nothing
//
// --auto = scratch + --older-than=$REELS_KEEP_DAYS (default 30) + --max-gb=$REELS_MAX_GB (default 20)
//          + --cache when the cache is over 1 GB.
// --keep=a,b protects jobs from every rule, and jobs changed in the last 24 hours are never removed by
// --older-than or --max-gb. Loose files directly in public/ or exports/, job files in jobs/ and node_modules
// itself are never removed. Every removal is printed, and appended to clean.log.

import { appendFileSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const list = (v) => (typeof v === "string" ? v.split(",").filter(Boolean) : []);
const num = (v, name) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) {
    console.error(`${name} must be a number >= 0, got ${v}`);
    process.exit(2);
  }
  return n;
};

const dry = !!flag("dry-run");
const reportOnly = !!flag("report");
const auto = !!flag("auto");
const PUBLIC = path.join(root, "public");
const EXPORTS = path.join(root, "exports");
const CACHE = path.join(root, "node_modules", ".cache");
const GB = 1024 ** 3;
const DAY = 86400e3;

const olderThan = flag("older-than") !== undefined ? num(flag("older-than"), "--older-than") : auto ? num(process.env.REELS_KEEP_DAYS ?? 30, "REELS_KEEP_DAYS") : undefined;
const maxGb = flag("max-gb") !== undefined ? num(flag("max-gb"), "--max-gb") : auto ? num(process.env.REELS_MAX_GB ?? 20, "REELS_MAX_GB") : undefined;
const keep = new Set(list(flag("keep")));
const named = list(flag("job"));
for (const j of [...keep, ...named]) {
  if (!/^[\w.-]+$/.test(j)) {
    console.error(`Not a job name: ${j}`);
    process.exit(2);
  }
}

// Size in bytes and newest modification time of a file or folder tree.
const scan = (p) => {
  const st = statSync(p, { throwIfNoEntry: false });
  if (!st) return { bytes: 0, mtime: 0 };
  if (!st.isDirectory()) return { bytes: st.size, mtime: st.mtimeMs };
  return readdirSync(p).reduce(
    (acc, f) => {
      const s = scan(path.join(p, f));
      return { bytes: acc.bytes + s.bytes, mtime: Math.max(acc.mtime, s.mtime) };
    },
    { bytes: 0, mtime: st.mtimeMs },
  );
};
const mb = (b) => `${(b / 1024 / 1024).toFixed(0)} MB`;
const dirs = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name) : []);
const looseFiles = (p) => (existsSync(p) ? readdirSync(p, { withFileTypes: true }).filter((d) => d.isFile() && !d.name.startsWith(".")).map((d) => d.name) : []);
const show = (p) => (p.startsWith(root) ? path.relative(root, p) : p);

const jobs = () =>
  [...new Set([...dirs(PUBLIC), ...dirs(EXPORTS)])].sort().map((j) => {
    const i = scan(path.join(PUBLIC, j)), o = scan(path.join(EXPORTS, j));
    return { j, i: i.bytes, o: o.bytes, mtime: Math.max(i.mtime, o.mtime) };
  });

// ---------- what to remove: [path, reason] ----------

const targets = new Map();
const add = (p, why) => existsSync(p) && !targets.has(p) && targets.set(p, why);

if (!reportOnly) {
  // Bundles and asset downloads Remotion writes to the OS temp folder. render.mjs removes its own bundle;
  // these are leftovers from crashed or older runs, Studio and the CLI.
  const tmp = os.tmpdir();
  for (const f of readdirSync(tmp)) {
    if (/^remotion-webpack-bundle-/.test(f) || /^remotion-v[\d.]+-assets/.test(f)) add(path.join(tmp, f), "scratch");
  }
  add(path.join(root, "out"), "scratch");
  if (flag("cache") || (auto && scan(CACHE).bytes > GB)) add(CACHE, "cache");

  const onlyIn = !!flag("inputs"), onlyOut = !!flag("outputs");
  const addJob = (j, why) => {
    if (keep.has(j)) return;
    if (!onlyOut) add(path.join(PUBLIC, j), why);
    if (!onlyIn) add(path.join(EXPORTS, j), why);
  };
  for (const j of named) addJob(j, "named");

  const all = jobs();
  const eligible = all.filter((r) => !keep.has(r.j) && Date.now() - r.mtime > DAY);
  if (olderThan !== undefined) {
    for (const r of eligible) if (Date.now() - r.mtime > olderThan * DAY) addJob(r.j, `older than ${olderThan} days`);
  }
  if (maxGb !== undefined) {
    let total = all.reduce((n, r) => n + (targets.has(path.join(PUBLIC, r.j)) ? 0 : r.i) + (targets.has(path.join(EXPORTS, r.j)) ? 0 : r.o), 0);
    const oldest = [...eligible].sort((a, b) => a.mtime - b.mtime);
    for (const [dir, key] of [[PUBLIC, "i"], [EXPORTS, "o"]]) {
      for (const r of oldest) {
        if (total <= maxGb * GB) break;
        const p = path.join(dir, r.j);
        if (r[key] > 0 && !targets.has(p)) {
          add(p, `over ${maxGb} GB budget`);
          total -= r[key];
        }
      }
    }
  }
}

let freed = 0;
const stamp = new Date().toISOString();
for (const [t, why] of targets) {
  const { bytes } = scan(t);
  freed += bytes;
  console.log(`${dry ? "would remove" : "removed"}  ${mb(bytes).padStart(8)}  ${show(t)}  (${why})`);
  if (!dry) {
    rmSync(t, { recursive: true, force: true });
    if (why !== "scratch") appendFileSync(path.join(root, "clean.log"), `${stamp}\tremoved\t${show(t)}\t${bytes}\t${why}\n`);
  }
}
if (!reportOnly) console.log(`${dry ? "would free" : "freed"}  ${mb(freed)}\n`);

// ---------- media report ----------

const rows = jobs();
console.log("media per job        inputs (public/)  outputs (exports/)  last change");
for (const r of rows) {
  const days = Math.floor((Date.now() - r.mtime) / DAY);
  const jobFile = existsSync(path.join(root, "jobs", `${r.j}.json`)) || existsSync(path.join(root, "jobs", "_local", `${r.j}.json`));
  console.log(`  ${r.j.padEnd(20)} ${mb(r.i).padStart(14)}  ${mb(r.o).padStart(18)}  ${String(days).padStart(5)} days ago${jobFile ? "" : "  (no job file)"}`);
}
for (const [dir, label] of [[PUBLIC, "public/"], [EXPORTS, "exports/"]]) {
  const files = looseFiles(dir);
  if (files.length) {
    const bytes = files.reduce((n, f) => n + scan(path.join(dir, f)).bytes, 0);
    console.log(`  loose files in ${label.padEnd(9)} ${mb(bytes).padStart(8)}  ${files.length} file(s), not in a job folder: ${files.slice(0, 5).join(", ")}${files.length > 5 ? ", ..." : ""}`);
  }
}
console.log(`  total in job folders ${mb(rows.reduce((n, r) => n + r.i + r.o, 0))}`);
