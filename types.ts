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

export type SlackMessage = z.infer<typeof slackMessageSchema>;
