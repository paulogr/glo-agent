import { tool as defineTool } from "ai";
import { z } from "zod";
import { CLIENT_STORES } from "../stores";

const createBlingSalesOrder = defineTool({
  description: "Whem the user asks for creating a manual Bling sales orders",
  inputSchema: z.object({
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
  }),
  needsApproval: true,
  execute(data) {
    console.log(data);
  },
});

export const bling = {
  createBlingSalesOrder,
};
