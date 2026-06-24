import { env } from "cloudflare:workers";
import { describe, it, expect } from "vitest";
import { runInDurableObject } from "cloudflare:test";
import type { ModelMessage } from "ai";
import { SYSTEM_PROMPT } from "@agent";

describe("tool calling", () => {
  it("calls prepareBlingSalesOrder tool for a sales order creation prompt", async () => {
    const EXPECTED_BLING_TOOL_NAME = "prepareBlingSalesOrder";
    const agent = env.GloOperationsSlackAgent.getByName("tool-calling-e2e");
    const result = await runInDurableObject(agent, (instance) =>
      instance.generateAiReply(
        [{ role: "user", content: "Gostaria de criar um pedido no Bling" }],
        SYSTEM_PROMPT,
        {
          toolChoice: {
            type: "tool",
            toolName: EXPECTED_BLING_TOOL_NAME,
          },
        },
      ),
    );
    expect(
      result.toolCalls.some((t) => t.toolName === EXPECTED_BLING_TOOL_NAME),
    );
  }, 60_000);

  it("request approval before executing prepareBlingSalesOrder and then approves", async () => {
    const EXPECTED_BLING_TOOL_NAME = "prepareBlingSalesOrder";
    const agent = env.GloOperationsSlackAgent.getByName("tool-approval-e2e");
    const messages: ModelMessage[] = [
      {
        role: "user",
        content: `
          Crie um pedido no Bling para a loja GLO.
          Cliente: Maria Silva, CPF 12345678909, email maria@example.com, CEP 01001000, endereço Praça da Sé 100.
          Item: Camiseta GLO, quantidade 2, preço 59.90, atributos cor=preta tamanho=M.
        `,
      },
    ];
    const first = await runInDurableObject(agent, (instance) =>
      instance.generateAiReply(messages, SYSTEM_PROMPT, {
        toolChoice: {
          type: "tool",
          toolName: EXPECTED_BLING_TOOL_NAME,
        },
      }),
    );
    const approval = first.content.find(
      (p) =>
        p.type === "tool-approval-request" &&
        p.toolCall.toolName === EXPECTED_BLING_TOOL_NAME,
    );
    expect(approval).toBeDefined();
    expect(approval!.type === "tool-approval-request");
    expect(first.toolResults).toHaveLength(0);
    messages.push(...first.response.messages);
    messages.push({
      role: "tool",
      content: [
        {
          type: "tool-approval-response",
          approvalId: (approval as { approvalId: string }).approvalId,
          approved: true,
          reason: "approved by e2e test",
        },
      ],
    });
    const second = await runInDurableObject(agent, (instance) =>
      instance.generateAiReply(messages, SYSTEM_PROMPT),
    );
    expect(
      second.response.messages.some(
        (m) =>
          m.role === "tool" &&
          m.content.some(
            (p) =>
              p.type === "tool-result" &&
              p.toolName === EXPECTED_BLING_TOOL_NAME,
          ),
      ),
    );
  }, 60_000);
});
