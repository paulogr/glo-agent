import { env } from "cloudflare:workers";
import { runInDurableObject } from "cloudflare:test";
import { describe, it, expect } from "vitest";
import { SYSTEM_PROMPT } from "../src/agent.ts";

describe("tool calling", () => {
  it("calls prepareBlingSalesOrder tool for a sales order creation prompt", async () => {
    const EXPECTED_BLING_TOOL_NAME = "prepareBlingSalesOrder";
    const agent = env.GloOperationsSlackAgent.getByName("tool-calling-e2e");
    const result = await runInDurableObject(agent, (instance) =>
      instance.generateAiReply(
        [{ role: "user", content: "Gostaria de criar um pedido no Bling" }],
        SYSTEM_PROMPT,
      ),
    );
    expect(
      result.toolCalls.some((t) => t.toolName === EXPECTED_BLING_TOOL_NAME),
    );
  }, 60_000);
});
