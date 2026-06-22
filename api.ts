import { Hono, type HonoRequest } from "hono";
import { getAgentByName } from "agents";
import type { AppBindings, SlackMessage } from "./types.ts";

const SLACK_SCOPES = ["chat:write", "channels:history"];

function getSlackRedirectUri(request: HonoRequest): string {
  const url = new URL(request.url);
  return `https://${url.host}/api/slack/accept`;
}

export const api = new Hono<AppBindings>().basePath("api");

api.get("/slack/install", (c) => {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", c.env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_url", getSlackRedirectUri(c.req));
  return c.redirect(url.toString(), 302);
});

api.get("/slack/accept", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    console.error("[slack accept]: missing code");
    return c.text("missing code");
  }

  const form = new FormData();
  form.append("code", code);
  form.append("client_id", c.env.SLACK_CLIENT_ID);
  form.append("client_secret", c.env.SLACK_CLIENT_SECRET);
  form.append("redirect_uri", getSlackRedirectUri(c.req));

  const response = await fetch("https://slack.com/api/oauth.v2.access", {
    method: "POST",
    body: form,
  });

  const data = await response.json<
    | {
        ok: true;
        team: { id: string };
        access_token: string;
      }
    | {
        ok: false;
        error: string;
      }
  >();

  if (!data.ok) {
    console.error(`[slack accept] ${data.error}`);
    return c.text("failed to get token");
  }

  const agent = await getAgentByName(c.env.GloOperationsAgent, data.team.id);
  await agent.init(data.access_token);

  return c.text("registered");
});

api.post("/slack", async (c) => {
  const raw = await c.req.text();
  const body = JSON.parse(raw) as {
    type: string;
    team_id: string;
    event: SlackMessage;
    challenge?: string;
  };
  if (body.type === "url_verification") {
    console.error("[slack event] url verification");
    return c.json({ challenge: body.challenge });
  }
  const agent = await getAgentByName(c.env.GloOperationsAgent, body.team_id);
  c.executionCtx.waitUntil(agent.onSlackEvent(body.event));
  return c.text("event received", 200);
});
