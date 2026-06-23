import { Hono } from "hono";
import type { AppBindings } from "@types";
import { repo } from "@db";

const bling = new Hono<AppBindings>();

bling.get(":storeId/install", async (c) => {
  const code = c.req.query("code");

  if (!code) {
    console.error("[bling install]: missing code");
    return c.text("missing code");
  }

  const storeId = c.req.param("storeId");
  const app = await repo.app.findByStoreAndPlatform(storeId, "bling");

  if (!app) {
    console.error("[bling install] unknown store:", storeId);
    return c.text("unknown store");
  }

  const params = new URLSearchParams();
  params.set("code", code);
  params.set("grant_type", "authorization_code");

  const response = await fetch("https://api.bling.com.br/Api/v3/oauth/token", {
    method: "POST",
    headers: {
      Authorization:
        "Basic " +
        Buffer.from(app.clientId + ":" + app.clientSecret).toString("base64"),
    },
    body: params,
  });

  const data = await response.json<
    | {
        error: {
          message: string;
        };
      }
    | {
        error: undefined;
        access_token: string;
        refresh_token: string;
      }
  >();

  if (data.error) {
    console.error("[bling install]:", data.error.message);
    return c.text("unable to get access token");
  }

  await repo.access.savePlatformAccess(
    storeId,
    app.id,
    data.access_token,
    data.access_token,
  );

  return c.text("ok");
});

export { bling };
