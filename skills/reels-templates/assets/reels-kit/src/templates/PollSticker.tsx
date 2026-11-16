import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { z } from "zod";
import { bandSchema, ClipSeries, clipSchema, common, SafeBox, sec, Stage, totalFrames, tween, UI_FONT, useBrand } from "../lib/kit";

// A story-style poll sticker over footage: two options, a tap, then the result bar fills in.
export const schema = z.object({
  question: z.string(),
  options: z.array(z.object({ label: z.string(), percent: z.number().min(0).max(100) })).length(2),
  revealAt: z.number().optional(),
  band: bandSchema.optional(),
  clips: z.array(clipSchema).min(1),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.clips);

const Sticker: React.FC<{ p: P; total: number }> = ({ p, total }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const reveal = p.revealAt !== undefined ? sec(p.revealAt) : Math.round(total * 0.5);
  const [a, c] = p.options;
  const winner = a.percent >= c.percent ? 0 : 1;
  const k = tween(f, reveal, sec(0.6), 0, 1, Easing.out(Easing.cubic));
  // The losing side keeps at least 28% of the bar so its label stays readable.
  const split = 50 + (Math.min(72, Math.max(28, a.percent)) - 50) * k;
  const BAR = 660;
  const fit = (label: string, width: number, max: number) =>
    Math.min(max, fitText({ text: label, withinWidth: Math.max(60, width - 28), fontFamily: UI_FONT, fontWeight: 600 }).fontSize);
  const shown = f >= reveal;
  const tap = tween(f, reveal - 16, 8, 0, 1) * tween(f, reveal + 4, 10, 1, 0);
  const pop = tween(f, sec(0.3), sec(0.45), 0, 1, Easing.out(Easing.back(1.8)));
  const half = (o: typeof a, i: number): React.CSSProperties => ({
    width: `${i === 0 ? split : 100 - split}%`,
    background: shown && i === winner ? b.accent : shown ? "#DADAE0" : "#F1F1F4",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    color: "#111",
    overflow: "hidden",
    whiteSpace: "nowrap",
  });
  return (
    <SafeBox band={p.band ?? "lower"}>
      <div style={{ width: 720, boxSizing: "border-box", padding: "30px 30px 34px", borderRadius: 42, background: "#fff", fontFamily: UI_FONT, boxShadow: "0 16px 44px rgba(0,0,0,0.5)", opacity: tween(f, sec(0.3), 8, 0, 1), transform: `scale(${0.7 + 0.3 * pop}) rotate(-2deg)` }}>
        <div style={{ fontSize: 44, fontWeight: 700, color: "#111", textAlign: "center", lineHeight: 1.22 }}>{p.question}</div>
        <div style={{ position: "relative", marginTop: 24, height: 128, borderRadius: 30, overflow: "hidden", display: "flex", gap: shown ? 0 : 4, background: "#fff" }}>
          {[a, c].map((o, i) => (
            <div key={i} style={half(o, i)}>
              <div style={{ fontSize: fit(o.label, (BAR * (i === 0 ? split : 100 - split)) / 100, shown ? 30 : 40), fontWeight: 600 }}>{o.label}</div>
              {shown ? <div style={{ fontSize: 46, fontWeight: 700, lineHeight: 1.1 }}>{Math.round(o.percent * k)}%</div> : null}
            </div>
          ))}
          <div style={{ position: "absolute", left: `${winner === 0 ? 25 : 75}%`, top: 34, marginLeft: -36, fontSize: 72, lineHeight: 1, opacity: tap, transform: `scale(${1.3 - 0.3 * tween(f, reveal - 8, 8, 0, 1)})` }}>👆</div>
        </div>
      </div>
    </SafeBox>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={p.clips} />
      <Sticker p={p} total={total} />
    </Stage>
  );
};
