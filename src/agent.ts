import { WebClient } from "@slack/web-api";
import { AiEnabledAgent } from "./ai";
import {
  slackBlockInteractionEventSchema,
  slackMessageEventSchema,
  type SlackBlockInteractionEvent,
  type SlackEvent,
  type SlackMessageEvent,
} from "./types";

const SLACK_TOKEN_STORAGE_KEY = "access_token";

export const SYSTEM_PROMPT = `
You are GLO Operations Agent, an internal operations assistant. Keep answers concise.
For now, discuss tasks and ask clarifying questions; do not claim that external tools have run.
`;

export class GloOperationsSlackAgent extends AiEnabledAgent {
  userId?: string;
  #_slack?: WebClient;

  get slack() {
    const token = this.ctx.storage.kv.get<string>(SLACK_TOKEN_STORAGE_KEY);
    return (this.#_slack ??= new WebClient(token));
  }

  init(token: string) {
    this.ctx.storage.kv.put(SLACK_TOKEN_STORAGE_KEY, token);
    this.userId = undefined;
  }

  private async getUserId() {
    if (this.userId) return this.userId;
    const data = await this.slack.auth.test();
    return (this.userId ??= data.user_id);
  }

  private sendMessage(
    text: string,
    opts: { channel: string; thread_ts?: string },
  ) {
    return this.slack.chat.postMessage({ text, ...opts });
  }

  async onSlackEvent(event: SlackEvent) {
    if (event.type === "message") {
      return this.handleMessageEvent(event);
    } else if (event.type === "block_actions") {
      return this.handleBlockActionsEvent(event);
    }
  }

  async handleMessageEvent(event: SlackMessageEvent) {
    const parsed = slackMessageEventSchema.safeParse(event);
    if (!parsed.success) return;
    const data = parsed.data;
    const rootTs = data.thread_ts ?? data.ts;
    const thread = this.getThreadRef(data.channel, rootTs);
    const userId = await this.getUserId();

    let context = this.loadThreadMessages(thread.id);

    if (
      !data.text.includes(`<@${userId}>`) &&
      !context.some((m) => m.role === "assistant")
    ) {
      return;
    }

    this.appendThreadMessages(thread, [
      {
        externalId: `user:${data.ts}`,
        message: {
          role: "user",
          content: data.text.replace(/<@([A-Z0-9]+)/g, "@$1"),
        },
      },
    ]);

    context = this.loadThreadMessages(thread.id);

    const result = await this.generateAiReply(context, SYSTEM_PROMPT);

    this.appendThreadMessages(
      thread,
      result.response.messages.map((message, index) => ({
        externalId: `${message.role}:${result.response.id}:${index}`,
        message,
      })),
    );

    await this.sendMessage(result.text, {
      channel: data.channel,
      thread_ts: rootTs,
    });
  }

  async handleBlockActionsEvent(event: SlackBlockInteractionEvent) {
    const parsed = slackBlockInteractionEventSchema.safeParse(event);
    if (!parsed.success) return;
  }
}
