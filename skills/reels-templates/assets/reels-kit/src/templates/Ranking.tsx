import React from "react";
import { Easing, useCurrentFrame } from "remotion";
import { z } from "zod";
import { ClipSeries, clipSchema, common, ctaStart, hookFrames, layout, SAFE, SafeBox, sec, Stage, Text, totalFrames, tween, useBrand } from "../lib/kit";

// Blind ranking: an empty numbered list stays on screen and each clip's item drops into its rank.
// Order `items` the way they should play; put rank 1 last for the payoff.
export const schema = z.object({
  title: z.string(),
  items: z.array(z.object({ clip: clipSchema, label: z.string(), rank: z.number().int().min(1) })).min(2).max(6),
  placeAfter: z.number().optional(),
  ...common,
});
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.items.map((i) => i.clip));

const Board: React.FC<{ p: P; total: number }> = ({ p, total }) => {
  const f = useCurrentFrame();
  const b = useBrand();
  const lay = layout(p.items.map((i) => i.clip));
  const n = p.items.length;
  const row = Math.min(112, 620 / n);
  const stop = ctaStart(p, total);
  const titleOn = tween(f, hookFrames(p), 10, 0, 1) * tween(f, stop - 9, 9, 1, 0);
  return (
    <>
      <SafeBox band="top">
        <Text lines={p.title.split("\n")} max={62} variant="box" style={{ opacity: titleOn }} />
      </SafeBox>
      <div style={{ position: "absolute", left: SAFE.left, width: SAFE.width, top: SAFE.bottom - row * n }}>
        {Array.from({ length: n }, (_, r) => {
          const idx = p.items.findIndex((it) => it.rank === r + 1);
          const placed = idx >= 0 ? lay[idx].from + sec(p.placeAfter ?? 0.7) : Infinity;
          const on = f >= placed;
          const hit = on ? tween(f, placed, sec(0.4), 0, 1, Easing.out(Easing.back(2.4))) : 0;
          return (
            <div key={r} style={{ height: row, display: "flex", alignItems: "center", gap: 22 }}>
              <div
                style={{
                  flex: "none",
                  width: row * 0.74,
                  height: row * 0.74,
                  borderRadius: row * 0.2,
                  background: on ? b.accent : "rgba(0,0,0,0.55)",
                  border: `3px solid ${on ? b.accent : "rgba(255,255,255,0.8)"}`,
                  boxSizing: "border-box",
                  color: on ? "#111" : "#fff",
                  fontFamily: b.family,
                  fontWeight: b.bold,
                  fontSize: row * 0.46,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transform: `scale(${1 + 0.25 * (on ? 1 - tween(f, placed, sec(0.3), 0, 1) : 0)})`,
                }}
              >
                {r + 1}
              </div>
              {on ? (
                <Text
                  lines={[p.items[idx].label]}
                  max={row * 0.52}
                  width={SAFE.width - row}
                  style={{ textAlign: "left", opacity: tween(f, placed, 6, 0, 1), transform: `translateX(${-60 * (1 - hit)}px)` }}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
};

export const Comp: React.FC<P> = (p) => {
  const total = duration(p);
  return (
    <Stage p={p} total={total}>
      <ClipSeries clips={p.items.map((i) => i.clip)} />
      <Board p={p} total={total} />
    </Stage>
  );
};
