import type { ModelMessage } from "ai";
import { AiEnabledAgent } from "./ai";
import { slackMessageSchema, type SlackMessage } from "./types";

const SLACK_TOKEN_STORAGE_KEY = "access_token";
const SYSTEM_PROMPT = `
You are GLO Operations Agent, an internal operations assistant. Keep answers concise.
For now, discuss tasks and ask clarifying questions; do not claim that external tools have run.
`;

export class GloOperationsSlackAgent extends AiEnabledAgent {
  userId?: string;

  get token() {
    return this.ctx.storage.kv.get<string>(SLACK_TOKEN_STORAGE_KEY);
  }

  init(token: string) {
    this.ctx.storage.kv.put(SLACK_TOKEN_STORAGE_KEY, token);
    this.userId = undefined;
  }

  private async getUserId() {
    if (this.userId) return this.userId;
    const response = await fetch("https://slack.com/api/auth.test", {
      headers: { Authorization: `Bearer ${this.token}` },
    });
    const data = await response.json<{ user_id?: string }>();
    return (this.userId ??= data.user_id);
  }

  private async fetchThread(channel: string, ts: string) {
    const params = new URLSearchParams({
      channel,
      ts,
      limit: "1000",
      inclusive: "true",
    });
    const response = await fetch(
      `https://slack.com/api/conversations.replies?${params.toString()}`,
      {
        headers: { Authorization: `Bearer ${this.token}` },
      },
    );
    const data = await response.json<{ messages: SlackMessage[] }>();
    return data.messages.sort((a, b) => Number(a.ts) - Number(b.ts));
  }

  private sendMessage(
    text: string,
    opts: { channel: string; thread_ts?: string },
  ) {
    return fetch("https://slack.com/api/chat.postMessage", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json; charset=utf-8",
      },
      body: JSON.stringify({ text, ...opts }),
    });
  }

  async onSlackEvent(event: SlackMessage) {
    const result = slackMessageSchema.safeParse(event);
    if (!result.success) return;
    const data = result.data;
    const rootTs = data.thread_ts ?? data.ts;
    const messages = await this.fetchThread(data.channel, rootTs);
    const userId = await this.getUserId();
    if (
      !data.text.includes(`<@${userId}`) &&
      !messages.some((m) => m.user === userId)
    ) {
      return;
    }
    const context: ModelMessage[] = messages.map((m) => {
      const role = m.user === userId ? "assistant" : "user";
      const content = m.text.replace(/<@([A-Z0-9]+)/g, "@$1");
      return { role, content };
    });
    const content = await this.generateAiReply(context, SYSTEM_PROMPT);
    this.sendMessage(content, { channel: data.channel, thread_ts: rootTs });
  }
}
