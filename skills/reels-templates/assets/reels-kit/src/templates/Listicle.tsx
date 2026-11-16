import React from "react";
import { Sequence, useCurrentFrame } from "remotion";
import { z } from "zod";
import { bandSchema, ClipSeries, clipSchema, common, ctaStart, enter, hookFrames, layout, SAFE, SafeBox, Stage, Text, totalFrames, tween, useBrand } from "../lib/kit";

// "3 reasons why ..." : one clip per numbered point, story-style progress bar on top.
export const schema = z.object({
  header: z.string().optional(),
  items: z.array(z.object({ clip: clipSchema, title: z.string(), text: z.string().optional() })).min(2).max(7),
  itemBand: bandSchema.optional(),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.items.map((i) => i.clip));

const Item: React.FC<{ n: number; title: string; text?: string; end: number; band: z.infer<typeof bandSchema> }> = ({ n, title, text, end, band }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  return (
    <SafeBox band={band}>
      <div
        style={{
          width: 108,
          height: 108,
          borderRadius: 54,
          background: b.accent,
          color: "#111",
          fontFamily: b.family,
          fontWeight: b.bold,
          fontSize: 68,
          lineHeight: "108px",
          textAlign: "center",
          marginBottom: 14,
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          ...enter(f, 0, "pop", end),
        }}
      >
        {n}
      </div>
      <Text lines={[title]} max={62} style={enter(f, 5, "rise", end)} />
      {text ? <Text lines={[text]} max={38} variant="plain" weight={b.regular} style={{ marginTop: 6, ...enter(f, 11, "rise", end) }} /> : null}
    </SafeBox>
  );
};

const Progress: React.FC<{ p: P; total: number }> = ({ p, total }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const lay = layout(p.items.map((i) => i.clip));
  const from = hookFrames(p);
  const end = ctaStart(p, total);
  const opacity = tween(f, from, 12, 0, 1) * tween(f, end - 9, 9, 1, 0);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: SAFE.top, opacity }}>
      <div style={{ display: "flex", gap: 10 }}>
        {lay.map((l, i) => (
          <div key={i} style={{ flex: 1, height: 10, borderRadius: 5, background: "rgba(255,255,255,0.4)", overflow: "hidden" }}>
            <div style={{ width: `${tween(f, l.from, l.dur, 0, 100, (t) => t)}%`, height: "100%", background: b.accent }} />
          </div>
        ))}
      </div>
      {p.header ? <Text lines={[p.header]} max={42} style={{ marginTop: 18 }} /> : null}
    </div>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  const clips = p.items.map((i) => i.clip);
  const lay = layout(clips);
  const stop = ctaStart(p, total);
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={clips} />
      <Progress p={p} total={total} />
      {p.items.map((it, i) => {
        const end = Math.min(lay[i].dur, stop - lay[i].from);
        return end > 12 ? (
          <Sequence key={i} from={lay[i].from} durationInFrames={end} layout="none">
            <Item n={i + 1} title={it.title} text={it.text} end={end} band={p.itemBand ?? "lower"} />
          </Sequence>
        ) : null;
      })}
    </Stage>
  );
};
