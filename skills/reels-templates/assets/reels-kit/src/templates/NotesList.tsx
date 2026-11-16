import React from "react";
import { useCurrentFrame } from "remotion";
import { z } from "zod";
import { Backdrop, backgroundSchema, Card, clipSchema, common, FPS, IntroThenClips, sec, Stage, totalFrames, tween, typed, typeFrames } from "../lib/kit";

// A notes-app page that types itself: title, then a checklist. Then cuts to the product footage.
// The card fills the safe zone, so leave `hook` out and set the CTA for the footage part.
export const schema = z.object({
  title: z.string(),
  date: z.string().optional(),
  items: z.array(z.object({ text: z.string(), check: z.boolean().optional(), highlight: z.boolean().optional() })).min(1).max(7),
  cps: z.number().optional(),
  background: backgroundSchema,
  hold: z.number().optional(),
  clips: z.array(clipSchema).optional(),
  ...common,
});
type P = z.infer<typeof schema>;

const YELLOW = "#E0A800";
// Frame at which the title and each item start typing, and where the page is finished.
const plan = (p: P) => {
  const cps = p.cps ?? 26;
  let t = sec(0.3) + typeFrames(p.title, cps) + sec(0.35);
  const starts = p.items.map((it) => {
    const s = t;
    t = s + typeFrames(it.text, cps) + sec(0.45);
    return s;
  });
  return { cps, starts, end: t + sec(p.hold ?? 1.2) };
};
export const duration = (p: P) => plan(p).end + totalFrames(p.clips ?? []);

const Page: React.FC<{ p: P }> = ({ p }) => {
  const f = useCurrentFrame();
  const { cps, starts } = plan(p);
  const caret = <span style={{ color: YELLOW, opacity: Math.floor(f / (FPS / 3)) % 2 ? 0 : 1 }}>|</span>;
  const title = typed(p.title, f, sec(0.3), cps);
  return (
    <Card style={{ background: "#FFFEF8" }}>
      <div style={{ display: "flex", justifyContent: "space-between", padding: "34px 40px 0", fontSize: 34, color: YELLOW }}>
        <span>‹ Notes</span>
        <span style={{ letterSpacing: 4, fontWeight: 700 }}>•••</span>
      </div>
      {p.date ? <div style={{ textAlign: "center", fontSize: 24, color: "#a0a0a5", marginTop: 14 }}>{p.date}</div> : null}
      <div style={{ padding: "22px 44px 0" }}>
        <div style={{ fontSize: 56, fontWeight: 700, lineHeight: 1.18, minHeight: 66 }}>
          {title}
          {f < starts[0] ? caret : null}
        </div>
        {p.items.map((it, i) => {
          if (f < starts[i]) return null;
          const text = typed(it.text, f, starts[i], cps);
          const done = starts[i] + typeFrames(it.text, cps);
          const checked = it.check && f >= done + 8;
          const typingNow = f < done + 14 && (i === p.items.length - 1 || f < starts[i + 1]);
          return (
            <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 24, marginTop: 30 }}>
              <div
                style={{
                  flex: "none",
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  boxSizing: "border-box",
                  marginTop: 4,
                  border: `3px solid ${checked ? YELLOW : "#c8c8cc"}`,
                  background: checked ? YELLOW : "transparent",
                  color: "#fff",
                  fontSize: 34,
                  fontWeight: 700,
                  lineHeight: "48px",
                  textAlign: "center",
                  transform: `scale(${checked ? tween(f, done + 8, 10, 1.4, 1) : 1})`,
                }}
              >
                {checked ? "✓" : ""}
              </div>
              <div style={{ fontSize: 46, lineHeight: 1.3, color: "#1c1c1e" }}>
                <span
                  style={
                    it.highlight
                      ? { backgroundImage: "linear-gradient(#FFE45C, #FFE45C)", backgroundRepeat: "no-repeat", backgroundSize: `${tween(f, done + 6, 18, 0, 100)}% 100%`, fontWeight: 700 }
                      : undefined
                  }
                >
                  {text}
                </span>
                {typingNow && f < done ? caret : null}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
};

export const Comp: React.FC<P> = (p) => {
  const intro = plan(p).end;
  return (
    <Stage p={p} total={duration(p)}>
      <IntroThenClips intro={intro} clips={p.clips}>
        <Backdrop bg={p.background} frames={intro} />
        <Page p={p} />
      </IntroThenClips>
    </Stage>
  );
};
