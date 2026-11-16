import React from "react";
import { Easing, Sequence, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Backdrop, backgroundSchema, ClipSeries, clipSchema, common, FPS, SAFE, sec, Stage, totalFrames, tween, typed, typeFrames, UI_FONT } from "../lib/kit";

// A search bar types the customer's question, suggestions drop down, then the footage answers it.
// Leave `hook` out: the query is the hook. The query stays docked on top for a moment after the cut.
export const schema = z.object({
  query: z.string(),
  suggestions: z.array(z.string()).max(4).optional(),
  pick: z.number().int().optional(),
  cps: z.number().optional(),
  background: backgroundSchema,
  dock: z.number().optional(),
  clips: z.array(clipSchema).min(1),
  ...common,
});
type P = z.infer<typeof schema>;

const START = sec(0.4);
const plan = (p: P) => {
  const typedAt = START + typeFrames(p.query, p.cps ?? 15);
  return { typedAt, intro: typedAt + sec(p.suggestions?.length ? 1.0 : 0.6) };
};
export const duration = (p: P) => plan(p).intro + totalFrames(p.clips);

const Glass: React.FC<{ size: number; color?: string }> = ({ size, color = "#8e8e93" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{ flex: "none" }}>
    <circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke={color} strokeWidth="2.4" />
    <line x1="15.5" y1="15.5" x2="21" y2="21" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
  </svg>
);

const Search: React.FC<{ p: P }> = ({ p }) => {
  const f = useCurrentFrame();
  const { typedAt, intro } = plan(p);
  const text = typed(p.query, f, START, p.cps ?? 15);
  const list = p.suggestions ?? [];
  const pick = p.pick ?? 0;
  const press = tween(f, intro - 12, 6, 1, 0.96) * tween(f, intro - 6, 6, 1, 1 / 0.96);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: 560, fontFamily: UI_FONT, transform: `scale(${tween(f, 0, sec(0.35), 0.9, 1, Easing.out(Easing.back(1.6))) * press})`, opacity: tween(f, 0, 9, 0, 1) }}>
      <div style={{ height: 124, borderRadius: 62, background: "#fff", display: "flex", alignItems: "center", gap: 22, padding: "0 40px", boxShadow: "0 16px 50px rgba(0,0,0,0.5)" }}>
        <Glass size={52} />
        <div style={{ fontSize: 44, color: "#111", whiteSpace: "nowrap", overflow: "hidden" }}>
          {text}
          <span style={{ color: "#0A84FF", opacity: Math.floor(f / (FPS / 3)) % 2 ? 0 : 1 }}>|</span>
        </div>
      </div>
      {list.length ? (
        <div style={{ marginTop: 16, borderRadius: 36, background: "#fff", overflow: "hidden", boxShadow: "0 16px 50px rgba(0,0,0,0.5)", opacity: tween(f, START + 18, 9, 0, 1) }}>
          {list.map((sug, i) => {
            const at = START + 18 + i * 7;
            const on = i === pick && f >= typedAt + 12;
            return f >= at ? (
              <div key={i} style={{ height: 92, display: "flex", alignItems: "center", gap: 20, padding: "0 40px", background: on ? "#E8F0FE" : "#fff", fontSize: 38, color: "#111", fontWeight: on ? 700 : 400, whiteSpace: "nowrap", opacity: tween(f, at, 8, 0, 1) }}>
                <Glass size={38} color={on ? "#0A84FF" : "#b0b0b5"} />
                {sug}
              </div>
            ) : null;
          })}
        </div>
      ) : null}
    </div>
  );
};

// The query, shrunk into the top band while the footage starts answering.
const Docked: React.FC<{ query: string; dur: number }> = ({ query, dur }) => {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: SAFE.top + 10, display: "flex", justifyContent: "center", fontFamily: UI_FONT, opacity: tween(f, 4, 8, 0, 1) * tween(f, dur - 10, 10, 1, 0), transform: `translateY(${tween(f, 4, 18, 60, 0)}px)` }}>
      <div style={{ maxWidth: 760, height: 92, borderRadius: 46, background: "#fff", display: "flex", alignItems: "center", gap: 16, padding: "0 34px", boxShadow: "0 10px 30px rgba(0,0,0,0.45)", fontSize: 34, color: "#111", whiteSpace: "nowrap", overflow: "hidden" }}>
        <Glass size={38} />
        {query}
      </div>
    </div>
  );
};

export const Comp: React.FC<P> = (p) => {
  const f = useCurrentFrame();
  const { intro } = plan(p);
  const dock = Math.min(sec(p.dock ?? 2), totalFrames(p.clips));
  return (
    <Stage p={p} total={duration(p)}>
      {f < intro ? (
        <>
          <Backdrop bg={p.background} frames={intro} />
          <Search p={p} />
        </>
      ) : null}
      <Sequence from={intro} layout="none">
        <ClipSeries clips={p.clips} lead="zoom" />
      </Sequence>
      {dock > 12 ? (
        <Sequence from={intro} durationInFrames={dock} layout="none">
          <Docked query={p.query} dur={dock} />
        </Sequence>
      ) : null}
    </Stage>
  );
};
