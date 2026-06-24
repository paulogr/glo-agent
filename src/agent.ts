import { WebClient } from "@slack/web-api";
import type { ModelMessage } from "ai";
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

  private async fetchThread(channel: string, ts: string) {
    const data = await this.slack.conversations.replies({
      channel,
      ts,
      limit: 1000,
      inclusive: true,
    });

    return data.messages!.sort((a, b) => Number(a.ts) - Number(b.ts));
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
    const messages = await this.fetchThread(data.channel, rootTs);
    const userId = await this.getUserId();
    if (
      !data.text.includes(`<@${userId}>`) &&
      !messages.some((m) => m.user === userId)
    ) {
      return;
    }
    const context: ModelMessage[] = messages.map((m) => {
      const role = m.user === userId ? "assistant" : "user";
      const content = m.text!.replace(/<@([A-Z0-9]+)/g, "@$1");
      return { role, content };
    });
    const result = await this.generateAiReply(context, SYSTEM_PROMPT);
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
