import React from "react";
import { Composition, Folder } from "remotion";
import { FPS, H, W } from "./lib/kit";
import * as BeatCutAd from "./templates/BeatCutAd";
import * as UgcCaptions from "./templates/UgcCaptions";
import * as Listicle from "./templates/Listicle";
import * as BeforeAfter from "./templates/BeforeAfter";
import * as ProductSlideshow from "./templates/ProductSlideshow";
import * as Testimonial from "./templates/Testimonial";
import * as CommentReply from "./templates/CommentReply";
import * as OfferPromo from "./templates/OfferPromo";
import * as ChatStory from "./templates/ChatStory";
import * as NotesList from "./templates/NotesList";
import * as SearchHook from "./templates/SearchHook";
import * as NotificationStack from "./templates/NotificationStack";
import * as PolaroidDump from "./templates/PolaroidDump";
import * as Ranking from "./templates/Ranking";
import * as PollSticker from "./templates/PollSticker";
import exBeatCutAd from "../jobs/examples/BeatCutAd.json";
import exUgcCaptions from "../jobs/examples/UgcCaptions.json";
import exListicle from "../jobs/examples/Listicle.json";
import exBeforeAfter from "../jobs/examples/BeforeAfter.json";
import exProductSlideshow from "../jobs/examples/ProductSlideshow.json";
import exTestimonial from "../jobs/examples/Testimonial.json";
import exCommentReply from "../jobs/examples/CommentReply.json";
import exOfferPromo from "../jobs/examples/OfferPromo.json";
import exChatStory from "../jobs/examples/ChatStory.json";
import exNotesList from "../jobs/examples/NotesList.json";
import exSearchHook from "../jobs/examples/SearchHook.json";
import exNotificationStack from "../jobs/examples/NotificationStack.json";
import exPolaroidDump from "../jobs/examples/PolaroidDump.json";
import exRanking from "../jobs/examples/Ranking.json";
import exPollSticker from "../jobs/examples/PollSticker.json";

// Each template's default props are its example job in jobs/examples/, so the docs and the defaults cannot drift.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Template = { Comp: React.FC<any>; schema: any; duration: (p: any) => number };
const TEMPLATES: Record<string, [Template, { props: unknown }]> = {
  BeatCutAd: [BeatCutAd, exBeatCutAd],
  UgcCaptions: [UgcCaptions, exUgcCaptions],
  Listicle: [Listicle, exListicle],
  BeforeAfter: [BeforeAfter, exBeforeAfter],
  ProductSlideshow: [ProductSlideshow, exProductSlideshow],
  Testimonial: [Testimonial, exTestimonial],
  CommentReply: [CommentReply, exCommentReply],
  OfferPromo: [OfferPromo, exOfferPromo],
  ChatStory: [ChatStory, exChatStory],
  NotesList: [NotesList, exNotesList],
  SearchHook: [SearchHook, exSearchHook],
  NotificationStack: [NotificationStack, exNotificationStack],
  PolaroidDump: [PolaroidDump, exPolaroidDump],
  Ranking: [Ranking, exRanking],
  PollSticker: [PollSticker, exPollSticker],
};

type JobFile = { template?: string; name?: string; props?: Record<string, unknown>; i18n?: Record<string, Record<string, unknown>> };
declare const require: {
  context: (path: string, deep?: boolean, filter?: RegExp) => { keys: () => string[]; <T>(id: string): T };
};

const isObj = (v: unknown): v is Record<string, unknown> => Boolean(v && typeof v === "object" && !Array.isArray(v));
const mergeProps = (base: unknown, over: unknown): unknown => {
  if (over === undefined || over === null) return base;
  if (isObj(base) && isObj(over)) {
    const out: Record<string, unknown> = { ...base };
    for (const k of Object.keys(over)) out[k] = mergeProps(base[k], over[k]);
    return out;
  }
  if (Array.isArray(base) && Array.isArray(over) && over.some(isObj)) {
    return base.map((b, i) => mergeProps(b, over[i])).concat(over.slice(base.length));
  }
  return over;
};

const loadJobs = () => {
  const ctx = require.context("../jobs", true, /\.json$/);
  const seen = new Set<string>();
  const out: { id: string; t: Template; props: Record<string, unknown> }[] = [];
  const push = (id: string, t: Template, props: Record<string, unknown>) => {
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, t, props });
  };
  for (const key of ctx.keys()) {
    if (key.startsWith("./examples/")) continue;
    const job = ctx<JobFile>(key);
    if (!job?.template || !job?.name || !job?.props) continue;
    const entry = TEMPLATES[job.template];
    if (!entry) continue;
    const baseId = TEMPLATES[job.name] ? `job-${job.name}` : job.name;
    push(baseId, entry[0], job.props);
    for (const [lang, over] of Object.entries(job.i18n ?? {})) {
      const merged = mergeProps(job.props, over);
      if (isObj(merged)) push(`${baseId}-${lang}`, entry[0], merged);
    }
  }
  return out;
};

const JOBS = loadJobs();

export const Root: React.FC = () => (
  <>
    {Object.entries(TEMPLATES).map(([id, [t, example]]) => (
      <Composition
        key={id}
        id={id}
        component={t.Comp}
        schema={t.schema}
        width={W}
        height={H}
        fps={FPS}
        durationInFrames={300}
        defaultProps={example.props as Record<string, unknown>}
        calculateMetadata={({ props }) => {
          // A render passes `_keys`; keep only those, so a job that leaves `hook` out does not inherit the example's hook.
          const keys = (props as { _keys?: string[] })._keys;
          const own = keys ? (Object.fromEntries(Object.entries(props).filter(([k]) => keys.includes(k))) as typeof props) : props;
          return { durationInFrames: t.duration(own), props: own };
        }}
      />
    ))}
    {JOBS.length > 0 ? (
      <Folder name="Jobs">
        {JOBS.map(({ id, t, props }) => (
          <Composition
            key={id}
            id={id}
            component={t.Comp}
            schema={t.schema}
            width={W}
            height={H}
            fps={FPS}
            durationInFrames={300}
            defaultProps={props}
            calculateMetadata={({ props: p }) => ({ durationInFrames: t.duration(p), props: p })}
          />
        ))}
      </Folder>
    ) : null}
  </>
);
