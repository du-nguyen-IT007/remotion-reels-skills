import React from "react";
import { Easing, Img, useCurrentFrame } from "remotion";
import { z } from "zod";
import { Backdrop, backgroundSchema, Card, clipSchema, common, IntroThenClips, sec, Stage, totalFrames, tween, url } from "../lib/kit";

// A text-message thread that plays out message by message, then cuts to the product footage.
// The card fills the safe zone, so leave `hook` out and set the CTA for the footage part.
const messageSchema = z.object({ from: z.enum(["me", "them"]), text: z.string().optional(), image: z.string().optional(), at: z.number().optional() });
export const schema = z.object({
  contact: z.object({ name: z.string(), avatar: z.string().optional(), status: z.string().optional() }),
  messages: z.array(messageSchema).min(1),
  theme: z.enum(["light", "dark"]).optional(),
  bubbleColor: z.string().optional(),
  background: backgroundSchema,
  hold: z.number().optional(),
  clips: z.array(clipSchema).optional(),
  ...common,
});
type P = z.infer<typeof schema>;

// When each message lands (seconds): its own `at`, or after a reading pause that grows with the previous text.
const schedule = (p: P) => {
  let t = 0.5;
  return p.messages.map((m) => {
    const at = m.at ?? t;
    t = at + 0.75 + Math.min(2.2, (m.text?.length ?? 0) * 0.04) + (m.image ? 0.8 : 0);
    return at;
  });
};
const introFrames = (p: P) => {
  const at = schedule(p);
  return sec(at[at.length - 1] + (p.hold ?? 1.6));
};
export const duration = (p: P) => introFrames(p) + totalFrames(p.clips ?? []);

const Thread: React.FC<{ p: P }> = ({ p }) => {
  const f = useCurrentFrame();
  const dark = p.theme === "dark";
  const at = schedule(p).map(sec);
  const mine = p.bubbleColor ?? "#0A84FF";
  const theirs = dark ? "#26262A" : "#E9E9EB";
  const next = p.messages.findIndex((_, i) => f < at[i]);
  // Three dots before each incoming message.
  const typing = next >= 0 && p.messages[next].from === "them" && f >= at[next] - sec(0.7) && (next === 0 || f >= at[next - 1] + 12);
  return (
    <Card dark={dark}>
      <div style={{ height: 168, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", borderBottom: `2px solid ${dark ? "#222" : "#eee"}` }}>
        {p.contact.avatar ? (
          <Img src={url(p.contact.avatar)} style={{ width: 84, height: 84, borderRadius: 42, objectFit: "cover" }} />
        ) : (
          <div style={{ width: 84, height: 84, borderRadius: 42, background: "linear-gradient(#b5b9c4, #868b98)", color: "#fff", fontSize: 42, fontWeight: 600, lineHeight: "84px", textAlign: "center" }}>
            {p.contact.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 30, fontWeight: 600, marginTop: 8 }}>{p.contact.name}</div>
        {p.contact.status ? <div style={{ fontSize: 22, color: "#8e8e93" }}>{p.contact.status}</div> : null}
      </div>
      <div style={{ position: "absolute", top: 170, bottom: 0, left: 0, right: 0, padding: "0 28px 30px", display: "flex", flexDirection: "column", justifyContent: "flex-end", overflow: "hidden" }}>
        {p.messages.map((m, i) => {
          if (f < at[i]) return null;
          const me = m.from === "me";
          const pop = tween(f, at[i], sec(0.3), 0, 1, Easing.out(Easing.back(1.6)));
          return (
            // The wrapper grows from nothing so older messages slide up instead of jumping.
            <div key={i} style={{ maxHeight: tween(f, at[i], 10, 0, 700), display: "flex", flexDirection: "column", flex: "none" }}>
              <div
                style={{
                  alignSelf: me ? "flex-end" : "flex-start",
                  marginTop: 14,
                  maxWidth: 580,
                  transformOrigin: me ? "right bottom" : "left bottom",
                  transform: `scale(${0.5 + 0.5 * pop})`,
                  opacity: tween(f, at[i], 6, 0, 1),
                }}
              >
                {m.image ? <Img src={url(m.image)} style={{ display: "block", width: 400, height: 400, objectFit: "cover", borderRadius: 34, marginBottom: m.text ? 10 : 0 }} /> : null}
                {m.text ? (
                  <div style={{ padding: "18px 28px", borderRadius: 36, fontSize: 38, lineHeight: 1.26, whiteSpace: "pre-wrap", background: me ? mine : theirs, color: me || dark ? "#fff" : "#111" }}>
                    {m.text}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
        {typing ? (
          <div style={{ alignSelf: "flex-start", marginTop: 14, padding: "24px 28px", borderRadius: 36, background: theirs, display: "flex", gap: 10, flex: "none" }}>
            {[0, 1, 2].map((d) => (
              <div key={d} style={{ width: 16, height: 16, borderRadius: 8, background: "#8e8e93", opacity: 0.4 + 0.6 * Math.abs(Math.sin(f / 9 - d * 0.9)) }} />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
};

export const Comp: React.FC<P> = (p) => {
  const intro = introFrames(p);
  return (
    <Stage p={p} total={duration(p)}>
      <IntroThenClips intro={intro} clips={p.clips}>
        <Backdrop bg={p.background} frames={intro} />
        <Thread p={p} />
      </IntroThenClips>
    </Stage>
  );
};
