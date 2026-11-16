import React, { useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { z } from "zod";
import { bandSchema, clipSchema, common, FPS, isCJK, Media, SAFE, SafeBox, sec, Stage, tween, useBrand } from "../lib/kit";

// One talking / UGC clip with word-by-word captions. The clip's own sound is kept by default.
const wordSchema = z.object({ text: z.string(), start: z.number(), end: z.number() });
export const schema = z.object({
  clip: clipSchema,
  keepAudio: z.boolean().optional(),
  words: z.array(wordSchema),
  wordsPerPage: z.number().int().min(1).max(6).optional(),
  captionBand: bandSchema.optional(),
  captionSize: z.number().optional(),
  uppercase: z.boolean().optional(),
  ...common,
});
type P = z.infer<typeof schema>;
type Word = z.infer<typeof wordSchema>;
export const duration = (p: P) => sec(p.clip.duration);

const Captions: React.FC<{ p: P }> = ({ p }) => {
  const b = useBrand();
  const t = useCurrentFrame() / FPS;
  const n = p.wordsPerPage ?? 3;
  // A page breaks when it is full, after a pause, or after sentence punctuation.
  const pages = useMemo(() => {
    const out: Word[][] = [];
    let cur: Word[] = [];
    for (const w of p.words) {
      const prev = cur[cur.length - 1];
      if (cur.length >= n || (prev && (w.start - prev.end > 0.5 || /[.!?。！？]$/.test(prev.text)))) {
        out.push(cur);
        cur = [];
      }
      cur.push(w);
    }
    if (cur.length) out.push(cur);
    return out;
  }, [p.words, n]);

  const idx = pages.findIndex((pg, i) => {
    const next = pages[i + 1]?.[0].start;
    const last = pg[pg.length - 1].end;
    return t >= pg[0].start && t < (next !== undefined && next - last < 0.4 ? next : last + 0.15);
  });
  if (idx < 0) return null;
  const page = pages[idx];
  const show = (w: Word) => (p.uppercase ? w.text.toUpperCase() : w.text);
  const joined = page.map(show).join(isCJK(page[0].text) ? "" : " ");
  const size = Math.min(
    p.captionSize ?? 84,
    fitText({ text: joined, withinWidth: SAFE.width - 60, fontFamily: b.family, fontWeight: b.bold }).fontSize,
  );
  const stroke = Math.max(3, size / 18);
  const shadow = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * stroke).toFixed(1)}px ${(Math.sin(a) * stroke).toFixed(1)}px 0 #000`;
  }).join(", ");
  const f = t * FPS;
  return (
    <SafeBox band={p.captionBand ?? "lower"}>
      <div
        style={{
          display: "flex",
          gap: isCJK(joined) ? 0 : size * 0.26,
          fontFamily: b.family,
          fontWeight: b.bold,
          fontSize: size,
          whiteSpace: "nowrap",
          textShadow: `${shadow}, 0 8px 22px rgba(0,0,0,0.6)`,
          transform: `scale(${tween(f, sec(page[0].start), sec(0.12), 0.9, 1)})`,
        }}
      >
        {page.map((w, i) => {
          const until = page[i + 1]?.start ?? w.end;
          const active = t >= w.start && t < until;
          return (
            <span key={i} style={{ color: active ? b.accent : "#fff", transform: `scale(${active ? 1.08 : 1})`, display: "inline-block" }}>
              {show(w)}
            </span>
          );
        })}
      </div>
    </SafeBox>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  return (
    <Stage p={p} total={total}>
      <Media src={p.clip.src} start={p.clip.start} speed={p.clip.speed} focus={p.clip.focus} frames={total} muted={p.keepAudio === false} />
      <Captions p={p} />
    </Stage>
  );
};
