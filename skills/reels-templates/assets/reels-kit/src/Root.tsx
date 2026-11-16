import React from "react";
import { Composition } from "remotion";
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
  </>
);
