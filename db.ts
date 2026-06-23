import { env } from "cloudflare:workers";
import type { PlatformAccess, PlatformApp, Store } from "@types";

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
  getPlatformAccess(storeId: string, platformId: string) {
    const prepare = env.DB.prepare(
      `SELECT pacc.access_token as accessToken, pacc.refresh_token as refreshToken
      FROM platform_access pacc
      JOIN platform_app papp
      ON papp.id = pacc.platform_app_id
      AND papp.store_id = pacc.store_id
      WHERE pacc.store_id = ?
      AND papp.platform_id = ?`,
    ).bind(storeId, platformId);
    return prepare.first<PlatformAccess>();
  },
  savePlatformAccess(
    storeId: string,
    appId: number,
    accessToken: string,
    refreshToken: string,
  ) {
    const prepare = env.DB.prepare(
      `INSERT INTO platform_access (store_id, platform_app_id, access_token, refresh_token)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(store_id, platform_app_id)
      DO UPDATE SET
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token`,
    ).bind(storeId, appId, accessToken, refreshToken);
    return prepare.run();
  },
};

export const repo = {
  store,
  app,
  access,
};
