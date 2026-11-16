import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { z } from "zod";
import { common, ctaFrames, Dim, enter, hookFrames, layout, Media, SafeBox, sec, Stage, Text, tween, useBrand } from "../lib/kit";

// Customer reviews as cards over dimmed footage, then a clean CTA.
const reviewSchema = z.object({ quote: z.string(), author: z.string(), stars: z.number().min(1).max(5).optional(), duration: z.number().optional() });
export const schema = z.object({
  background: z.object({ src: z.string(), start: z.number().optional(), focus: z.string().optional() }),
  dim: z.number().optional(),
  summary: z.string().optional(),
  reviews: z.array(reviewSchema).min(1).max(6),
  ...common,
});
type P = z.infer<typeof schema>;
const timing = (p: P) => p.reviews.map((r) => ({ duration: r.duration ?? 3.5 }));
export const duration = (p: P) => sec(timing(p).reduce((a, r) => a + r.duration, 0)) + ctaFrames(p);

const Card: React.FC<{ r: z.infer<typeof reviewSchema>; dur: number }> = ({ r, dur }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const stars = r.stars ?? 5;
  const size = r.quote.length <= 60 ? 52 : r.quote.length <= 110 ? 44 : 38;
  const base = enter(f, 0, "rise", dur);
  return (
    <SafeBox top={600} height={600}>
      <div
        style={{
          width: "100%",
          boxSizing: "border-box",
          background: "#fff",
          borderRadius: 36,
          padding: "40px 44px",
          boxShadow: "0 18px 50px rgba(0,0,0,0.55)",
          fontFamily: b.family,
          color: "#111",
          opacity: base.opacity,
          transform: `${base.transform} rotate(${tween(f, 0, sec(0.45), -2.5, 0)}deg)`,
        }}
      >
        <div style={{ fontSize: 56, lineHeight: 1, letterSpacing: 4 }}>
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} style={{ color: i < stars ? "#FFB400" : "#ddd", opacity: tween(f, 8 + i * 4, 6, 0, 1) }}>
              ★
            </span>
          ))}
        </div>
        <div style={{ fontSize: size, fontWeight: b.regular, lineHeight: 1.3, marginTop: 22 }}>“{r.quote}”</div>
        <div style={{ fontSize: 34, fontWeight: b.bold, color: "#555", marginTop: 22 }}>{r.author}</div>
      </div>
    </SafeBox>
  );
};

export const Comp: React.FC<P> = (p) => {
  const f = useCurrentFrame();
  const total = duration(p);
  const lay = layout(timing(p));
  const reviewsEnd = total - ctaFrames(p);
  const from = hookFrames(p);
  return (
    <Stage p={p} total={total}>
      <AbsoluteFill>
        <Media src={p.background.src} start={p.background.start} focus={p.background.focus} frames={total} />
      </AbsoluteFill>
      <Dim amount={p.dim ?? 0.45} />
      {p.summary ? (
        <SafeBox band="top">
          <Text lines={p.summary.split("\n")} max={54} style={{ opacity: tween(f, from, 12, 0, 1) * tween(f, reviewsEnd - 9, 9, 1, 0) }} />
        </SafeBox>
      ) : null}
      {p.reviews.map((r, i) => (
        <Sequence key={i} from={lay[i].from} durationInFrames={lay[i].dur} layout="none">
          <Card r={r} dur={lay[i].dur} />
        </Sequence>
      ))}
    </Stage>
  );
};
