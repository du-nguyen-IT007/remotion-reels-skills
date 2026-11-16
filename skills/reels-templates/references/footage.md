# Footage tools

`reels/footage.mjs` turns raw media into facts you can build a job from. The script does the measuring: shots, sound, words, beats and crop maths. You do the looking and deciding, by reading the contact sheets and frames it draws. Nothing here needs a cloud service or a paid app.

Run every command from `reels/` with `--job=<name>`, the same name as the job. Each command prints JSON on stdout and keeps its working files in `out/footage/<name>/`, including `index.json`, which later commands read. `out/` is scratch: the cleanup after the job removes it. Put everything the video needs into the job file.

| Command | What it gives you |
| --- | --- |
| `scan <file\|folder>...` | For each media file: kind, length, size, fps, shot boundaries, the parts with sound, and a contact sheet (one labelled tile per shot). Add `--transcribe` for word timings. Sources are only read. |
| `transcribe <file> [--lang=xx]` | Word timestamps from local whisper.cpp, stored in the index. |
| `find "<phrase>"` | Every place a phrase is said, across all transcribed files: file, start, end. |
| `words <file> --start=<s> --duration=<s> [--speed=x]` | One clip's words, timed to the output. Paste them into `UgcCaptions` `words`. |
| `cut <file>` | Removes silences: writes `public/<name>/<base>.cut.mp4` and moves the transcript onto it. |
| `frames <file> --at=<t,t> \| --every=<s>` | Full frames with a 10 % grid, for reading where things are. |
| `reframe <file> --subject=<x>,<y> [--at=<t>]` | The `focus` that keeps a subject in the 9:16 crop, plus preview stills of that crop. |
| `beats <audio\|video>` | Tempo, beat times, every 4th beat and a confidence. |

## Find the shots (a big or unknown folder)

1. `node footage.mjs scan <folder> --job=<name>`. Add `--transcribe` when people talk in the footage.
2. Open every contact sheet listed in the output. Each tile is labelled with its time in the source. Note what each shot shows: subject, action, framing, and whether it is usable (sharp, well lit, product visible).
3. Choose shots against the brief. Use `find "<phrase>"` to locate spoken lines. Copy only the chosen files into `public/<name>/`, as section 2 of SKILL.md says.
4. A clip's `start` is a time inside its shot range from the index, and `start + duration * speed` must stay inside the shot unless you want the cut that follows it.

## Build from a script (talking footage)

When the brief is a script, or a list of lines the video must say:

1. `scan --transcribe` the footage.
2. Run `find` for each line. Pick the best take of each: complete, clear, no stumble (check the words around the hit). If a line has no hit, search for a shorter key part of it. If there is still none, leave the line out and say so in the report.
3. Each hit becomes a clip (`start` = hit start minus 0.1 s, `duration` = length plus 0.2 s) in script order. Use `BeatCutAd` for several takes and `UgcCaptions` for one continuous take.
4. For captions, run `words` with each clip's `start` and `duration`.

## Talking head: remove pauses, then caption

1. `node footage.mjs transcribe <file> --job=<name>` (or `scan --transcribe`).
2. `node footage.mjs cut <file> --job=<name>` writes the jump cut to `public/<name>/<base>.cut.mp4`, and the transcript follows it. The result prints the length before and after. If it removed almost nothing, the audio has background sound; pass a higher `--noise` (for example `-30`). If it chops words, pass a lower `--noise` (for example `-45`) or a longer `--min-silence`.
3. `node footage.mjs words <name>/<base>.cut.mp4 --start=0 --duration=<length> --job=<name>`, then put `clip` and `words` into a `UgcCaptions` job.
4. Check stills at a few word times. Captions must change on the spoken word.

Word timings come only from `transcribe`. Do not guess or space words evenly. Whisper can mishear a brand or product name: compare the transcript with the brief and fix the `text` of wrong words, keeping their times.

## Reframe wide footage for 9:16

Landscape footage shows about a third of its width in a 9:16 frame, centred by default.

1. `node footage.mjs frames <file> --at=<t> --job=<name>` at a time inside the clip. Read the subject's centre off the grid as x,y percent.
2. `node footage.mjs reframe <file> --subject=<x>,<y> --at=<t> --job=<name>`. Open the preview stills. The subject should be well inside the frame, with headroom.
3. Put the printed `focus` on the clip. The kit then renders the same crop as the preview.
4. If the subject moves across the frame during the clip, split it into shorter clips, each with its own `focus`.
5. `focus` frames the subject only on clips without `zoom`, `tilt` or `push`. On a clip with a camera move, `focus` is the move's centre, so leave camera moves off reframed wide footage.

## Cut on the beat

1. `node footage.mjs beats <music> --job=<name>`.
2. With `confidence` 0.3 or more, make clip durations end on beat times, so the running total of durations lands on `beats` values. Cut every beat for a fast edit, or every 2 or 4 beats (`every4`) for a calmer one. Put the hook's end and the CTA's start on a beat as well.
3. Below 0.3, the tempo is a guess. Use even cuts of about 0.6 to 1.2 s, and say so in the report.
4. `every4` starts at the first detected beat. It is not a confirmed bar line.

## Transcription engine

The first `transcribe` installs whisper.cpp into `reels/.whisper/` and downloads a model. This happens once and takes a few minutes. It needs `git`, `make`, `cmake`, a C compiler and network access. If one of these is missing, the command exits with code 3 and says what is missing. Report it as a blocker for captions, and carry on with the parts of the job that do not need words.

- `REELS_WHISPER_MODEL`: `small` (default, about 0.5 GB, many languages), `medium` (more accurate, slower), `large-v3-turbo` (best, about 1.6 GB), or `base` for quick drafts.
- `REELS_WHISPER_CPP`: the whisper.cpp version (default `1.7.6`).
- `--lang=xx` (for example `en`, `vi`, `ja`) skips language detection. Pass it when the brief states the language.

`.whisper/` is a tool, not job media. The cleanup never removes it. Add `reels/.whisper/` to `.gitignore`.
