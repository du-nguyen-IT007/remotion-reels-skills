# remotion-reels-skills

A set of **Agent Skills** that let an AI agent make vertical 9:16 videos (Reels / TikTok) with Remotion. There is no app or code to run. Each folder in `skills/` is a skill in the [Agent Skills](https://agentskills.io) format (a `SKILL.md` plus its bundled resources), so any agent that reads skills can install and use it: Claude Code, Codex, Cursor, Gemini CLI and others.

## Skills

| Skill | What it does |
| --- | --- |
| [`reels-templates`](skills/reels-templates/SKILL.md) | Makes a 9:16 ad from footage, photos or a brief using 15 ready-made templates: chat story, notes list, search bar, lock-screen notifications, polaroid dump, ranking, poll, beat-cut, UGC captions, listicle, before/after, slideshow, testimonial, comment reply and sale promo. Renders in several languages. |
| `remotion-best-practices` (recommended, not included) | The official Remotion skill, used as a reference when writing Remotion code. It is not part of this repo. Install it from [remotion-dev/skills](https://github.com/remotion-dev/skills) with `npx skills add remotion-dev/skills --skill remotion-best-practices`. |

## Use it in this repo

Clone the repo and start your agent inside it:

```bash
git clone https://github.com/du-nguyen-IT007/remotion-reels-skills.git
cd remotion-reels-skills
npx skills add remotion-dev/skills --skill remotion-best-practices -a claude-code -y   # optional: Remotion reference docs
claude      # or: codex, gemini
```

The repo ships `.claude/skills` and `.agents/skills` symlinks, both pointing to `skills/`, so Claude Code, Codex and Gemini CLI pick up the skills as soon as they open the repo. The first time, give the agent this prompt:

```text
Get this repo ready to make videos: read AGENTS.md and the reels-templates skill, check for Node.js >= 18, ffmpeg and ffprobe (if one is missing, tell me the install command and do not install it yourself), create the reels/ workspace as described in "0. Set up the workspace" if it does not exist, run `cd reels && npx tsc --noEmit && node clean.mjs --report`, and report the results.
```

After that, just ask in plain language, for example "make a reel from the footage in ~/Downloads/sweater, chat-story style, in English and Japanese". Media, jobs and renders live in `reels/`. That folder is git-ignored, so each machine has its own workspace.

## Install into another project

To use the skills in a different folder, install them with the [skills CLI](https://github.com/vercel-labs/skills). It works with every supported agent:

```bash
npx skills add du-nguyen-IT007/remotion-reels-skills
npx skills add remotion-dev/skills --skill remotion-best-practices   # recommended
```

The CLI asks which skills to install and for which agents. Add `-g` to install for your user account instead of one project. To install straight into one agent without prompts, add `-a <agent> -s '*' -y`:

| Agent | Command | Skills folder |
| --- | --- | --- |
| Claude Code | `npx skills add <repo> -a claude-code -s '*' -y` | `.claude/skills/` |
| Codex | `npx skills add <repo> -a codex -s '*' -y` | `.agents/skills/` |
| Gemini CLI | `npx skills add <repo> -a gemini-cli -s '*' -y` | `.agents/skills/` |

You can also install by hand: copy each folder in `skills/` into your agent's skills folder (last column above).

### Let the agent install it

Start your agent in the folder where you want to make videos (an empty folder is fine) and paste this prompt, replacing `<repo>` with `du-nguyen-IT007/remotion-reels-skills`:

```text
Install the Reels video skills from <repo> for yourself (the agent that is running), then get ready to make videos:
1. Run `npx skills add <repo> -a <your-agent-id> -s '*' -y` in this folder. If you are not sure of your agent id, run `npx skills add <repo> --list` and pick the right one.
2. Check for Node.js >= 18, ffmpeg and ffprobe. If one is missing, tell me the install command for this machine and do not install it yourself.
3. Read the installed reels-templates skill and follow "0. Set up the workspace": copy assets/reels-kit to ./reels and run npm install.
4. Check the setup with `cd reels && npx tsc --noEmit` and `node clean.mjs --report`.
5. Report where the skills were installed, the Node and ffmpeg versions, and whether the reels/ workspace is ready.
```

You may need to restart the agent (or open a new session) before it sees newly installed skills.

## How it works

Start your agent in the folder that should hold your videos and ask, for example:

> Make an ad reel from the footage in this folder, chat-story style, rendered in English and Japanese.

On the first run the agent creates `reels/` in that folder (copied from the kit bundled with the skill) and installs its packages. Each job gets its own media folders: inputs in `reels/public/<job>/`, renders in `reels/exports/<job>/`.

Requirements:

- Node.js 18 or later
- `ffmpeg` and `ffprobe`
- Network access while rendering (for Google Fonts)

### Footage tools

Raw footage rarely arrives ready to cut. `reels/footage.mjs` gives the agent the measurements it needs, using only local tools (ffmpeg and whisper.cpp, no cloud service or paid editor):

| Command | What it does |
| --- | --- |
| `scan` | Probes a folder of media, finds shot boundaries and the parts with sound, and draws a labelled contact sheet per video for the agent to look at. |
| `transcribe`, `find`, `words` | Word-level transcripts, a search for where a line is said, and captions timed to a clip. |
| `cut` | Removes pauses from talking footage (jump cut) and keeps the transcript in sync. |
| `frames`, `reframe` | Frames with a percent grid, and the crop that keeps a subject in 9:16 when the footage is landscape. |
| `beats` | Tempo and beat times, so cuts land on the music. |

The scripts measure and the agent decides: it reads the contact sheets and frames with its own vision, then writes the job file. [references/footage.md](skills/reels-templates/references/footage.md) has the workflows. Transcription builds whisper.cpp on first use, which needs `git`, `make`, `cmake` and a C compiler.

The skill is written for agents that run unattended, with no human approving each step. The agent stops only on a problem it cannot resolve itself (a missing tool, missing media, a render that keeps failing). Every job ends with a report: output paths, the defaults it used, the source of each input file, and what was cleaned up and how much space was freed.

### Disk space

Media is managed per job. After every job the agent runs `node clean.mjs --auto --keep=<job>`, which:

- removes scratch files and preview stills;
- removes the media of jobs untouched for more than `REELS_KEEP_DAYS` days (default 30);
- if the job folders total more than `REELS_MAX_GB` GB (default 20), removes more, oldest job first: inputs go before any renders.

It never touches the current job, jobs changed in the last 24 hours, job files (`.json`) or loose files outside job folders. Every media removal is logged to `reels/clean.log`. To change the limits, set environment variables for the agent, for example `REELS_KEEP_DAYS=14 REELS_MAX_GB=50`. To see disk usage, run `node clean.mjs --report`. Section 6 of [SKILL.md](skills/reels-templates/SKILL.md) has the full policy.

## Repo layout

```
skills/
  reels-templates/
    SKILL.md              instructions for the agent
    references/           footage workflows, loaded when needed
    assets/reels-kit/     Remotion starter project; the agent copies it to reels/
                          (render.mjs, footage.mjs, clean.mjs, templates, example jobs)
```

`.claude/skills` and `.agents/skills` are symlinks to `skills/`, so Claude Code, Codex and Gemini CLI load the skills when opened in this repo. `reels/` is a local workspace and is not tracked by git.

## Contributing

- **Templates:** edit or add them in `skills/reels-templates/assets/reels-kit/`. When you add a template, also add its row to the template table in `SKILL.md`. [AGENTS.md](AGENTS.md) lists the full checklist and how to test a change.
- **Remotion skill:** `skills/remotion-best-practices/` is git-ignored. If you install that skill here for local use, do not commit it: its upstream repo has no license that allows redistribution.
- **No personal preferences in skills:** a user's or brand's preferences (fonts, colours, tone of voice) never go into a skill or template. The agent gets them from the user at job time.

## License

[MIT](LICENSE) for everything in this repo. Software the kit depends on has its own license, in particular [Remotion](https://www.remotion.dev/license): it is free for individuals and companies of up to 3 people, and larger companies need a company license.
