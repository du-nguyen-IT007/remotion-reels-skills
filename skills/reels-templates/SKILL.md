---
name: reels-templates
description: 'One-shot a 9:16 Reels / TikTok ad from footage, photos or a brief using fifteen ready-made Remotion templates bundled with this skill: social-native formats (text-message story, notes-app list, search bar, lock-screen notifications, polaroid photo dump, blind ranking, poll sticker) and ad formats (beat-cut montage, UGC with word captions, listicle, before/after, product slideshow, testimonials, comment reply, sale promo). Use when the user asks to make, dựng, edit or render a short vertical video or ad ("dựng video", "làm reels", "tạo video quảng cáo", "oneshot video", "render đa ngôn ngữ"), or to add a new template to the set.'
---

# Reels templates

Fifteen data-driven Remotion templates (1080x1920, 60 fps) ship with this skill in `assets/reels-kit/`. A video is one JSON job file: pick a template, fill its props, render. You do not write React for a normal job.

Paths below that start with `reels/` are in the working folder, not in this skill. Never edit files inside the skill folder for a job.

**Runs unattended.** This skill is built for autonomous agents. The *requester* is whoever started the job: an orchestrating agent, a pipeline or a person. Make every decision with the rules in this file and never stop to ask for approval of a step. Stop only on a blocker you cannot resolve (a missing tool, missing or unreadable media, a render that keeps failing), and report it. Every job ends with a report (section 4).

## 0. Set up the workspace

Do this once per project, before the first job.

1. Check the tools: Node.js 18 or newer (`node -v`), and `ffmpeg` and `ffprobe` on the PATH. If one is missing, stop and report it as a blocker. Do not install system software yourself.
2. If the working folder already has `reels/render.mjs`, use that workspace and skip to section 1.
3. Otherwise copy this skill's `assets/reels-kit/` folder to `reels/` in the working folder (for example `cp -R <skill-dir>/assets/reels-kit reels`), then run `npm install` inside `reels/`.
4. Make the folders `reels/public/` (media) and `reels/jobs/_local/` (scratch jobs). If the working folder is a git repo, add `reels/node_modules/`, `reels/public/`, `reels/out/`, `reels/exports/` and `reels/jobs/_local/` to its `.gitignore`.

The workspace has `render.mjs` (renders a job), `clean.mjs` (frees disk space, see section 6), `src/` (templates and the shared kit), `jobs/examples/` (one example job per template), `public/<name>/` (each job's input media), `out/stills/` (QA stills) and `exports/<name>/` (each job's finished videos).

## Preferences

This repo holds no one's taste. Text style, font, accent colour, tone of the copy, languages, music and which format to lead with come from the requester's brief and from what you already know about the brand, never from a value written into the templates or this file. When the brief states a preference, apply it in the job file. When it does not, use the template defaults and list them in the report. Do not write a person's or a brand's preference into the templates, the example jobs or this skill.

## 1. Pick the template

Start with the social-native set when the video should feel like something a person posted. Use the ad set when the footage itself carries the video.

**Social-native** (an interface the viewer already knows is the hook)

| Template | Use it when | Needs |
| --- | --- | --- |
| `ChatStory` | A story told as a text-message thread, then the product reveal | Messages (+ a product photo to send), payoff clips |
| `NotesList` | A notes-app list that types itself: "gifts that flopped vs the one she kept" | Title + 1 to 7 lines, payoff clips |
| `SearchHook` | The customer's question typed into a search bar, answered by the footage | A query (+ suggestions), 1+ clips |
| `NotificationStack` | Lock screen filling with orders, messages, reviews: social proof and FOMO | 1 to 6 notifications, background, payoff clips |
| `PolaroidDump` | Scrapbook photo dump with handwritten captions | 2 to 8 photos |
| `Ranking` | Blind ranking: items drop into a numbered list, #1 last | 2 to 6 clips, a label and rank each |
| `PollSticker` | A story poll over footage: two options, a tap, the result | A question, 2 options with percents, clips |

**Ad formats** (footage first, text on top)

