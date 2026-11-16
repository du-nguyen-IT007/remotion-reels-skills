import React, { createContext, useContext, useEffect, useState } from "react";
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { fitText } from "@remotion/layout-utils";
import { z } from "zod";
import { loadFont as loadPoppins } from "@remotion/google-fonts/Poppins";
import { loadFont as loadMontserrat } from "@remotion/google-fonts/Montserrat";
import { loadFont as loadAnton } from "@remotion/google-fonts/Anton";
import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadCaveat } from "@remotion/google-fonts/Caveat";
import { loadFont as loadNotoJP } from "@remotion/google-fonts/NotoSansJP";

// Shared kit for every template: canvas, safe zone, fonts, text, media, transitions, hook, CTA.
// All text is placed inside the TikTok + Reels ads safe box: x 140-940, y 288-1248.

export const FPS = 60;
export const W = 1080;
export const H = 1920;
export const SAFE = { left: 140, top: 288, width: 800, bottom: 1248 };
export const BANDS = { top: [288, 600], middle: [600, 930], lower: [930, 1248] } as const;
export type Band = keyof typeof BANDS;
export const sec = (s: number) => Math.round(s * FPS);

// ---------- schemas shared by all templates ----------

export const bandSchema = z.enum(["top", "middle", "lower"]);
export const textSchema = z.object({
  lines: z.array(z.string()).min(1).max(3),
  band: bandSchema.optional(),
  size: z.number().optional(),
  duration: z.number().optional(),
});
export const ctaSchema = textSchema.extend({ button: z.string().optional() });
export const transitionSchema = z.enum(["cut", "flash", "zoom", "whip", "focus"]);
export const clipSchema = z.object({
  src: z.string(),
  start: z.number().optional(),
  duration: z.number(),
  speed: z.number().optional(),
  focus: z.string().optional(),
  transition: transitionSchema.optional(),
  // Simulated camera, to turn one static source into several "angles":
  zoom: z.number().min(1).max(2.5).optional(), // punch-in around `focus`
  tilt: z.number().min(-15).max(15).optional(), // dutch angle in degrees
  push: z.number().min(0).max(0.6).optional(), // how hard the camera lunges in when the clip arrives
});
export const common = {
  hook: textSchema.optional(),
  cta: ctaSchema.optional(),
  music: z.object({ src: z.string(), volume: z.number().optional() }).optional(),
  brand: z
    .object({
      accent: z.string().optional(),
      font: z.enum(["poppins", "montserrat", "anton"]).optional(),
      textStyle: z.enum(["outline", "box", "caption"]).optional(),
    })
    .optional(),
  _guides: z.boolean().optional(),
  // Set by render.mjs: the keys the job file really has, so the example's defaults do not leak into a job.
  _keys: z.array(z.string()).optional(),
};
const commonSchema = z.object(common);
export type Common = z.infer<typeof commonSchema>;
export type Clip = z.infer<typeof clipSchema>;
export type TextBlock = z.infer<typeof textSchema>;
export type CtaBlock = z.infer<typeof ctaSchema>;

// ---------- fonts and brand ----------

const FONTS = {
  poppins: { ...loadPoppins("normal", { weights: ["500", "700"], subsets: ["latin", "latin-ext"] }), bold: 700, regular: 500 },
  montserrat: {
    ...loadMontserrat("normal", { weights: ["500", "800"], subsets: ["latin", "latin-ext", "vietnamese"] }),
    bold: 800,
    regular: 500,
  },
  anton: { ...loadAnton("normal", { weights: ["400"], subsets: ["latin", "latin-ext", "vietnamese"] }), bold: 400, regular: 400 },
};
// Interface font for the social-native cards (chat, notes, search, notifications) and a handwriting font.
const inter = loadInter("normal", { weights: ["400", "600", "700"], subsets: ["latin", "latin-ext", "vietnamese"] });
const caveat = loadCaveat("normal", { weights: ["700"], subsets: ["latin", "latin-ext"] });
export const UI_FONT = `${inter.fontFamily}, "Noto Sans JP", sans-serif`;
export const HAND_FONT = `${caveat.fontFamily}, "Noto Sans JP", cursive`;
const CJK = /[぀-ヿ㐀-鿿＀-￯]/;
export const isCJK = (s: string) => CJK.test(s);

