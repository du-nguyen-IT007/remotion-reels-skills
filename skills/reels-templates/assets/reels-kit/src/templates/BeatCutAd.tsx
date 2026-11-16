import React from "react";
import { z } from "zod";
import { ClipSeries, clipSchema, common, Stage, totalFrames } from "../lib/kit";

// Footage montage cut on the beat: hook over the first shot, CTA over the last.
export const schema = z.object({ clips: z.array(clipSchema).min(1), ...common });
type P = z.infer<typeof schema>;
export const duration = (p: P) => totalFrames(p.clips);

export const Comp: React.FC<P> = (p) => (
  <Stage p={p} total={duration(p)}>
    <ClipSeries clips={p.clips} />
  </Stage>
);
