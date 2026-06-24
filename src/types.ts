import { z } from "zod";

export type AppBindings = {
  Bindings: Env;
};

export const slackMessageEventSchema = z.object({
  type: z.literal("message"),
  channel: z.string().regex(/^(?!D)./),
  text: z.string(),
  bot_id: z.undefined().optional(),
  subtype: z.undefined().optional(),
  thread_ts: z.string().optional(),
  ts: z.string(),
  user: z.string(),
});

export const slackBlockInteractionEventSchema = z
  .object({
    type: z.literal("block_actions"),
    team: z.object({
      id: z.string(),
    }),
    user: z.object({
      id: z.string(),
    }),
    channel: z.object({
      id: z.string(),
    }),
    message: z.object({
      ts: z.string(),
      thread_ts: z.string().optional(),
    }),
    actions: z
      .array(
        z.object({
          action_id: z.string(),
          value: z.string(),
        }),
      )
      .min(1),
  })
  .loose();

export const slackEventSchema = z.union([
  slackMessageEventSchema,
  slackBlockInteractionEventSchema,
]);

export const storeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const platformAppSchema = z.object({
  id: z.number(),
  storeId: z.string(),
  platformId: z.string(),
  clientId: z.string(),
  clientSecret: z.string(),
});

export const platformAccessSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export type SlackEvent = z.infer<typeof slackEventSchema>;
export type SlackMessageEvent = z.infer<typeof slackMessageEventSchema>;
export type SlackBlockInteractionEvent = z.infer<
  typeof slackBlockInteractionEventSchema
>;
export type Store = z.infer<typeof storeSchema>;
export type PlatformApp = z.infer<typeof platformAppSchema>;
export type PlatformAccess = z.infer<typeof platformAccessSchema>;
