import React from "react";
import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { bandHeight, ClipSeries, clipSchema, common, ctaStart, Dim, enter, FPS, SafeBox, Stage, Text, totalFrames, useBrand } from "../lib/kit";

// Sale / urgency promo: headline, one giant offer, code and deadline, over dimmed footage.
// Do not set `hook` here: the headline sits in the top band. The CTA defaults to the lower band.
export const schema = z.object({
  clips: z.array(clipSchema).min(1),
  headline: z.string(),
  offer: z.string(),
  sub: z.string().optional(),
  deadline: z.string().optional(),
  dim: z.number().optional(),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.clips);

const Layers: React.FC<{ p: P; stop: number }> = ({ p, stop }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const pulse = 1 + 0.035 * Math.sin((f / FPS) * Math.PI * 4);
  const offer = enter(f, 18, "pop");
  return (
    <>
      <SafeBox band="top">
        <Text lines={p.headline.split("\n")} max={68} variant="box" style={enter(f, 6, "pop")} />
      </SafeBox>
      <SafeBox band="middle">
        <Text
          lines={[p.offer]}
          max={280}
          maxHeight={bandHeight("middle")}
          color={b.accent}
          variant="outline"
          style={{ opacity: offer.opacity, transform: `${offer.transform} scale(${pulse})` }}
        />
      </SafeBox>
      <SafeBox band="lower" justify="flex-start">
        {p.sub ? (
          <div
            style={{
              marginTop: 20,
              padding: "16px 44px",
              border: "4px dashed #fff",
              borderRadius: 22,
              background: "rgba(0,0,0,0.5)",
              ...enter(f, 36, "rise", stop),
            }}
          >
            <Text lines={[p.sub]} max={50} width={680} variant="plain" />
          </div>
        ) : null}
        {p.deadline ? <Text lines={[p.deadline]} max={42} style={{ marginTop: 22, ...enter(f, 45, "rise", stop) }} /> : null}
      </SafeBox>
    </>
  );
};

export const Comp: React.FC<P> = (raw) => {
  const p: P = raw.cta ? { ...raw, cta: { band: "lower", ...raw.cta } } : raw;
  const total = duration(p);
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={p.clips} />
      <Dim amount={p.dim ?? 0.35} />
      <Layers p={p} stop={ctaStart(p, total)} />
    </Stage>
  );
};