| Template | Use it when | Needs |
| --- | --- | --- |
| `BeatCutAd` | Default for a product ad cut from footage: several shots, hook, CTA | 1+ video clips |
| `UgcCaptions` | A person talks to camera; word-by-word captions | 1 clip with speech + word timings |
| `Listicle` | "3 reasons why", tips, features, steps | 2 to 7 clips, one per point |
| `BeforeAfter` | A transformation or comparison (`mode`: `wipe` or `split`) | 2 clips or photos |
| `ProductSlideshow` | Only product photos exist, or a quick catalogue; optional price sticker | 2+ photos or clips |
| `Testimonial` | Social proof: review cards with stars | 1 background clip + review texts |
| `CommentReply` | Answering an objection or FAQ; the comment bubble is the hook | 1+ clips + the comment |
| `OfferPromo` | Sale, discount code, deadline | 1+ clips + the offer |

If the brief fits none of them, see section 7. Do not bend a template into something it is not.

The official Remotion skill (`remotion-best-practices`, installed separately with `npx skills add remotion-dev/skills --skill remotion-best-practices`) is the reference for writing Remotion code. If it is not installed, use the Remotion docs at https://www.remotion.dev/docs instead. For making a video in this repo, this skill wins where they differ: build a job file instead of a new project or composition, check stills instead of opening Studio, and render with `render.mjs` once the stills pass, without waiting to be asked.

## 2. Build the job

1. Choose the job name (lowercase, digits and `-`, for example `xmas-ornament`). It is the job file's `name`, the input folder `reels/public/<name>/` and the output folder `reels/exports/<name>/`. Copy only the files this job uses into `reels/public/<name>/`, and leave the originals where they are. Note in the report where each input came from, and whether the copy in `public/` is the only one (downloaded or generated files). Write each `src` as `<name>/<file>`. Run `ffprobe` on each file for its length. Media is never committed: `public/` is git-ignored, so the paths in the example jobs (`footage.mp4`, `music.m4a`, `demo/…`) are placeholders until you put your own files there.
2. Look at the footage before placing text: extract a frame per shot (`ffmpeg -ss <t> -i <file> -frames:v 1`) and note where the product sits.
3. Read `reels/jobs/examples/<Template>.json`. It lists every prop that template takes. Copy it to `reels/jobs/<job>.json` and edit. Use `reels/jobs/_local/` for a job that should stay out of git.

Job file:

```json
{ "template": "BeatCutAd", "name": "xmas-ornament", "lang": "en",
  "props": { },
  "i18n": { "ja": { "hook": { "lines": ["…", "…"] }, "cta": { "lines": ["…"], "button": "…" } } } }
```

`i18n.<lang>` is merged over `props`, so it holds only the translated strings. Arrays of objects merge item by item (`null` keeps the base item); arrays of strings replace.

Props every template shares:

- `hook`: `{ lines (1-3), band, size, duration }`. Shown from 0 s, default 2.2 s.
- `cta`: `{ lines, button, band, size, duration }`. Shown for the last `duration` seconds, default 2.5. Other captions end when it starts.
- `music`: `{ src, volume }`. Fades out at the end. Use about 0.15 under speech.
- `brand`: `{ accent (hex), font: poppins | montserrat | anton, textStyle: outline | box | caption }`. `outline` (the default) and `box` are loud ad styles. `caption` is the native in-app caption look: white sentence-case text in one dark rounded box, at the top of its band, fading in; write it as a first-person story line, 2 lines of up to 30 characters.
- A clip: `{ src, start (s into the source), duration (s on screen), speed, focus (center | top | bottom | "50% 30%"), transition (cut | flash | zoom | whip | focus) }`. `transition` is how that clip arrives.

A clip also takes a simulated camera: `zoom` (1-2.5, punch-in that keeps the `focus` point in place), `tilt` (degrees, -15 to 15, a dutch angle) and `push` (0-0.6, the camera lunges in with a short blur as the clip arrives, then settles).

A prop the job leaves out is off: a job without `hook` has no hook, whatever the example shows.

`src` is a path inside `public/` or an https URL. A `.jpg/.png/.webp` gets a slow push-in instead of playing.

## 3. Rules

