import React from "react";
import { AbsoluteFill, Sequence, useCurrentFrame } from "remotion";
import { fitText } from "@remotion/layout-utils";
import { z } from "zod";
import { common, ctaFrames, HAND_FONT, Media, SAFE, sec, Stage, tween } from "../lib/kit";

// A scrapbook photo dump: instant photos slap down onto paper one by one, each with a handwritten caption.
// Leave `hook` out: `title` is the handwritten headline in the top band.
export const schema = z.object({
  title: z.string().optional(),
  photos: z.array(z.object({ src: z.string(), start: z.number().optional(), caption: z.string().optional(), focus: z.string().optional() })).min(2).max(8),
  every: z.number().optional(),
  paper: z.string().optional(),
  hold: z.number().optional(),
  ...common,
});
type P = z.infer<typeof schema>;
const landAt = (p: P, i: number) => sec(0.5 + i * (p.every ?? 0.8));
export const duration = (p: P) => landAt(p, p.photos.length - 1) + sec(p.hold ?? 1.4) + ctaFrames(p);

// A fixed pile layout, so the same job always renders the same frame.
const LEFT = [10, 360, 130, 340, 40, 250, 180, 370];
const TOP = [30, 110, 60, 130, 10, 90, 40, 120];
const TILT = [-7, 5, -3, 8, -5, 4, -2, 6];
const CARD = 420;

const Photo: React.FC<{ photo: P["photos"][number]; i: number; frames: number }> = ({ photo, i, frames }) => {
  const f = useCurrentFrame();
  const land = tween(f, 0, sec(0.28), 0, 1);
  const caption = photo.caption ?? "";
  const size = caption ? Math.min(46, fitText({ text: caption, withinWidth: CARD - 56, fontFamily: HAND_FONT, fontWeight: 700 }).fontSize) : 0;
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left + LEFT[i % 8],
        top: 530 + TOP[i % 8],
        width: CARD,
        boxSizing: "border-box",
        padding: "22px 22px 0",
        background: "#fff",
        boxShadow: `0 ${10 + 30 * (1 - land)}px ${24 + 40 * (1 - land)}px rgba(0,0,0,0.35)`,
        opacity: tween(f, 0, 6, 0, 1),
        transform: `rotate(${TILT[i % 8] + 14 * (1 - land)}deg) scale(${1.6 - 0.6 * land})`,
      }}
    >
      <div style={{ position: "absolute", left: CARD / 2 - 70, top: -20, width: 140, height: 42, background: "rgba(255,214,90,0.7)", transform: "rotate(-4deg)" }} />
      <div style={{ width: CARD - 44, height: CARD - 44, overflow: "hidden", background: "#ddd" }}>
        <Media src={photo.src} start={photo.start} focus={photo.focus} frames={frames} />
      </div>
      <div style={{ height: 88, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: HAND_FONT, fontWeight: 700, fontSize: size, color: "#333", whiteSpace: "nowrap" }}>
        {caption}
      </div>
    </div>
  );
};

const Title: React.FC<{ title: string; fadeAt?: number }> = ({ title, fadeAt }) => {
  const f = useCurrentFrame();
  const size = Math.min(112, fitText({ text: title, withinWidth: SAFE.width - 40, fontFamily: HAND_FONT, fontWeight: 700 }).fontSize);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: SAFE.top, height: 230, display: "flex", alignItems: "center", justifyContent: "center", opacity: tween(f, 3, 10, 0, 1) * (fadeAt ? tween(f, fadeAt - 9, 9, 1, 0) : 1) }}>
      <span style={{ fontFamily: HAND_FONT, fontWeight: 700, fontSize: size, color: "#222", whiteSpace: "nowrap", backgroundImage: "linear-gradient(transparent 62%, #FFD84A 62%, #FFD84A 92%, transparent 92%)", backgroundRepeat: "no-repeat", backgroundSize: `${tween(f, 12, 24, 0, 100)}% 100%`, padding: "0 12px" }}>
        {title}
      </span>
    </div>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  return (
    <Stage p={{ ...p, brand: { textStyle: "box", ...p.brand } }} total={total}>
      <AbsoluteFill style={{ backgroundColor: p.paper ?? "#EFE6D8", backgroundImage: "radial-gradient(rgba(0,0,0,0.09) 2px, transparent 2px)", backgroundSize: "44px 44px" }} />
      {p.title ? <Title title={p.title} fadeAt={p.cta ? total - ctaFrames(p) : undefined} /> : null}
      {p.photos.map((photo, i) => (
        <Sequence key={i} from={landAt(p, i)} layout="none">
          <Photo photo={photo} i={i} frames={total - landAt(p, i)} />
        </Sequence>
      ))}
    </Stage>
  );
};
