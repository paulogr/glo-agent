import { env } from "cloudflare:workers";
import type { PlatformApp, Store } from "@types";

const store = {
  findById(id: string) {
    const prepare = env.DB.prepare(
      `SELECT id, name FROM store WHERE id = ?`,
    ).bind(id);
    return prepare.first<Store>();
  },
};

const app = {
  async findByStoreAndPlatform(storeId: string, platformId: string) {
    const prepare = env.DB.prepare(
      `SELECT id, client_id as clientId, client_secret as clientSecret
      FROM platform_app
      WHERE store_id = ? and platform_id = ?`,
    ).bind(storeId, platformId);
    return prepare.first<PlatformApp>();
  },
};

const access = {
  savePlatformAccess(
    storeId: string,
    appId: string,
    accessToken: string,
    refreshToken: string,
  ) {
    const prepare = env.DB.prepare(
      `
      INSERT INTO platform_access (store_id, platform_app_id, access_token, refresh_token)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(store_id, platform_app_id)
      DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token
    `,
    ).bind(storeId, appId, accessToken, refreshToken);
    return prepare.run();
  },
};

export const repo = {
  store,
  app,
  access,
};