- **Safe zone.** All text stays in x 140-940, y 288-1248. The templates enforce this through three bands: `top` (y 288-600), `middle` (600-930), `lower` (930-1248). You only choose the band.
- **Keep text off the product** unless the brief wants it there. Choose each band from the frames you extracted. If every band covers the product in a shot, shorten the text's `duration` or change the shot.
- **Short lines.** Text shrinks to fit 800 px, so a long line gets small. Aim for 22 Latin characters or 12 Japanese characters a line. Wrap one word in `*asterisks*` to colour it with the accent.
- **Clip lengths.** `start + duration * speed` must not pass the end of the source. The video's length is the sum of the clip durations (`BeforeAfter` uses `duration`; `Testimonial` is the reviews plus the CTA).
- **Cut on the beat** when there is music: make clip durations add up to beat positions.
- **Fonts.** Latin, Vietnamese (montserrat or anton, and all interface cards) and Japanese work. Korean, Thai, Arabic and others need a font added in `reels/src/lib/kit.tsx` first.

**Few static clips, many angles.** When the footage is one or two locked-off shots and the brief is a fast multi-angle edit (a showroom-tour or trend-dance cut), use `BeatCutAd` and reuse each source several times with a different `focus`, `zoom`, `tilt` and `push`: open on a wide shot (`zoom` about 1.02), then one detail per beat (text, character, name, hands, hem), alternate the sign of `tilt`, keep `zoom` at 1.7 or less on 768 px sources, and end wide. Use `cut` transitions; the push is the transition. This re-frames the footage; it cannot create a real new camera angle.

Template notes:

- `ChatStory`, `NotesList`, `NotificationStack`: the interface plays first, then `clips` (the payoff) flash in and the CTA shows over them. Their length is the interface part plus the clips. Leave `hook` out: the card fills the safe zone. `background` is the dimmed media behind the card.
- `ChatStory`: messages pace themselves by reading time; set `at` (seconds) only to force a beat. A message may carry `image` (a product photo) instead of, or with, `text`.
- `NotesList`: `check: true` ticks a line after it is typed, `highlight: true` marks it. Put the product line last.
- `SearchHook`: `pick` is the suggestion that gets selected. Keep the query under 34 characters.
- `NotificationStack`: `icon` is one emoji, `color` its tile colour. Translate `now` and `date` per language.
- `PolaroidDump`: square-ish photos work best. `title` is handwritten; captions stay under 20 characters. There are no clips: the photos are the video.
- `Ranking`: `items` play in the order written, so write the lowest rank first and rank 1 last. Labels stay under 20 characters.
- `PollSticker`: `percent` values are yours to set; use real numbers when the brief has them and never present invented ones as survey data.
- Write the copy in these interfaces the way people text and post: lowercase is fine, short lines, an emoji where a person would use one. Names, messages and reviews in them are illustrative unless the brief supplies real ones, so do not attribute them to real people.
- `UgcCaptions`: `words` are `{ text, start, end }` in seconds on the output timeline. Get them from a transcript with word timestamps; do not guess timings. `keepAudio` defaults to true. A "word" may be a short phrase with `wordsPerPage: 1`.
- `CommentReply` and `OfferPromo`: leave `hook` out. The bubble or headline already uses the top band.
- `OfferPromo`: the CTA defaults to the lower band. `Testimonial`: set the CTA band to `middle`.
- `ProductSlideshow`: `badge` takes `\n` for two lines; place it with `badgeBand`.

## 4. Check, then render

Run these from `reels/`.

```bash
node render.mjs jobs/<job>.json --still=1,6,12 --guides   # safe-zone bands drawn on top
node render.mjs jobs/<job>.json --still=1,6,12 --lang=en,ja
node render.mjs jobs/<job>.json                           # every language -> exports/<name>/
```

Stills go to `out/stills/` at half size. Open them and check: text is off the product, nothing is clipped, each language fits. Pick still times inside the hook, a middle caption and the CTA. Files named `_GUIDES` are for checking only; never hand them over as the result.

Render the videos only after the stills pass. If a still fails, fix the job and check again; after three failed rounds, report it as a blocker. A render prints one line per file with its path and length. Do not publish or upload the videos unless the brief says to.

End every job with a report to the requester. It covers:

- the output paths and lengths;
- the template and the defaults used where the brief was silent;
- each input's source, and whether `public/` holds the only copy;
- what the cleanup in section 6 removed, and the space freed.

## 5. Instagram size

The renders are about 16 Mbps. To compress one for upload:

```bash
ffmpeg -i in.mp4 -c:v libx264 -crf 20 -maxrate 10M -bufsize 20M -c:a aac -ar 48000 -b:a 192k -movflags +faststart out.mp4
```

## 6. Media and disk space

