import React from "react";
import { AbsoluteFill, Easing, useCurrentFrame } from "remotion";
import { z } from "zod";
import { common, ctaStart, H, Media, SAFE, sec, Stage, tween, useBrand, W } from "../lib/kit";

// Before vs after. "wipe": a line sweeps across and reveals the after shot. "split": both halves at once.
const side = z.object({ src: z.string(), start: z.number().optional(), focus: z.string().optional(), label: z.string().optional() });
export const schema = z.object({
  before: side,
  after: side,
  mode: z.enum(["wipe", "split"]).optional(),
  duration: z.number().optional(),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => sec(p.duration ?? 8);

const Pill: React.FC<{ text: string; on?: boolean; style?: React.CSSProperties }> = ({ text, on, style }) => {
  const b = useBrand();
  return (
    <div
      style={{
        position: "absolute",
        padding: "14px 38px",
        borderRadius: 999,
        background: on ? b.accent : "rgba(0,0,0,0.7)",
        color: on ? "#111" : "#fff",
        fontFamily: b.family,
        fontWeight: b.bold,
        fontSize: 44,
        lineHeight: 1.2,
        letterSpacing: 3,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {text}
    </div>
  );
};

export const Comp: React.FC<P> = (p) => (
  <Stage p={p} total={duration(p)}>
    <Inner p={p} />
  </Stage>
);

const Inner: React.FC<{ p: P }> = ({ p }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const total = duration(p);
  const stop = ctaStart(p, total);
  const before = p.before.label ?? "BEFORE";
  const after = p.after.label ?? "AFTER";
  const fade = tween(f, stop - 9, 9, 1, 0);

  if (p.mode === "split") {
    const half: React.CSSProperties = { position: "absolute", left: 0, width: W, height: H / 2, overflow: "hidden" };
    return (
      <>
        <div style={{ ...half, top: 0 }}>
          <Media src={p.before.src} start={p.before.start} focus={p.before.focus} frames={total} />
        </div>
        <div style={{ ...half, top: H / 2 }}>
          <Media src={p.after.src} start={p.after.start} focus={p.after.focus} frames={total} />
        </div>
        <div style={{ position: "absolute", left: 0, width: W, top: H / 2 - 3, height: 6, background: "#fff" }} />
        <Pill text={before} style={{ left: SAFE.left, top: 300, opacity: tween(f, 6, 12, 0, 1) * fade }} />
        <Pill text={after} on style={{ left: SAFE.left, top: H / 2 + 24, opacity: tween(f, 18, 12, 0, 1) }} />
      </>
    );
  }

  const start = Math.round(total * 0.38);
  const x = tween(f, start, sec(0.9), 0, W, Easing.inOut(Easing.cubic));
  const centre = { left: SAFE.left, width: SAFE.width, top: 1150, display: "flex", justifyContent: "center" } as const;
  return (
    <>
      <AbsoluteFill>
        <Media src={p.before.src} start={p.before.start} focus={p.before.focus} frames={total} />
      </AbsoluteFill>
      <AbsoluteFill style={{ clipPath: `inset(0 ${W - x}px 0 0)` }}>
        <Media src={p.after.src} start={p.after.start} focus={p.after.focus} frames={total} />
      </AbsoluteFill>
      {x > 0 && x < W ? (
        <div style={{ position: "absolute", left: x - 4, top: 0, width: 8, height: H, background: "#fff", boxShadow: `0 0 28px 6px ${b.accent}` }} />
      ) : null}
      <div style={{ position: "absolute", ...centre }}>
        <Pill text={before} style={{ position: "relative", opacity: tween(f, 6, 12, 0, 1) * tween(f, start + sec(0.3), 9, 1, 0) }} />
      </div>
      <div style={{ position: "absolute", ...centre }}>
        <Pill text={after} on style={{ position: "relative", opacity: tween(f, start + sec(0.55), 12, 0, 1), transform: `scale(${tween(f, start + sec(0.55), sec(0.4), 0.8, 1, Easing.out(Easing.back(2)))})` }} />
      </div>
    </>
  );
};
