import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Backdrop, backgroundSchema, clipSchema, common, IntroThenClips, SAFE, sec, Stage, totalFrames, tween, UI_FONT, useBrand } from "../lib/kit";

// A lock screen: notifications drop in one after another (orders, messages, reviews), then the footage.
// Leave `hook` out: the clock and the stack fill the safe zone.
const noteSchema = z.object({ app: z.string(), title: z.string(), text: z.string().optional(), icon: z.string().optional(), color: z.string().optional(), at: z.number().optional() });
export const schema = z.object({
  clock: z.string().optional(),
  date: z.string().optional(),
  now: z.string().optional(),
  notifications: z.array(noteSchema).min(1).max(6),
  every: z.number().optional(),
  background: backgroundSchema,
  blur: z.number().optional(),
  hold: z.number().optional(),
  clips: z.array(clipSchema).optional(),
  ...common,
});
type P = z.infer<typeof schema>;

const schedule = (p: P) => p.notifications.map((n, i) => sec(n.at ?? 0.7 + i * (p.every ?? 1.1)));
const introFrames = (p: P) => Math.max(...schedule(p)) + sec(p.hold ?? 1.8);
export const duration = (p: P) => introFrames(p) + totalFrames(p.clips ?? []);

const Screen: React.FC<{ p: P }> = ({ p }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const at = schedule(p);
  // Newest on top, like a real lock screen.
  const order = p.notifications.map((n, i) => ({ n, at: at[i] })).filter((x) => f >= x.at).sort((a, c) => c.at - a.at);
  return (
    <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: SAFE.top, height: SAFE.bottom - SAFE.top, fontFamily: UI_FONT, color: "#fff", overflow: "hidden" }}>
      <div style={{ textAlign: "center", textShadow: "0 4px 24px rgba(0,0,0,0.5)" }}>
        {p.date ? <div style={{ fontSize: 34, fontWeight: 600, marginTop: 6 }}>{p.date}</div> : null}
        <div style={{ fontSize: 168, fontWeight: 700, lineHeight: 1.05, letterSpacing: -4 }}>{p.clock ?? "9:41"}</div>
      </div>
      <div style={{ marginTop: 18 }}>
        {order.map(({ n, at: start }) => {
          const drop = tween(f, start, sec(0.4), 0, 1, Easing.out(Easing.back(1.5)));
          return (
            <div key={start} style={{ maxHeight: tween(f, start, 12, 0, 240), marginBottom: 14 }}>
              <div
                style={{
                  display: "flex",
                  gap: 22,
                  alignItems: "center",
                  padding: "22px 26px",
                  borderRadius: 34,
                  background: "rgba(246,246,248,0.94)",
                  color: "#111",
                  boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
                  opacity: tween(f, start, 8, 0, 1),
                  transform: `translateY(${-50 * (1 - drop)}px) scale(${0.9 + 0.1 * drop})`,
                }}
              >
                <div style={{ flex: "none", width: 88, height: 88, borderRadius: 22, background: n.color ?? b.accent, fontSize: 50, lineHeight: "88px", textAlign: "center" }}>{n.icon ?? "🔔"}</div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: "#77777c", fontWeight: 600, letterSpacing: 1 }}>
                    <span>{n.app.toUpperCase()}</span>
                    <span style={{ fontWeight: 400 }}>{p.now ?? "now"}</span>
                  </div>
                  <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                  {n.text ? <div style={{ fontSize: 31, lineHeight: 1.25, color: "#333", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{n.text}</div> : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const Comp: React.FC<P> = (p) => {
  const intro = introFrames(p);
  return (
    <Stage p={p} total={duration(p)}>
      <IntroThenClips intro={intro} clips={p.clips}>
        <Backdrop bg={p.background} frames={intro} blur={p.blur ?? 12} dim={0.35} />
        <Screen p={p} />
      </IntroThenClips>
    </Stage>
  );
};
