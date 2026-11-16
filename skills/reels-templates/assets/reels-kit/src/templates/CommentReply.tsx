import React from "react";
import { Easing, Sequence, useCurrentFrame } from "remotion";
import { z } from "zod";
import { bandSchema, ClipSeries, clipSchema, common, ctaStart, enter, SAFE, SafeBox, sec, Stage, Text, totalFrames, tween, useBrand } from "../lib/kit";

// A viewer comment pinned on screen as the hook, answered by the footage and timed caption lines.
// Do not set `hook` here: the comment bubble sits in the top band.
export const schema = z.object({
  comment: z.object({ user: z.string(), text: z.string(), label: z.string().optional(), duration: z.number().optional() }),
  clips: z.array(clipSchema).min(1),
  answers: z.array(z.object({ text: z.string(), start: z.number(), end: z.number() })).optional(),
  answerBand: bandSchema.optional(),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.clips);

const Bubble: React.FC<{ c: P["comment"]; end: number }> = ({ c, end }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const pop = tween(f, 9, sec(0.45), 0, 1, Easing.out(Easing.back(2)));
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        top: SAFE.top + 16,
        maxWidth: 660,
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
        background: "#fff",
        borderRadius: 30,
        padding: "24px 30px",
        boxShadow: "0 12px 34px rgba(0,0,0,0.5)",
        fontFamily: b.family,
        transformOrigin: "left top",
        opacity: tween(f, 9, 9, 0, 1) * tween(f, end - 9, 9, 1, 0),
        transform: `scale(${0.7 + 0.3 * pop}) rotate(-3deg)`,
      }}
    >
      <div
        style={{
          flex: "none",
          width: 76,
          height: 76,
          borderRadius: 38,
          background: b.accent,
          color: "#111",
          fontWeight: b.bold,
          fontSize: 40,
          lineHeight: "76px",
          textAlign: "center",
        }}
      >
        {c.user.replace("@", "").charAt(0).toUpperCase()}
      </div>
      <div>
        <div style={{ fontSize: 28, fontWeight: b.regular, color: "#777", lineHeight: 1.25 }}>{c.label ?? `Replying to ${c.user}`}</div>
        <div style={{ fontSize: 42, fontWeight: b.bold, color: "#111", lineHeight: 1.25, marginTop: 6 }}>{c.text}</div>
      </div>
    </div>
  );
};

const Answer: React.FC<{ text: string; dur: number; band: z.infer<typeof bandSchema> }> = ({ text, dur, band }) => {
  const f = useCurrentFrame();
  return (
    <SafeBox band={band}>
      <Text lines={text.split("\n")} max={64} style={enter(f, 0, "pop", dur)} />
    </SafeBox>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  const stop = ctaStart(p, total);
  const bubbleEnd = p.comment.duration ? Math.min(sec(p.comment.duration), stop) : stop;
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={p.clips} />
      <Sequence from={0} durationInFrames={bubbleEnd} layout="none">
        <Bubble c={p.comment} end={bubbleEnd} />
      </Sequence>
      {(p.answers ?? []).map((a, i) => {
        const from = sec(a.start);
        const dur = Math.min(sec(a.end), stop) - from;
        return dur > 12 ? (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <Answer text={a.text} dur={dur} band={p.answerBand ?? "lower"} />
          </Sequence>
        ) : null;
      })}
    </Stage>
  );
};
