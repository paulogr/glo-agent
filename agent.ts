import { Agent } from "agents";
import { slackMessageSchema, type SlackMessage } from "./types";

const SLACK_TOKEN_STORAGE_KEY = "access_token";

export class GloOperationsAgent extends Agent<Env> {
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
    this.userId = data.user_id;
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

  private async threadHasBotReply(messages: SlackMessage[]) {
    const userId = await this.getUserId();
    return messages.some((m) => m.user === userId);
  }

  async onSlackEvent(event: SlackMessage) {
    const result = slackMessageSchema.safeParse(event);
    if (!result.success) {
      return;
    }
    const data = result.data;
    const messages = await this.fetchThread(
      data.channel,
      data.thread_ts ?? data.ts,
    );
    if (
      !data.text.includes(`<@${await this.getUserId()}`) &&
      !(await this.threadHasBotReply(messages))
    ) {
      return;
    }
    console.log(JSON.stringify(messages));
  }
}