Media is what fills the disk. Inputs (footage, photos, music copied into `public/<name>/`) and outputs (videos in `exports/<name>/`, about 30 MB per language for 15 s) both belong to a job, under the same name. Keep it that way, because the cleanup works per job. Everything else is scratch: QA stills in `out/`, and the temporary bundles Remotion writes to the OS temp folder (each holds a full copy of `public/`; `render.mjs` deletes its own, but crashed runs and Studio leave some behind). The webpack cache in `node_modules/.cache` grows to several hundred MB. `node_modules/` (about 1.3 GB, including the headless browser) is a one-time cost. Re-rendering a job overwrites its files under the same names, so repeated renders of one job do not pile up.

If `reels/clean.mjs` is missing (the workspace was made from an older kit), copy `clean.mjs` and `render.mjs` from this skill's `assets/reels-kit/` into `reels/` first.

Run these from `reels/`, never while a render is running:

```bash
node clean.mjs --auto --keep=<name>           # the standard run after every job (policy below)
node clean.mjs --report                       # media per job: input size, output size, days since last change
node clean.mjs                                # scratch only (temp bundles + out/), then the report
node clean.mjs --job=<name> --dry-run         # what removing one job's media would delete
node clean.mjs --job=<name>                   # remove public/<name>/ and exports/<name>/
node clean.mjs --job=<name> --inputs          # only the inputs; keep the finished videos
node clean.mjs --older-than=30 --dry-run      # every job untouched for 30+ days
node clean.mjs --max-gb=10 --dry-run          # what trimming to a 10 GB budget would remove
node clean.mjs --cache                        # also the webpack cache
```

Retention policy (no approval needed; the requester can change the numbers with environment variables):

- **After every job**, once the report's output files exist, run `node clean.mjs --auto --keep=<name>`. It removes scratch, removes the media of jobs untouched for `REELS_KEEP_DAYS` days (default 30), then trims the oldest jobs until job folders fit in `REELS_MAX_GB` (default 20). It takes all inputs before any outputs, and adds `--cache` when the cache passes 1 GB. Jobs changed in the last 24 hours and the jobs in `--keep` are never touched.
- **Inputs of a delivered job:** if every input of the job has another copy outside `reels/` (it was copied from a folder that still has it), also run `node clean.mjs --job=<name> --inputs`. If any input exists only in `public/`, keep the inputs; the retention window removes them later.
- **Outputs** are removed only by the retention window or the size budget, never right after delivery. Whoever consumes the videos has `REELS_KEEP_DAYS` days to pick them up.
- **Loose files** directly in `public/` or `exports/` are never removed. List them in the report as "unmanaged" so someone can file or delete them.
- **Job files** (`jobs/<name>.json`) are never removed. They are tiny, and with the media put back they re-render the same video.
- **Disk full mid-job:** run `node clean.mjs --auto --keep=<name>` and retry once. If it still fails, report a blocker with the output of `node clean.mjs --report`.
- **Log:** every media removal is appended to `reels/clean.log` (time, path, bytes, reason). Put the lines from this job in the report.
- Use `--dry-run` to preview, and `--job=<name>` to remove one job's media when the requester asks for it.

## 7. Adding a template

Do this only when no template fits and the format will be reused.

Before writing template code, load the `remotion-best-practices` skill (if installed) and its Markup reference for Remotion's own rules on sequencing, timing, fonts, media and text measuring; use its Docs reference to check an API.

1. Copy the closest file in `reels/src/templates/`. Export `schema` (zod, spread `...common`), `duration(props)` in frames and `Comp`.
2. Build it from `src/lib/kit.tsx`: `Stage` (wraps everything; adds fonts, music, hook, CTA), `ClipSeries`, `Media`, `Text`, `SafeBox`, `enter`, `tween`, `ctaStart`. Put text only inside `SafeBox`. Call `useBrand()` only in components rendered inside `Stage`.
3. Add `jobs/examples/<Name>.json` with every prop filled in, register both in `src/Root.tsx`, run `npx tsc --noEmit`, then check stills as in section 4.
4. Add a row to the table in section 1.
5. To share the template with everyone who installs this skill, copy the new and changed files into the skill's `assets/reels-kit/` at the same paths, and add the row in this file there. Only do this when the task is to maintain the skills repo, not for a single job.

Remotion needs a paid company licence for companies of more than three people.