function useFontsReady(p: unknown) {
  const [ready, setReady] = useState(false);
  const [handle] = useState(() => delayRender("Loading fonts"));
  useEffect(() => {
    const waits = [...Object.values(FONTS), inter, caveat].map((f) => f.waitUntilDone());
    // Noto Sans JP is about 120 requests, so it loads only when the copy needs it.
    if (isCJK(JSON.stringify(p))) waits.push(loadNotoJP("normal", { weights: ["700"] }).waitUntilDone());
    Promise.all(waits).then(() => {
      setReady(true);
      continueRender(handle);
    });
  }, [handle]);
  return ready;
}

type Brand = { accent: string; family: string; bold: number; regular: number; textStyle: "outline" | "box" | "caption" };
const BrandCtx = createContext<Brand>({ accent: "#FFD400", family: "sans-serif", bold: 700, regular: 500, textStyle: "outline" });
export const useBrand = () => useContext(BrandCtx);

// ---------- animation helpers ----------

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const tween = (
  f: number,
  start: number,
  len: number,
  from: number,
  to: number,
  easing: (t: number) => number = Easing.out(Easing.cubic),
) => interpolate(f, [start, start + Math.max(1, len)], [from, to], { ...clamp, easing });

// Entrance at frame `at` (pop = scale up, rise = slide up); fades out before `end` when given.
export const enter = (f: number, at = 0, kind: "pop" | "rise" = "pop", end?: number): React.CSSProperties => {
  const t = tween(f, at, sec(0.45), 0, 1, Easing.out(Easing.back(1.8)));
  let opacity = tween(f, at, sec(0.15), 0, 1, Easing.linear);
  if (end !== undefined) opacity *= tween(f, end - sec(0.15), sec(0.15), 1, 0, Easing.linear);
  return { opacity, transform: kind === "pop" ? `scale(${0.85 + 0.15 * t})` : `translateY(${40 * (1 - t)}px)` };
};

// ---------- text ----------

const strip = (s: string) => s.replace(/\*/g, "");
const outline = (w: number) =>
  Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * Math.PI * 2;
    return `${(Math.cos(a) * w).toFixed(1)}px ${(Math.sin(a) * w).toFixed(1)}px 0 #000`;
  })
    .concat(`0 ${w * 2}px ${w * 6}px rgba(0,0,0,0.6)`)
    .join(", ");

// One or more lines, each shrunk to fit `width`. Wrap a word in *asterisks* to highlight it.
export const Text: React.FC<{
  lines: string[];
  max?: number;
  width?: number;
  maxHeight?: number;
  variant?: "outline" | "box" | "plain" | "caption";
  color?: string;
  weight?: number;
  style?: React.CSSProperties;
}> = ({ lines, max = 72, width = SAFE.width, maxHeight, variant, color = "#fff", weight, style }) => {
  const b = useBrand();
  const v = variant ?? b.textStyle;
  // "caption": the native in-app caption look, white sentence-case text in one dark rounded box.
  const cap = v === "caption";
  const family = cap ? UI_FONT : b.family;
  const fw = weight ?? (cap ? 600 : b.bold);
  const lh = v === "box" ? 1.5 : cap ? 1.32 : 1.18;
  const fitW = v === "box" ? width * 0.86 : cap ? width - 72 : width - 16;
  let size = cap ? Math.min(max, 46) : max;
  for (const l of lines) {
    size = Math.min(size, fitText({ text: strip(l), withinWidth: fitW, fontFamily: family, fontWeight: fw }).fontSize);
  }
  if (maxHeight) size = Math.min(size, maxHeight / (lh * lines.length));
  const rich = (l: string) =>
    l.split("*").map((part, i) => (i % 2 && v !== "box" ? <span key={i} style={{ color: b.accent }}>{part}</span> : part));
  return (
    <div
      style={{
        fontFamily: family,
        fontWeight: fw,
        fontSize: size,
        lineHeight: lh,
        textAlign: "center",
        whiteSpace: "nowrap",
        color,
        ...(cap ? { background: "rgba(38,38,40,0.74)", borderRadius: 22, padding: "14px 30px 16px" } : null),
        textShadow: v === "outline" ? outline(Math.min(8, Math.max(2, size / 20))) : v === "plain" ? "0 2px 14px rgba(0,0,0,0.75)" : undefined,
        ...style,
      }}
    >
      {lines.map((l, i) => (
        <div key={i}>
          {v === "box" ? (
            <span style={{ background: l.includes("*") ? b.accent : "#fff", color: "#111", padding: "0.12em 0.4em", borderRadius: "0.22em" }}>
              {rich(l)}
            </span>
          ) : (
            rich(l)
          )}
        </div>
      ))}
    </div>
  );
};

