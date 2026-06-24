import { Agent } from "agents";
import { createWorkersAI, type WorkersAI } from "workers-ai-provider";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { tools } from "@tools";
import type { MistralLanguageModelOptions } from "@ai-sdk/mistral";

export type ThreadRef = {
  id: string;
  channel: string;
  threadTs: string;
};

export type ThreadMessageEntry = {
  externalId: string;
  message: ModelMessage;
};

export class AiEnabledAgent extends Agent<Env> {
  #ai?: WorkersAI;

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

  public getThreadRef(channel: string, threadTs: string): ThreadRef {
    return {
      id: `${channel}:${threadTs}`,
      channel,
      threadTs,
    };
  }

  parseBlockInteractionThreadId(id: string): ThreadRef | undefined {
    const index = id.indexOf(":");

    if (index === -1) {
      console.error(
        "[slack agent] unable to parse block interaction thread id ",
      );
      return;
    }

    return {
      id,
      channel: id.slice(0, index),
      threadTs: id.slice(index + 1),
    };
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

  appendThreadMessages(thread: ThreadRef, entries: ThreadMessageEntry[]) {
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
        thread.id,
        thread.channel,
        thread.threadTs,
        createdAt,
        createdAt,
      );
      for (const entry of entries) {
        this.ctx.storage.sql.exec(
          `INSERT OR IGNORE INTO message
            (thread_id, external_id, message_json, created_at)
          VALUES (?, ?, ?, ?)`,
          thread.id,
          entry.externalId,
          JSON.stringify(entry.message),
          createdAt,
        );
      }
    });
  }

  get model() {
    return (this.#ai ??= createWorkersAI({
      binding: this.env.AI,
      gateway: { id: this.env.GLO_AI_GATEWAY_ID },
    }));
  }

  generateAiReply(messages: ModelMessage[], systemPrompt: string) {
    return generateText({
      model: this.model(this.env.GLO_AI_MODEL),
      system: systemPrompt,
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
}
