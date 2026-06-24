import { env } from "cloudflare:workers";
import { Agent, type AgentContext } from "agents";
import { WebClient } from "@slack/web-api";
import { createWorkersAI, type WorkersAI } from "workers-ai-provider";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import type { MistralLanguageModelOptions } from "@ai-sdk/mistral";
import { tools } from "@tools";
import {
  slackBlockInteractionEventSchema,
  slackMessageEventSchema,
  type SlackBlockInteractionEvent,
  type SlackEvent,
  type SlackMessageEvent,
} from "./types";

export const SYSTEM_PROMPT = `
You are GLO Operations Agent, an internal operations assistant. Keep answers concise.
For now, discuss tasks and ask clarifying questions; do not claim that external tools have run.
`;

abstract class BaseAgent extends Agent<Env> {
  async onStart() {
    this.sql`
      CREATE TABLE IF NOT EXISTS thread (
        id TEXT PRIMARY KEY,
        channel TEXT NOT NULL,
        thread_ts TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        UNIQUE(channel, thread_ts)
      )
    `;

    this.sql`
      CREATE TABLE IF NOT EXISTS message (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        thread_id TEXT NOT NULL,
        external_id TEXT NOT NULL,
        message_json TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY(thread_id) REFERENCES thread(id) ON DELETE CASCADE,
        UNIQUE(thread_id, external_id)
      )
    `;

    this.sql`
      CREATE INDEX IF NOT EXISTS idx_message_thread_id_id
      ON message(thread_id, id)
    `;
  }
}

export class GloOperationsAgent extends BaseAgent {
  userId?: string;
  slack: WebClient;
  model: WorkersAI;

  constructor(ctx: AgentContext, env: Env) {
    super(ctx, env);
    this.slack = new WebClient(env.SLACK_APP_TOKEN);
    this.model = createWorkersAI({
      binding: env.AI,
      gateway: { id: env.GLO_AI_GATEWAY_ID },
    });
  }

  private async getUserId() {
    if (this.userId) return this.userId;
    const data = await this.slack.auth.test();
    return (this.userId ??= data.user_id);
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
    const userId = await this.getUserId();
    const threadId = `${data.channel}:${rootTs}`;

    let context = this.loadThreadMessages(threadId);

    if (
      !data.text.includes(`<@${userId}>`) &&
      !context.some((m) => m.role === "assistant")
    ) {
      return;
    }

    this.appendThreadMessages(data.channel, rootTs, [
      {
        externalId: `user:${data.ts}`,
        message: {
          role: "user",
          content: data.text.replace(/<@([A-Z0-9]+)/g, "@$1"),
        },
      },
    ]);

    context = this.loadThreadMessages(threadId);

    const result = await this.generateAiReply(context);

    this.appendThreadMessages(
      data.channel,
      rootTs,
      result.response.messages.map((message, index) => ({
        externalId: `${message.role}:${result.response.id}:${index}`,
        message,
      })),
    );

    await this.slack.chat.postMessage({
      text: result.text,
      channel: data.channel,
      thread_ts: rootTs,
    });
  }

  async handleBlockActionsEvent(event: SlackBlockInteractionEvent) {
    const parsed = slackBlockInteractionEventSchema.safeParse(event);
    if (!parsed.success) return;
  }

  generateAiReply(messages: ModelMessage[]) {
    return generateText({
      model: this.model(env.GLO_AI_MODEL),
      system: SYSTEM_PROMPT,
      messages,
      tools,
      stopWhen: stepCountIs(5),
      providerOptions: {
        mistral: {
          reasoningEffort: "none",
        } satisfies MistralLanguageModelOptions,
      },
    });
  }

  loadThreadMessages(threadId: string): ModelMessage[] {
    const rows = this.sql<{ message_json: string }>`
      SELECT message_json
      FROM message
      WHERE thread_id = ${threadId}
      ORDER BY id ASC
    `;

    return rows.map((row) => JSON.parse(row.message_json) as ModelMessage);
  }

  appendThreadMessages(
    channel: string,
    threadTs: string,
    entries: {
      externalId: string;
      message: ModelMessage;
    }[],
  ) {
    if (entries.length === 0) return;
    const createdAt = Date.now();
    this.ctx.storage.transactionSync(() => {
      this.ctx.storage.sql.exec(
        `INSERT INTO thread (id, channel, thread_ts, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          channel = excluded.channel,
          thread_ts = excluded.thread_ts,
          updated_at = excluded.updated_at`,
        `${channel}:${threadTs}`,
        channel,
        threadTs,
        createdAt,
        createdAt,
      );
      for (const entry of entries) {
        this.ctx.storage.sql.exec(
          `INSERT OR IGNORE INTO message
            (thread_id, external_id, message_json, created_at)
          VALUES (?, ?, ?, ?)`,
          `${channel}:${threadTs}`,
          entry.externalId,
          JSON.stringify(entry.message),
          createdAt,
        );
      }
    });
  }
}
