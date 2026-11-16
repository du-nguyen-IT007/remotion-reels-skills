import React from "react";
import { Easing, Sequence, useCurrentFrame } from "remotion";
import { z } from "zod";
import { BANDS, bandSchema, Clip, ClipSeries, common, ctaStart, enter, FPS, layout, SAFE, SafeBox, sec, Stage, Text, totalFrames, transitionSchema, tween, useBrand } from "../lib/kit";

// Product photos (or clips) as a fast slideshow: caption per slide, optional price / discount sticker.
export const schema = z.object({
  slides: z
    .array(
      z.object({
        src: z.string(),
        start: z.number().optional(),
        duration: z.number().optional(),
        focus: z.string().optional(),
        caption: z.string().optional(),
        transition: transitionSchema.optional(),
      }),
    )
    .min(2),
  captionBand: bandSchema.optional(),
  badge: z.string().optional(),
  badgeBand: bandSchema.optional(),
  ...common,
});
type P = z.infer<typeof schema>;
const AUTO = ["zoom", "whip", "flash"] as const;
const toClips = (p: P): Clip[] =>
  p.slides.map((s, i) => ({ src: s.src, start: s.start, focus: s.focus, duration: s.duration ?? 2.2, transition: s.transition ?? AUTO[i % 3] }));
export const duration = (p: P) => totalFrames(toClips(p));

const Caption: React.FC<{ text: string; end: number; band: z.infer<typeof bandSchema> }> = ({ text, end, band }) => {
  const f = useCurrentFrame();
  return (
    <SafeBox band={band}>
      <Text lines={text.split("\n")} max={60} style={enter(f, 6, "rise", end)} />
    </SafeBox>
  );
};

const Badge: React.FC<{ text: string; band: z.infer<typeof bandSchema>; end: number }> = ({ text, band, end }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const size = 230;
  const pop = tween(f, sec(0.5), sec(0.45), 0, 1, Easing.out(Easing.back(2.2)));
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left + SAFE.width - size,
        top: BANDS[band][0] + 20,
        width: size,
        height: size,
        borderRadius: size / 2,
        background: b.accent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        opacity: tween(f, end - 9, 9, 1, 0),
        transform: `scale(${pop}) rotate(${10 + 3 * Math.sin((f / FPS) * Math.PI * 1.6)}deg)`,
      }}
    >
      <Text lines={text.split("\n")} max={84} width={size - 36} variant="plain" color="#111" style={{ textShadow: "none" }} />
    </div>
  );
};

export const Comp: React.FC<P> = (p) => {
  const clips = toClips(p);
  const total = duration(p);
  const lay = layout(clips);
  const stop = ctaStart(p, total);
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={clips} />
      {p.slides.map((s, i) => {
        const end = Math.min(lay[i].dur, stop - lay[i].from);
        return s.caption && end > 12 ? (
          <Sequence key={i} from={lay[i].from} durationInFrames={end} layout="none">
            <Caption text={s.caption} end={end} band={p.captionBand ?? "lower"} />
          </Sequence>
        ) : null;
      })}
      {p.badge ? <Badge text={p.badge} band={p.badgeBand ?? "middle"} end={stop} /> : null}
    </Stage>
  );
};