// A box inside the safe zone. Use a named band, or explicit top/height (must stay within y 288-1248).
export const SafeBox: React.FC<
  React.PropsWithChildren<{ band?: Band; top?: number; height?: number; justify?: "center" | "flex-start" | "flex-end"; style?: React.CSSProperties }>
> = ({ band = "top", top, height, justify = "center", style, children }) => {
  const t = top ?? BANDS[band][0];
  const h = height ?? BANDS[band][1] - BANDS[band][0];
  return (
    <div
      style={{
        position: "absolute",
        left: SAFE.left,
        width: SAFE.width,
        top: t,
        height: h,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: justify,
        ...style,
      }}
    >
      {children}
    </div>
  );
};
export const bandHeight = (band: Band) => BANDS[band][1] - BANDS[band][0];

// ---------- media ----------

const isVideo = (src: string) => /\.(mp4|mov|webm|m4v)(\?|$)/i.test(src);
export const url = (src: string) => (/^https?:\/\//.test(src) ? src : staticFile(src));
const position = (focus = "center") => (focus === "top" ? "center top" : focus === "bottom" ? "center bottom" : focus);

// A video (trimmed to `start` seconds, muted unless told otherwise) or a still image with a slow push-in.
export const Media: React.FC<{ src: string; start?: number; speed?: number; focus?: string; frames: number; muted?: boolean; volume?: number }> = ({
  src,
  start = 0,
  speed = 1,
  focus,
  frames,
  muted = true,
  volume = 1,
}) => {
  const f = useCurrentFrame();
  const fill: React.CSSProperties = { width: "100%", height: "100%", objectFit: "cover", objectPosition: position(focus) };
  if (isVideo(src)) {
    return <OffthreadVideo src={url(src)} muted={muted} volume={volume} trimBefore={sec(start)} playbackRate={speed} style={fill} />;
  }
  return <Img src={url(src)} style={{ ...fill, transform: `scale(${tween(f, 0, frames, 1.02, 1.12, Easing.linear)})` }} />;
};

// ---------- clip series with transitions ----------

export const layout = (clips: { duration: number }[]) => {
  let t = 0;
  return clips.map((c) => {
    const from = sec(t);
    t += c.duration;
    return { from, dur: sec(t) - from };
  });
};
export const totalFrames = (clips: { duration: number }[]) => sec(clips.reduce((a, c) => a + c.duration, 0));

type Transition = z.infer<typeof transitionSchema>;
const OUT_LEN: Record<Transition, number> = { cut: 0, flash: 0.18, zoom: 0.18, whip: 0.14, focus: 0.22 };
const IN1 = Easing.in(Easing.sin);
const OUT1 = Easing.out(Easing.sin);
const IN2 = Easing.in(Easing.quad);
const OUT2 = Easing.out(Easing.quad);
const IN3 = Easing.in(Easing.cubic);
const OUT3 = Easing.out(Easing.cubic);

// Transform and filter of a clip at local frame lf. `tin` is how it arrives, `tout` how the next clip arrives.
// Each transition swaps exactly at the cut, so no frame from outside a clip's own range is ever shown.
function clipLook(lf: number, dur: number, tin: Transition, tout: Transition) {
  const L = { x: 0, skew: 0, scale: 1, blur: 0, bright: 1 };
  const o = sec(OUT_LEN[tout]);
  if (tout !== "cut" && lf >= dur - o) {
    const s = dur - o;
    if (tout === "flash") {
      L.bright = tween(lf, s, o, 1, 2.6, IN2);
      L.scale = tween(lf, s, o, 1, 1.05, IN2);
    } else if (tout === "zoom") {
      L.scale = tween(lf, s, o, 1, 1.5, IN3);
      L.blur = tween(lf, s, o, 0, 10, IN3);
    } else if (tout === "whip") {
      // scale 1.3 keeps the skewed frame covering the canvas
      L.x = tween(lf, s, o, 0, -120, IN3);
      L.skew = tween(lf, s, o, 0, -4, IN3);
      L.scale = tween(lf, s, o, 1, 1.3, IN3);
      L.blur = tween(lf, s, o, 0, 14, IN3);
    } else {
      L.scale = tween(lf, s, o, 1, 1.05, IN1);
      L.blur = tween(lf, s, o, 0, 16, IN1);
    }
  } else if (tin === "flash") {
    L.bright = tween(lf, 0, sec(0.3), 1.8, 1, OUT2);
    L.scale = tween(lf, 0, sec(0.3), 1.04, 1, OUT2);
  } else if (tin === "zoom") {
    L.scale = tween(lf, 0, sec(0.22), 1.35, 1, OUT3);
    L.blur = tween(lf, 0, sec(0.22), 10, 0, OUT3);
  } else if (tin === "whip") {
    L.x = tween(lf, 0, sec(0.18), 120, 0, OUT3);
    L.skew = tween(lf, 0, sec(0.18), 4, 0, OUT3);
    L.scale = tween(lf, 0, sec(0.18), 1.3, 1, OUT3);
    L.blur = tween(lf, 0, sec(0.18), 14, 0, OUT3);
  } else if (tin === "focus") {
    L.scale = tween(lf, 0, sec(0.32), 1.04, 1, OUT1);
    L.blur = tween(lf, 0, sec(0.32), 16, 0, OUT1);
  }
  return L;
}

// `focus` as fractions of the frame, kept away from the edges so it can be a zoom/rotation origin.
const focusXY = (focus = "center"): [number, number] => {
  const named: Record<string, [number, number]> = { center: [0.5, 0.5], top: [0.5, 0.2], bottom: [0.5, 0.8] };
  if (named[focus]) return named[focus];
  const m = focus.match(/(-?[\d.]+)%\s+(-?[\d.]+)%/);
  const c = (v: number) => Math.min(0.9, Math.max(0.1, v / 100));
  return m ? [c(Number(m[1])), c(Number(m[2]))] : [0.5, 0.5];
};
// Smallest scale at which a frame rotated by `deg` around (ox, oy) still covers the canvas.
const coverScale = (ox: number, oy: number, deg: number) => {
  const r = (-deg * Math.PI) / 180;
  let s = 1;
  for (const [cx, cy] of [[0, 0], [W, 0], [0, H], [W, H]]) {
    const vx = cx - ox;
    const vy = cy - oy;
    const x = vx * Math.cos(r) - vy * Math.sin(r);
    const y = vx * Math.sin(r) + vy * Math.cos(r);
    s = Math.max(s, x > 0 ? x / (W - ox) : -x / ox, y > 0 ? y / (H - oy) : -y / oy);
  }
  return s;
};
// The simulated camera of a clip at local frame lf: it lunges in fast, settles, then keeps creeping forward.
function camera(lf: number, dur: number, c: Clip) {
  const zoom = c.zoom ?? 1;
  const tilt = c.tilt ?? 0;
  const push = c.push ?? 0;
  if (zoom === 1 && tilt === 0 && push === 0) return null;
  const [fx, fy] = focusXY(c.focus);
  const k = tween(lf, 0, sec(0.5), 0, 1, Easing.out(Easing.exp));
  const angle = tilt * (1 + 0.8 * (push > 0 ? 1 - k : 0));
  const creep = 1 + 0.05 * (lf / Math.max(1, dur));
  const scale = Math.max(coverScale(fx * W, fy * H, angle) * 1.01, zoom * (1 - push * (1 - k)) * creep);
  return { scale, angle, origin: `${fx * 100}% ${fy * 100}%`, blur: push > 0 ? tween(lf, 0, sec(0.16), 26 * push, 0) : 0 };
}

// Clips played back to back. `transition` on a clip is how that clip arrives (ignored on the first).
export const ClipSeries: React.FC<{ clips: Clip[]; muted?: boolean; volume?: number; lead?: Transition }> = ({ clips, muted = true, volume, lead = "cut" }) => {
  const f = useCurrentFrame();
  const lay = layout(clips);
  // `lead` is how the first clip arrives, for a series that starts after something else.
  const tin = (i: number): Transition => (i === 0 ? lead : (clips[i].transition ?? "cut"));
  let flash = 0;
  clips.forEach((_, i) => {
    if (tin(i) !== "flash") return;
    const cut = lay[i].from;
    flash = Math.max(flash, f < cut ? tween(f, cut - sec(0.14), sec(0.14), 0, 1, IN2) : tween(f, cut, sec(0.24), 1, 0, OUT2));
  });
  return (
    <>
      {clips.map((c, i) => {
        const { from, dur } = lay[i];
        const L = clipLook(f - from, dur, tin(i), clips[i + 1]?.transition ?? "cut");
        const cam = camera(f - from, dur, c);
        const blur = L.blur + (cam?.blur ?? 0);
        const filter = [blur > 0.05 ? `blur(${blur}px)` : "", L.bright !== 1 ? `brightness(${L.bright})` : ""].join(" ").trim();
        return (
          <Sequence key={i} from={from} durationInFrames={dur} layout="none">
            <AbsoluteFill
              style={{
                overflow: "hidden",
                transform: `translateX(${L.x}px) skewX(${L.skew}deg) scale(${L.scale})`,
                filter: filter || undefined,
              }}
            >
              <div style={{ width: "100%", height: "100%", transform: cam ? `scale(${cam.scale}) rotate(${cam.angle}deg)` : undefined, transformOrigin: cam?.origin }}>
                <Media src={c.src} start={c.start} speed={c.speed} focus={cam ? undefined : c.focus} frames={dur} muted={muted} volume={volume} />
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
    </>
  );
};

export const Dim: React.FC<{ amount?: number }> = ({ amount = 0.4 }) => (
  <AbsoluteFill style={{ backgroundColor: `rgba(0,0,0,${amount})` }} />
);

// ---------- social-native building blocks ----------

export const backgroundSchema = z.object({ src: z.string(), start: z.number().optional(), focus: z.string().optional() }).optional();
type Bg = z.infer<typeof backgroundSchema>;

// What sits behind an interface card: dimmed (optionally blurred) media, or a flat colour / gradient.
export const Backdrop: React.FC<{ bg?: Bg; frames: number; dim?: number; blur?: number; color?: string }> = ({ bg, frames, dim = 0.45, blur = 0, color }) => (
  <AbsoluteFill style={{ background: color ?? "linear-gradient(160deg, #23233b, #0f2c4f)" }}>
    {bg ? (
      <AbsoluteFill style={blur ? { filter: `blur(${blur}px)`, transform: "scale(1.1)" } : undefined}>
        <Media src={bg.src} start={bg.start} focus={bg.focus} frames={frames} />
      </AbsoluteFill>
    ) : null}
    {bg ? <Dim amount={dim} /> : null}
  </AbsoluteFill>
);

// An interface card that fills the safe zone (800 x 960 by default).
export const Card: React.FC<React.PropsWithChildren<{ dark?: boolean; top?: number; height?: number; style?: React.CSSProperties }>> = ({
  dark,
  top = SAFE.top,
  height = SAFE.bottom - SAFE.top,
  style,
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: SAFE.left,
      width: SAFE.width,
      top,
      height,
      borderRadius: 48,
      overflow: "hidden",
      background: dark ? "#0b0b0d" : "#fff",
      color: dark ? "#fff" : "#111",
      fontFamily: UI_FONT,
      boxShadow: "0 24px 70px rgba(0,0,0,0.55)",
      ...style,
    }}
  >
    {children}
  </div>
);

// The interface plays for `intro` frames, then zooms away as the product footage flashes in.
export const IntroThenClips: React.FC<React.PropsWithChildren<{ intro: number; clips?: Clip[] }>> = ({ intro, clips, children }) => {
  const f = useCurrentFrame();
  const has = Boolean(clips?.length);
  const leave: React.CSSProperties = has
    ? { opacity: tween(f, intro - 10, 10, 1, 0, Easing.linear), transform: `scale(${tween(f, intro - 14, 14, 1, 1.3, IN3)})` }
    : {};
  return (
    <>
      {!has || f < intro ? <AbsoluteFill style={leave}>{children}</AbsoluteFill> : null}
      {has ? (
        <Sequence from={intro} layout="none">
          <ClipSeries clips={clips!} lead="flash" />
        </Sequence>
      ) : null}
    </>
  );
};

// Typewriter: the part of `text` typed by frame f, at `cps` characters a second from frame `start`.
export const typed = (text: string, f: number, start: number, cps: number) => {
  const chars = Array.from(text);
  return chars.slice(0, Math.max(0, Math.floor(((f - start) / FPS) * cps))).join("");
};
export const typeFrames = (text: string, cps: number) => Math.ceil((Array.from(text).length / cps) * FPS);
export const compact = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : `${Math.round(n)}`);

// ---------- hook and CTA ----------

export const hookFrames = (p: Common) => (p.hook ? sec(p.hook.duration ?? 2.2) : 0);
export const ctaFrames = (p: Common) => (p.cta ? sec(p.cta.duration ?? 2.5) : 0);
// Frame at which the CTA takes over; other captions should end here.
export const ctaStart = (p: Common, total: number) => total - ctaFrames(p);

const Hook: React.FC<{ hook: TextBlock }> = ({ hook }) => {
  const f = useCurrentFrame();
  const band = hook.band ?? "top";
  const dur = sec(hook.duration ?? 2.2);
  const cap = useBrand().textStyle === "caption";
  return (
    <Sequence from={0} durationInFrames={dur} layout="none">
      <SafeBox band={band} justify={cap ? "flex-start" : "center"} style={cap ? { paddingTop: 12 } : undefined}>
        <Text
          lines={hook.lines}
          max={hook.size ?? 64}
          maxHeight={bandHeight(band) - (cap ? 60 : 0)}
          style={cap ? { opacity: tween(f, 0, 8, 0, 1) * tween(f, dur - 8, 8, 1, 0) } : enter(f, 0, "pop", dur)}
        />
      </SafeBox>
    </Sequence>
  );
};

const Cta: React.FC<{ cta: CtaBlock; from: number; dur: number }> = ({ cta, from, dur }) => {
  const f = useCurrentFrame() - from;
  const b = useBrand();
  const band = cta.band ?? "top";
  const buttonH = cta.button ? 130 : 0;
  const cap = b.textStyle === "caption";
  return (
    <Sequence from={from} durationInFrames={dur} layout="none">
      <SafeBox band={band} justify={cap ? "flex-start" : "center"} style={cap ? { paddingTop: 12 } : undefined}>
        <Text lines={cta.lines} max={cta.size ?? 72} maxHeight={bandHeight(band) - buttonH - (cap ? 60 : 0)} style={cap ? { opacity: tween(f, 0, 8, 0, 1) } : enter(f, 3, "rise")} />
        {cta.button ? (
          <div
            style={{
              marginTop: 26,
              padding: "18px 52px",
              borderRadius: 999,
              background: b.accent,
              color: "#111",
              fontFamily: b.family,
              fontWeight: b.bold,
              fontSize: 44,
              lineHeight: 1.2,
              whiteSpace: "nowrap",
              boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
              opacity: tween(f, sec(0.25), sec(0.15), 0, 1),
              transform: `scale(${tween(f, sec(0.25), sec(0.4), 0.8, 1, Easing.out(Easing.back(2))) * (1 + 0.03 * Math.sin((f / FPS) * Math.PI * 2.4))})`,
            }}
          >
            {cta.button}
          </div>
        ) : null}
      </SafeBox>
    </Sequence>
  );
};

const Guides: React.FC = () => (
  <AbsoluteFill>
    {(Object.keys(BANDS) as Band[]).map((k) => (
      <div
        key={k}
        style={{
          position: "absolute",
          left: SAFE.left,
          width: SAFE.width,
          top: BANDS[k][0],
          height: bandHeight(k),
          border: "3px dashed #39ff14",
          boxSizing: "border-box",
          color: "#39ff14",
          font: "700 26px monospace",
          padding: 6,
        }}
      >
        {k}
      </div>
    ))}
  </AbsoluteFill>
);

// ---------- stage: wraps every template ----------

// Black canvas, brand, fonts, music with a fade-out, then the hook and CTA on top of the template's own layers.
export const Stage: React.FC<React.PropsWithChildren<{ p: Common; total: number }>> = ({ p, total, children }) => {
  const ready = useFontsReady(p);
  const font = FONTS[p.brand?.font ?? "poppins"];
  const brand: Brand = {
    accent: p.brand?.accent ?? "#FFD400",
    family: `${font.fontFamily}, "Noto Sans JP", sans-serif`,
    bold: font.bold,
    regular: font.regular,
    textStyle: p.brand?.textStyle ?? "outline",
  };
  const vol = p.music?.volume ?? 0.85;
  return (
    <AbsoluteFill style={{ backgroundColor: "#000" }}>
      <BrandCtx.Provider value={brand}>
        {ready ? (
          <>
            {children}
            {p.hook ? <Hook hook={p.hook} /> : null}
            {p.cta ? <Cta cta={p.cta} from={ctaStart(p, total)} dur={ctaFrames(p)} /> : null}
          </>
        ) : null}
        {p.music ? (
          <Audio src={url(p.music.src)} volume={(af) => vol * interpolate(af, [total - sec(0.6), total], [1, 0], clamp)} />
        ) : null}
        {p._guides ? <Guides /> : null}
      </BrandCtx.Provider>
    </AbsoluteFill>
  );
};
