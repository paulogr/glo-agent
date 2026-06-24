import { Agent } from "agents";
import { createWorkersAI, type WorkersAI } from "workers-ai-provider";
import { generateText, stepCountIs, type ModelMessage } from "ai";
import { tools } from "@tools";

export class AiEnabledAgent extends Agent<Env> {
  #ai?: WorkersAI;

  get model() {
    return (this.#ai ??= createWorkersAI({
      binding: this.env.AI,
      gateway: { id: this.env.GLO_AI_GATEWAY_ID },
    }));
  }

  public async generateAiReply(messages: ModelMessage[], systemPrompt: string) {
    return generateText({
      model: this.model(this.env.GLO_AI_MODEL),
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(5),
    });
  }
}
