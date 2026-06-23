import { tool as defineTool } from "ai";
import { z } from "zod";

const getWeather = defineTool({
  description: "Retorna informações sobre o tempo em uma determinada cidade",
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({
    condition: z.string().describe("Condição geral do tempo"),
    temperature: z.object({
      actual: z.string().describe("Temperatura atual"),
      feels: z.string().describe("Sensação térmica"),
      high: z.string().describe("Temperatura máxima"),
      low: z.string().describe("Temperatura mínima"),
    }),
    wind: z.string(),
  }),
  async execute({ city }) {
    const response = await fetch(
      `https://wttr.in/${city}?format=%C|%t|%f|%H|%L%w`,
    );
    const result = await response.text();
    const [condition, actual, feels, high, low, wind] = result.split("|");
    return { condition, temperature: { actual, feels, high, low }, wind };
  },
});

export const tools = {
  getWeather,
};
