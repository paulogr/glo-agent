import { WebClient } from "@slack/web-api";
import { Hono, type HonoRequest } from "hono";
import { getAgentByName } from "agents";
import type { AppBindings, SlackMessage } from "@types";

const SLACK_SCOPES = ["chat:write", "channels:history"];

function getSlackRedirectUri(request: HonoRequest): string {
  const url = new URL(request.url);
  return `https://${url.host}/api/slack/accept`;
}

const slack = new Hono<AppBindings>();

slack.get("install", (c) => {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", c.env.SLACK_CLIENT_ID);
  url.searchParams.set("scope", SLACK_SCOPES.join(","));
  url.searchParams.set("redirect_uri", getSlackRedirectUri(c.req));
  return c.redirect(url.toString(), 302);
});

slack.get("accept", async (c) => {
  const url = new URL(c.req.url);
  const code = url.searchParams.get("code");

  if (!code) {
    return c.text("missing code");
  }

  const client = new WebClient();
  const data = await client.oauth.v2.access({
    code,
    client_id: c.env.SLACK_CLIENT_ID,
    client_secret: c.env.SLACK_CLIENT_SECRET,
    redirect_uri: getSlackRedirectUri(c.req),
  });

  if (!data.ok || !data.team?.id || !data.access_token) {
    console.error(`[slack accept] ${data.error ?? "missing oauth data"}`);
    return c.text("failed to get token");
  }

  const agent = await getAgentByName(
    c.env.GloOperationsSlackAgent,
    data.team.id,
  );

  agent.init(data.access_token);

  return c.text("ok");
});

slack.post("/", async (c) => {
  const raw = await c.req.text();
  const body = JSON.parse(raw) as {
    type: string;
    team_id: string;
    event: SlackMessage;
    challenge?: string;
  };
  if (body.type === "url_verification") {
    return c.json({ challenge: body.challenge });
  }
  const agent = await getAgentByName(
    c.env.GloOperationsSlackAgent,
    body.team_id,
  );
  c.executionCtx.waitUntil(agent.onSlackEvent(body.event));
  return c.text("ok");
});

export { slack };
