#!/usr/bin/env node
// Footage tools: turn raw media into facts an agent can build a job from.
// The scripts measure (shots, speech, words, beats, crops); the agent looks at the sheets and frames and decides.
//
//   node footage.mjs scan <file|folder>... --job=<name> [--transcribe] [--lang=xx]
//        probe every media file, find shots and speech, draw a contact sheet per video,
//        and write out/footage/<name>/index.json. Sources are only read, never moved.
//   node footage.mjs transcribe <file> --job=<name> [--lang=xx]   word timestamps (local whisper.cpp)
//   node footage.mjs find "<phrase>" --job=<name>                 where a phrase is said, from the transcripts
//   node footage.mjs words <file> --job=<name> --start=<s> --duration=<s> [--speed=1]
//        the transcript of one clip, timed to the output: paste it into UgcCaptions `words`
//   node footage.mjs cut <file> --job=<name> [--noise=<dB>] [--min-silence=0.35] [--pad=0.08]
//        remove silences: writes public/<name>/<base>.cut.mp4 (jump cut) and remaps its words
//   node footage.mjs frames <file> --job=<name> (--at=1,4.5 | --every=2)
//        full frames with a percent grid, to read where the subject is
//   node footage.mjs reframe <file> --job=<name> --subject=<x>,<y> [--at=1,4.5]
//        the clip `focus` that keeps the subject (percent of the source frame) in a 9:16 crop, plus preview stills
//   node footage.mjs beats <audio|video> --job=<name>            tempo and beat times, for cutting on the beat
//
// Every command prints JSON on stdout (progress goes to stderr) and keeps its files in out/footage/<name>/.
// Transcription installs whisper.cpp and a model into .whisper/ on first use (needs git, make, cmake, a C compiler).
// REELS_WHISPER_MODEL picks the model (default small), REELS_WHISPER_CPP the whisper.cpp version (default 1.7.6).

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const flag = (name) => {
  const hit = argv.find((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  return hit === undefined ? undefined : hit.includes("=") ? hit.slice(hit.indexOf("=") + 1) : true;
};
const positional = argv.filter((a) => !a.startsWith("--"));
const [cmd, ...args] = positional;

const fail = (msg, code = 2) => {
  console.error(msg);
  process.exit(code);
};
const num = (v, name, def) => {
  if (v === undefined) return def;
  const n = Number(v);
  if (!Number.isFinite(n)) fail(`${name} must be a number, got ${v}`);
  return n;
};
const nums = (v) => (typeof v === "string" ? v.split(",").map(Number).filter(Number.isFinite) : []);
const r2 = (x) => Math.round(x * 100) / 100;
const r3 = (x) => Math.round(x * 1000) / 1000;
const log = (...a) => console.error(...a);
const print = (o) => console.log(JSON.stringify(o, null, 2));

const job = flag("job");
if (cmd && cmd !== "help" && (typeof job !== "string" || !/^[\w.-]+$/.test(job))) fail("Pass --job=<name> (letters, digits, . _ -).");
const OUT = job ? path.join(root, "out", "footage", job) : "";
const INDEX = OUT && path.join(OUT, "index.json");

// ---------- ffmpeg helpers ----------

const run = (bin, a, { input } = {}) => {
  const r = spawnSync(bin, a, { encoding: input === "buffer" ? "buffer" : "utf8", maxBuffer: 1 << 30 });
  if (r.error) fail(`${bin} not found or failed to start: ${r.error.message}`, 3);
  return r;
};
const ffmpegLog = (a) => {
  const r = run("ffmpeg", ["-hide_banner", "-nostats", ...a]);
  return { ok: r.status === 0, err: r.stderr };
};
const ffmpegDo = (a, what) => {
  const r = ffmpegLog(["-y", "-loglevel", "error", ...a]);
  if (!r.ok) fail(`ffmpeg failed (${what}):\n${r.err.slice(-1500)}`, 1);
};

// Resolve a media argument: an existing path, or a path inside public/.
const media = (p) => {
  if (!p) fail("Missing <file>.");
  for (const c of [p, path.join(root, "public", p)]) if (existsSync(c) && statSync(c).isFile()) return path.resolve(c);
  fail(`No such file: ${p}`);
};

const probe = (file) => {
  const r = run("ffprobe", ["-v", "error", "-print_format", "json", "-show_format", "-show_streams", file]);
  if (r.status !== 0) return null;
  const j = JSON.parse(r.stdout);
  const v = j.streams.find((s) => s.codec_type === "video" && !s.disposition?.attached_pic);
  const a = j.streams.find((s) => s.codec_type === "audio");
  const duration = Number(j.format.duration) || 0;
  const still = !!v && (/^(png|mjpeg|webp|bmp|tiff|gif)$/.test(v.codec_name) && (duration === 0 || Number(v.nb_frames) <= 1 || /image2|png_pipe|jpeg_pipe|webp_pipe/.test(j.format.format_name)));
  let width = v?.width, height = v?.height;
  const rot = Math.abs(Number(v?.side_data_list?.find((s) => s.rotation !== undefined)?.rotation ?? v?.tags?.rotate ?? 0));
  if (rot === 90 || rot === 270) [width, height] = [height, width];
  const [fn, fd] = (v?.avg_frame_rate || "0/1").split("/").map(Number);
  return {
    kind: !v ? (a ? "audio" : "other") : still ? "image" : "video",
    duration: r2(duration),
    width,
    height,
    fps: fd ? r2(fn / fd) : undefined,
    audio: !!a,
  };
};

// Scene cuts (scdet on a small copy of the picture).
const shots = (file, duration) => {
  const { err } = ffmpegLog(["-i", file, "-an", "-vf", "scale=320:-2,scdet=threshold=12", "-f", "null", "-"]);
  const cuts = [...err.matchAll(/lavfi\.scd\.time:\s*([\d.]+)/g)].map((m) => Number(m[1])).filter((t) => t > 0.2 && t < duration - 0.2);
  const edges = [0, ...cuts, duration];
  return edges.slice(1).map((e, i) => [r2(edges[i]), r2(e)]).filter(([s, e]) => e - s > 0.1);
};

// Loud parts of the audio: speech or sound, as [start, end] pairs. The threshold follows the file's own level.
const loudness = (file) => {
  const { err } = ffmpegLog(["-i", file, "-vn", "-af", "volumedetect", "-f", "null", "-"]);
  const mean = Number(err.match(/mean_volume:\s*(-?[\d.]+)/)?.[1] ?? -30);
  return Math.max(-50, Math.min(-25, Math.round(mean - 14)));
};
const speech = (file, duration, { noise, minSilence = 0.35 } = {}) => {
  const db = noise ?? loudness(file);
  const { err } = ffmpegLog(["-i", file, "-vn", "-af", `silencedetect=noise=${db}dB:d=${minSilence}`, "-f", "null", "-"]);
  const starts = [...err.matchAll(/silence_start:\s*(-?[\d.]+)/g)].map((m) => Math.max(0, Number(m[1])));
  const ends = [...err.matchAll(/silence_end:\s*([\d.]+)/g)].map((m) => Number(m[1]));
  const out = [];
  let t = 0;
  starts.forEach((s, i) => {
    if (s - t > 0.05) out.push([r2(t), r2(s)]);
    t = ends[i] ?? duration;
  });
  if (duration - t > 0.05) out.push([r2(t), r2(duration)]);
  return { db, segments: out };
};

const label = (text) => `drawtext=text='${text}':x=10:y=10:fontsize=h/14:fontcolor=white:box=1:boxcolor=black@0.65:boxborderw=6`;

// One frame at time t, scaled to `width`, optionally with extra filters. Retries without text if drawtext is unavailable.
const grab = (file, t, out, width, filters = []) => {
  const vf = (f) => [`scale=${width}:-2`, ...f].join(",");
  const a = (f) => ["-ss", String(t), "-i", file, "-frames:v", "1", "-vf", vf(f), "-q:v", "3", out];
  const r = ffmpegLog(["-y", "-loglevel", "error", ...a(filters)]);
  if (!r.ok) ffmpegDo(a(filters.filter((f) => !f.startsWith("drawtext"))), `frame at ${t}s`);
};

// Contact sheet: one tile per shot (middle frame), padded with evenly spaced frames, at most 12, labelled with the time.
const sheet = (file, info, cuts, dest) => {
  // Tiles at least `gap` apart, so a short shot next to a long one does not give two near-identical frames.
  const times = cuts.length > 1 ? cuts.map(([s, e]) => r2((s + e) / 2)).slice(0, 12) : [];
  const want = Math.min(12, Math.max(6, times.length));
  const gap = info.duration / (want * 2);
  for (let k = want * 2, i = 0; times.length < want && i < k; i++) {
    const t = r2(((i + 0.5) / k) * info.duration);
    if (times.every((x) => Math.abs(x - t) >= gap)) times.push(t);
  }
  times.sort((a, b) => a - b);
  const tmp = path.join(OUT, "tmp", path.basename(dest, ".jpg"));
  rmSync(tmp, { recursive: true, force: true });
  mkdirSync(tmp, { recursive: true });
  const w = info.width >= info.height ? 480 : 270;
  times.forEach((t, i) => grab(file, Math.min(t, Math.max(0, info.duration - 0.05)), path.join(tmp, `${String(i).padStart(2, "0")}.jpg`), w, [label(`${t}s`)]));
  const cols = info.width >= info.height ? 3 : 4;
  const rows = Math.ceil(times.length / cols);
  ffmpegDo(["-framerate", "1", "-i", path.join(tmp, "%02d.jpg"), "-vf", `tile=${cols}x${rows}:padding=6:margin=6:color=white`, "-frames:v", "1", "-q:v", "3", dest], "contact sheet");
  rmSync(tmp, { recursive: true, force: true });
  return times;
};

// ---------- index ----------

const keyOf = (file) => `${path.basename(file)}|${statSync(file).size}`; // survives copying the file into public/
const loadIndex = () => (existsSync(INDEX) ? JSON.parse(readFileSync(INDEX, "utf8")) : { job, files: {} });
const saveIndex = (ix) => {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(INDEX, JSON.stringify(ix, null, 2));
};
const entry = (ix, file) => ix.files[keyOf(file)];

const MEDIA_EXT = /\.(mp4|mov|m4v|mkv|webm|avi|mts|m4a|mp3|wav|aac|flac|ogg|jpe?g|png|webp|heic)$/i;
const expand = (paths) =>
  paths.flatMap((p) => {
    const abs = path.resolve(p);
    if (!existsSync(abs)) fail(`No such file or folder: ${p}`);
    if (!statSync(abs).isDirectory()) return [abs];
    return readdirSync(abs, { recursive: true })
      .map((f) => path.join(abs, String(f)))
      .filter((f) => MEDIA_EXT.test(f) && statSync(f).isFile() && !path.basename(f).startsWith("."))
      .sort();
  });

// ---------- whisper ----------

const WHISPER_DIR = path.join(root, ".whisper");
const whisperVersion = process.env.REELS_WHISPER_CPP || "1.7.6";
const whisperModel = process.env.REELS_WHISPER_MODEL || "small";

const ensureWhisper = async () => {
  let w;
  try {
    w = await import("@remotion/install-whisper-cpp");
  } catch {
    fail("@remotion/install-whisper-cpp is not installed. Run `npm install` in this folder.", 3);
  }
  const to = path.join(WHISPER_DIR, `whisper.cpp-${whisperVersion}`);
  if (!existsSync(w.getWhisperExecutablePath?.(to, whisperVersion) ?? path.join(to, "build", "bin", "whisper-cli"))) {
    const missing = ["git", "make", "cmake", "cc"].filter((b) => spawnSync(b, ["--version"]).error);
    if (missing.length) fail(`Transcription needs ${missing.join(", ")} to build whisper.cpp once. Install them, or pass word timings yourself.`, 3);
    log(`installing whisper.cpp ${whisperVersion} into .whisper/ (one time, a few minutes)`);
    rmSync(to, { recursive: true, force: true });
    await w.installWhisperCpp({ version: whisperVersion, to, printOutput: false });
  }
  const models = path.join(WHISPER_DIR, "models");
  await w.downloadWhisperModel({ model: whisperModel, folder: models, printOutput: false });
  return { w, to, models };
};

const transcribeFile = async (file, lang) => {
  const { w, to, models } = await ensureWhisper();
  mkdirSync(path.join(OUT, "tmp"), { recursive: true });
  const wav = path.join(OUT, "tmp", `${path.basename(file)}.16k.wav`);
  ffmpegDo(["-i", file, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", wav], "audio to 16 kHz wav");
  log(`transcribing ${path.basename(file)} with whisper ${whisperModel}`);
  const json = await w.transcribe({
    inputPath: wav,
    whisperPath: to,
    whisperCppVersion: whisperVersion,
    model: whisperModel,
    modelFolder: models,
    tokenLevelTimestamps: true,
    splitOnWord: true,
    language: lang && lang !== true ? lang : "auto",
    printOutput: false,
  });
  rmSync(wav, { force: true });
  const { captions } = w.toCaptions({ whisperCppOutput: json });
  const words = captions
    .map((c) => ({ text: c.text.trim(), start: r3(c.startMs / 1000), end: r3(c.endMs / 1000), p: c.confidence == null ? undefined : r2(c.confidence) }))
    .filter((c) => c.text && !/^\[.*\]$/.test(c.text));
  return { lang: json.result?.language, words };
};

// ---------- commands ----------

const commands = {
  async scan() {
    const files = expand(args);
    if (!files.length) fail("scan: pass one or more files or folders.");
    const ix = loadIndex();
    mkdirSync(path.join(OUT, "sheets"), { recursive: true });
    const summary = [];
    for (const file of files) {
      const info = probe(file);
      if (!info || info.kind === "other") {
        log(`skip ${file}: not readable media`);
        continue;
      }
      const key = keyOf(file);
      const prev = ix.files[key];
      const e = { path: file, ...info };
      log(`scan ${path.basename(file)} (${info.kind}, ${info.duration}s)`);
      if (info.kind === "video") {
        e.shots = shots(file, info.duration);
        const name = `${path.basename(file).replace(/[^\w.-]/g, "_")}.jpg`;
        e.sheet = { file: path.join(OUT, "sheets", name), times: sheet(file, info, e.shots, path.join(OUT, "sheets", name)) };
      }
      if (info.audio && info.duration > 0) {
        const s = speech(file, info.duration);
        e.sound = s.segments;
        e.soundThresholdDb = s.db;
      }
      if (prev?.words) Object.assign(e, { words: prev.words, lang: prev.lang });
      if (flag("transcribe") && info.audio && !e.words) Object.assign(e, await transcribeFile(file, flag("lang")));
      if (prev?.notes) e.notes = prev.notes;
      ix.files[key] = e;
      saveIndex(ix);
      summary.push({
        file,
        kind: e.kind,
        duration: e.duration,
        size: e.width ? `${e.width}x${e.height}` : undefined,
        shots: e.shots?.length,
        soundSeconds: e.sound ? r2(e.sound.reduce((n, [s, t]) => n + t - s, 0)) : undefined,
        words: e.words?.length,
        sheet: e.sheet?.file,
      });
    }
    print({ index: INDEX, files: summary });
  },

  async transcribe() {
    const file = media(args[0]);
    const info = probe(file);
    if (!info?.audio) fail(`${file} has no audio track.`, 1);
    const ix = loadIndex();
    const e = entry(ix, file) ?? { path: file, ...info };
    Object.assign(e, await transcribeFile(file, flag("lang")));
    ix.files[keyOf(file)] = e;
    saveIndex(ix);
    print({ file, lang: e.lang, words: e.words.length, text: e.words.map((w) => w.text).join(" ") });
  },

  find() {
    const q = args.join(" ").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").split(/\s+/).filter(Boolean);
    if (!q.length) fail('find: pass a phrase, for example find "best gift ever" --job=<name>.');
    const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
    const hits = [];
    for (const e of Object.values(loadIndex().files)) {
      const ws = e.words ?? [];
      for (let i = 0; i < ws.length; i++) {
        let k = 0, j = i;
        // Words in order, allowing one filler word between them.
        while (j < ws.length && k < q.length && j - i < q.length * 2) {
          if (norm(ws[j].text).includes(q[k]) || q[k].includes(norm(ws[j].text) || "\0")) k++;
          else if (k === 0) break;
          j++;
        }
        if (k === q.length) hits.push({ file: e.path, start: ws[i].start, end: ws[j - 1].end, said: ws.slice(i, j).map((w) => w.text).join(" ") });
      }
    }
    print({ query: args.join(" "), hits });
  },

  words() {
    const file = media(args[0]);
    const e = entry(loadIndex(), file);
    if (!e?.words) fail(`No transcript for ${path.basename(file)} in job ${job}. Run transcribe (or scan --transcribe) first.`, 1);
    const start = num(flag("start"), "--start", 0);
    const speed = num(flag("speed"), "--speed", 1);
    const dur = num(flag("duration"), "--duration", (e.duration - start) / speed);
    const end = start + dur * speed;
    const words = e.words
      .filter((w) => (w.start + w.end) / 2 >= start && (w.start + w.end) / 2 < end) // a word belongs to the clip that holds its middle
      .map((w) => ({ text: w.text, start: r2(Math.max(0, (w.start - start) / speed)), end: r2(Math.min(dur, (w.end - start) / speed)) }));
    print({ clip: { src: path.relative(path.join(root, "public"), file), start, duration: r2(dur), ...(speed !== 1 ? { speed } : {}) }, words });
  },

  async cut() {
    const file = media(args[0]);
    const info = probe(file);
    if (!info?.audio) fail(`${file} has no audio, so there is no silence to cut.`, 1);
    const pad = num(flag("pad"), "--pad", 0.08);
    const s = speech(file, info.duration, { noise: flag("noise") === undefined ? undefined : num(flag("noise"), "--noise"), minSilence: num(flag("min-silence"), "--min-silence", 0.35) });
    // Pad each part, then merge parts that touch.
    const parts = [];
    for (const [a, b] of s.segments) {
      const seg = [Math.max(0, a - pad), Math.min(info.duration, b + pad)];
      const last = parts[parts.length - 1];
      if (last && seg[0] <= last[1] + 0.05) last[1] = seg[1];
      else parts.push(seg);
    }
    if (!parts.length) fail(`No sound above ${s.db} dB in ${path.basename(file)}. Try a lower --noise.`, 1);
    const dest = path.join(root, "public", job, `${path.basename(file, path.extname(file))}.cut.mp4`);
    if (path.resolve(dest) === file) fail("The input is already a .cut.mp4 in this job; cut the original instead.");
    mkdirSync(path.dirname(dest), { recursive: true });
    const hasV = info.kind === "video";
    const chains = parts.map(([a, b], i) => [
      hasV ? `[0:v]trim=start=${r3(a)}:end=${r3(b)},setpts=PTS-STARTPTS[v${i}]` : null,
      `[0:a]atrim=start=${r3(a)}:end=${r3(b)},asetpts=PTS-STARTPTS[a${i}]`,
    ]).flat().filter(Boolean);
    const ins = parts.map((_, i) => `${hasV ? `[v${i}]` : ""}[a${i}]`).join("");
    const graph = `${chains.join(";")};${ins}concat=n=${parts.length}:v=${hasV ? 1 : 0}:a=1${hasV ? "[v]" : ""}[a]`;
    log(`cut ${path.basename(file)}: keeping ${parts.length} parts`);
    ffmpegDo(["-i", file, "-filter_complex", graph, ...(hasV ? ["-map", "[v]", "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-pix_fmt", "yuv420p"] : []), "-map", "[a]", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dest], "jump cut");

    // Segment map, and the source transcript moved onto the cut timeline.
    let t = 0;
    const map = parts.map(([a, b]) => {
      const m = { from: r3(a), to: r3(b), at: r3(t) };
      t += b - a;
      return m;
    });
    const ix = loadIndex();
    const src = entry(ix, file);
    const cutInfo = probe(dest);
    const e = { path: dest, ...cutInfo, cutFrom: file, segments: map };
    if (src?.words) {
      e.lang = src.lang;
      e.words = src.words.flatMap((w) => {
        // The kept part the word overlaps most; words entirely inside a removed silence are dropped.
        const ov = (x) => Math.min(w.end, x.to) - Math.max(w.start, x.from);
        const m = map.reduce((b, x) => (ov(x) > (b ? ov(b) : 0) ? x : b), null);
        if (!m) return [];
        return [{ text: w.text, start: r3(Math.max(m.at, w.start - m.from + m.at)), end: r3(Math.min(m.at + m.to - m.from, w.end - m.from + m.at)) }];
      });
    }
    ix.files[keyOf(dest)] = e;
    saveIndex(ix);
    print({
      output: dest,
      src: path.relative(path.join(root, "public"), dest),
      before: info.duration,
      after: cutInfo?.duration,
      removed: r2(info.duration - (cutInfo?.duration ?? 0)),
      parts: map.length,
      thresholdDb: s.db,
      words: e.words ? e.words.length : "none: transcribe the source first, or transcribe the cut file",
    });
  },

  frames() {
    const file = media(args[0]);
    const info = probe(file);
    if (!info || info.kind === "audio") fail(`${file} has no picture.`, 1);
    const every = num(flag("every"), "--every");
    const times = every ? Array.from({ length: Math.max(1, Math.floor(info.duration / every)) }, (_, i) => r2(i * every + every / 2)) : nums(flag("at"));
    if (!times.length) fail("frames: pass --at=1,4.5 or --every=2.");
    const dir = path.join(OUT, "frames");
    mkdirSync(dir, { recursive: true });
    // Grid every 10 % with the percent written on the lines, so the subject's position can be read off the image.
    const grid = ["drawgrid=w=iw/10:h=ih/10:t=1:c=white@0.45"];
    for (let p = 10; p < 100; p += 10) {
      grid.push(`drawtext=text='${p}':x=w*${p / 100}+4:y=4:fontsize=h/40:fontcolor=yellow:box=1:boxcolor=black@0.5`);
      grid.push(`drawtext=text='${p}':x=4:y=h*${p / 100}+4:fontsize=h/40:fontcolor=yellow:box=1:boxcolor=black@0.5`);
    }
    const out = times.map((t) => {
      const f = path.join(dir, `${path.basename(file).replace(/[^\w.-]/g, "_")}@${t}s.jpg`);
      grab(file, Math.min(t, Math.max(0, info.duration - 0.05)), f, info.width >= info.height ? 1280 : 720, [...grid, label(`${t}s`).replace("x=10:y=10", "x=w-tw-14:y=h-th-14")]);
      return { t, file: f };
    });
    print({ file, size: `${info.width}x${info.height}`, frames: out, read: "Grid lines are every 10 % of width and height. Give positions as x,y percent of the frame." });
  },

  reframe() {
    const file = media(args[0]);
    const info = probe(file);
    if (!info?.width) fail(`${file} has no picture.`, 1);
    const [sx, sy] = nums(flag("subject"));
    if (!Number.isFinite(sx) || !Number.isFinite(sy)) fail("reframe: pass --subject=<x>,<y>, the subject's centre in percent of the source frame (read it from `frames`).");
    // The kit fills 1080x1920 with object-fit: cover and uses `focus` as object-position.
    // Visible part along the cropped axis: f = 9:16 / source aspect (or its inverse). The subject at u is centred when
    // the window starts at u - f/2, which is object-position p = (u - f/2) / (1 - f).
    const aspect = info.width / info.height, target = 9 / 16;
    const pos = (u, f) => (f >= 0.999 ? 50 : Math.round(Math.max(0, Math.min(1, (u / 100 - f / 2) / (1 - f))) * 100));
    const fx = aspect > target ? target / aspect : 1;
    const fy = aspect < target ? aspect / target : 1;
    const px = pos(sx, fx), py = pos(sy, fy);
    const focus = `${px}% ${py}%`;
    const dir = path.join(OUT, "reframe");
    mkdirSync(dir, { recursive: true });
    const cw = `iw*${r3(fx)}`, ch = `ih*${r3(fy)}`;
    const crop = `crop=${cw}:${ch}:(iw-${cw})*${px / 100}:(ih-${ch})*${py / 100}`;
    const times = info.kind === "image" ? [0] : nums(flag("at")).length ? nums(flag("at")) : [r2(info.duration / 2)];
    const previews = times.map((t) => {
      const f = path.join(dir, `${path.basename(file).replace(/[^\w.-]/g, "_")}@${t}s.jpg`);
      const a = ["-ss", String(t), "-i", file, "-frames:v", "1", "-vf", `${crop},scale=540:960:force_original_aspect_ratio=increase,crop=540:960`, "-q:v", "3", f];
      ffmpegDo(a, `preview at ${t}s`);
      return f;
    });
    const visible = fx < 1 ? `${Math.round(fx * 100)} % of the width` : fy < 1 ? `${Math.round(fy * 100)} % of the height` : "the whole frame";
    print({
      file,
      focus,
      visible,
      previews,
      note: "Set the clip's focus to this value. It frames the subject only on clips without zoom, tilt or push; with a camera move, focus is the move's centre instead.",
    });
  },

  beats() {
    const file = media(args[0]);
    const sr = 11025, hop = 256;
    const r = run("ffmpeg", ["-hide_banner", "-loglevel", "error", "-i", file, "-t", "240", "-vn", "-ac", "1", "-ar", String(sr), "-f", "f32le", "-"], { input: "buffer" });
    if (r.status !== 0 || !r.stdout?.length) fail(`Could not decode audio from ${file}.`, 1);
    const pcm = new Float32Array(r.stdout.buffer, r.stdout.byteOffset, Math.floor(r.stdout.length / 4));
    const fps = sr / hop;
    // Onset strength: rise in log energy, frame by frame.
    const n = Math.floor(pcm.length / hop);
    const energy = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0;
      for (let j = i * hop; j < (i + 1) * hop; j++) s += pcm[j] * pcm[j];
      energy[i] = Math.log10(1e-9 + s / hop);
    }
    const onset = new Float32Array(n);
    for (let i = 1; i < n; i++) onset[i] = Math.max(0, energy[i] - energy[i - 1]);
    const mean = onset.reduce((a, b) => a + b, 0) / n;
    for (let i = 0; i < n; i++) onset[i] = Math.max(0, onset[i] - mean);
    // Tempo: autocorrelation over 70-180 BPM, weighted toward 120 BPM.
    let best = { score: -1, lag: 0 };
    const scores = [];
    for (let bpm = 70; bpm <= 180; bpm += 0.5) {
      const lag = (60 / bpm) * fps;
      let s = 0;
      for (let i = 0; i + lag < n; i++) {
        const k = i + lag, k0 = Math.floor(k), fr = k - k0;
        s += onset[i] * (onset[k0] * (1 - fr) + (onset[k0 + 1] ?? 0) * fr);
      }
      s *= Math.exp(-0.5 * Math.log2(bpm / 120) ** 2 / 0.6 ** 2);
      scores.push(s);
      if (s > best.score) best = { score: s, lag, bpm };
    }
    const sorted = [...scores].sort((a, b) => b - a);
    const confidence = r2(1 - (sorted[Math.min(20, sorted.length - 1)] / sorted[0] || 0));
    // Phase: the offset whose beat grid lands on the most onset energy.
    let phase = { score: -1, at: 0 };
    for (let o = 0; o < best.lag; o += 0.25) {
      let s = 0;
      for (let k = o; k < n; k += best.lag) s += onset[Math.round(k)] ?? 0;
      if (s > phase.score) phase = { score: s, at: o };
    }
    // Refine: snap each grid beat to the strongest onset within 70 ms, then fit a straight line through the
    // snapped beats. This corrects the coarse tempo step and the phase, so the grid does not drift.
    const w = Math.round(0.07 * fps);
    const pts = [];
    for (let k = phase.at, i = 0; k < n; k += best.lag, i++) {
      let bj = -1, bv = 0;
      for (let j = Math.max(0, Math.round(k) - w); j <= Math.min(n - 1, Math.round(k) + w); j++) if (onset[j] > bv) [bj, bv] = [j, onset[j]];
      if (bj >= 0) pts.push([i, bj]);
    }
    let lag = best.lag, at = phase.at;
    if (pts.length >= 4) {
      const mx = pts.reduce((s, p) => s + p[0], 0) / pts.length, my = pts.reduce((s, p) => s + p[1], 0) / pts.length;
      const sxy = pts.reduce((s, p) => s + (p[0] - mx) * (p[1] - my), 0), sxx = pts.reduce((s, p) => s + (p[0] - mx) ** 2, 0);
      lag = sxy / sxx;
      at = my - lag * mx;
      while (at - lag >= 0) at -= lag;
    }
    const beats = [];
    for (let k = at; k < n; k += lag) if (k >= 0) beats.push(r2(k / fps));
    const bpm = Math.round((60 * fps / lag) * 10) / 10;
    print({
      file,
      bpm,
      beatSeconds: r3(60 / bpm),
      confidence,
      beats,
      every4: beats.filter((_, i) => i % 4 === 0),
      note: "Estimated from loudness onsets. Clip durations that add up to beat times cut on the beat. every4 starts at the first beat found, not at a verified downbeat. Below 0.3 confidence, prefer even cuts.",
    });
  },
};

if (!cmd || cmd === "help" || !commands[cmd]) {
  const head = readFileSync(fileURLToPath(import.meta.url), "utf8").split("\n").filter((l) => l.startsWith("//")).map((l) => l.slice(3));
  console.log(head.join("\n"));
  process.exit(cmd && cmd !== "help" ? 2 : 0);
}
await commands[cmd]();
