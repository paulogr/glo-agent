import { z } from "zod";

const LUFT_SHOES_SCHEMA = {
  product: z.object({
    attributes: z.enum(["size"]),
  }),
};

const SARPI_SCHEMA = {
  product: z.object({
    attributes: z.enum(["color", "size"]),
  }),
};

export const CLIENT_STORES: Record<string, unknown> = {
  "Luft Shoes": LUFT_SHOES_SCHEMA,
  Sarpi: SARPI_SCHEMA,
};
