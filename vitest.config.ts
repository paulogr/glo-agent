import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
  resolve: {
    alias: {
      "@routes": fileURLToPath(
        new URL("./src/routes/index.ts", import.meta.url),
      ),
      "@tools": fileURLToPath(new URL("./src/tools/index.ts", import.meta.url)),
      "@db": fileURLToPath(new URL("./src/db.ts", import.meta.url)),
      "@types": fileURLToPath(new URL("./src/types.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    passWithNoTests: true,
  },
});
