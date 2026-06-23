import { z } from "zod";

export type AppBindings = {
  Bindings: Env;
};

export const slackMessageSchema = z.object({
  type: z.literal("message"),
  channel: z.string().regex(/^(?!D)./),
  text: z.string(),
  bot_id: z.undefined().optional(),
  subtype: z.undefined().optional(),
  thread_ts: z.string().optional(),
  ts: z.string(),
  user: z.string(),
});

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

export type SlackMessage = z.infer<typeof slackMessageSchema>;
export type Store = z.infer<typeof storeSchema>;
export type PlatformApp = z.infer<typeof platformAppSchema>;
export type PlatformAccess = z.infer<typeof platformAccessSchema>;
