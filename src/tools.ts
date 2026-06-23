import { tool as defineTool } from "ai";
import { z } from "zod";
import { CLIENT_STORES } from "./stores";

const prepareBlingSalesOrder = defineTool({
  description:
    "Prepare manual bling sales orders extracted from a Slack conversation",
  inputSchema: z
    .object({
      store: z.enum(Object.keys(CLIENT_STORES)),
      customer: z.object({
        name: z.string(),
        document: z.string(),
        email: z.string(),
        cep: z.string(),
        address: z.string(),
      }),
      items: z.array(
        z.object({
          name: z.string(),
          quantity: z.number(),
          price: z.number(),
          attributes: z.record(z.string(), z.string()),
        }),
      ),
    })
    .superRefine((data) => {}),
  execute(data) {
    console.log(data);
  },
});

export const tools = {
  prepareBlingSalesOrder,
};
