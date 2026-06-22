import { routeAgentRequest } from "agents";
import { api } from "./api";

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const response = await routeAgentRequest(request, env);
    if (response) return response;
    return api.fetch(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;

export { GloOperationsAgent } from "./agents";
