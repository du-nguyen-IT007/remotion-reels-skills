# AGENTS.md

This repo is an Agent Skills package for making 9:16 Reels / TikTok videos with Remotion. It has no app. The product is the skills in `skills/`, and people install them into their own agents with `npx skills add <repo>` or by copying the folders. See [README.md](README.md) for the human-facing overview.

## Layout

- `skills/reels-templates/SKILL.md`: the main skill. It tells an agent how to make a video from one of fifteen templates.
- `skills/reels-templates/assets/reels-kit/`: the Remotion project that skill copies into a user's folder as `reels/`. It holds `render.mjs`, `src/lib/kit.tsx` (shared kit), `src/templates/*.tsx`, `src/Root.tsx` (registration) and `jobs/examples/<Template>.json` (one example job per template, also used as default props).
- `skills/remotion-best-practices/` (git-ignored, optional): the official Remotion skill, installed locally with `npx skills add remotion-dev/skills --skill remotion-best-practices`. It is not part of this repo.
- `.claude/skills` (Claude Code) and `.agents/skills` (Codex, Gemini CLI and others) are symlinks to `skills/`. Agents opened in this repo load the skills directly, and edits under `skills/` take effect at once. Do not replace a symlink with a copy.
- `reels/` is a local, git-ignored workspace made from the kit. It holds media, scratch jobs, stills and renders. It does not exist in a fresh clone.

## Which task you are doing

- **Making a video** ("make a reel", "render this ad"): follow `skills/reels-templates/SKILL.md`. Work in `reels/` and create it from the kit if it is missing. Do not change files under `skills/` for a single job.
- **Maintaining the skills** (a template, the kit, a skill's instructions): edit under `skills/`. The rules below apply.

## Rules for editing skills

- Keep the repo code-free outside the skills. Do not add an app, scripts or config at the root. Anything an agent needs at run time goes inside a skill folder, in `SKILL.md`, `references/` or `assets/`.
- Every skill follows the Agent Skills format: a folder with a `SKILL.md` whose YAML frontmatter has `name` (the folder name) and `description` (what it does and when to use it, under 1024 characters). Quote the description if it contains `: `, or the skill fails to load.
- Skills run unattended: autonomous agents use them in place of people. Write rules the agent can decide with (policies, defaults, limits, retries) instead of "ask the user" steps, and have each job end with a report of what was done. Guard irreversible actions with policy (for example, never delete the only copy of an input before its retention window), not with an approval prompt.
- Write skill instructions so any agent can follow them. Use plain shell commands and relative paths. Do not depend on one agent's tools or slash commands.
- Never write a user's or a brand's preferences (font, colours, tone, languages, music) into a skill, a template or an example job. Templates ship neutral defaults. Preferences come from the user at job time.
- Never commit `skills/remotion-best-practices/` or any other third-party skill. Upstream has no license that allows redistribution. Link to it instead.
- When you add a template, also add its `jobs/examples/<Name>.json` with every prop filled in, register it in `src/Root.tsx`, and add its row to the template table in `skills/reels-templates/SKILL.md`. Section 7 of that skill has the details.
- All on-screen text stays inside the safe zone that the kit enforces (x 140–940, y 288–1248).
- Never commit media (video, audio, images) or renders. `.gitignore` blocks them.
- Never commit secrets (`.env`, tokens, API keys), internal names, client or brand names, or absolute paths from a machine. Example jobs use made-up products and placeholder media.

## Checking a change

1. Kit code: copy the changed files from `skills/reels-templates/assets/reels-kit/` into `reels/` at the same paths. Then, inside `reels/`, run `npx tsc --noEmit` and render stills of an affected example, for example `node render.mjs jobs/examples/<Template>.json --still=1,5 --guides`. Open the stills and check them. Rendering needs network access for Google Fonts.
2. Skill metadata: run `npx skills add . --list` from the repo root. It must list `reels-templates` once (plus `remotion-best-practices` if it is installed locally). A missing skill usually means broken frontmatter.
3. Links: relative links in each `SKILL.md` must resolve inside that skill's folder, because a skill is installed on its own.

Commit only when the user asks.
