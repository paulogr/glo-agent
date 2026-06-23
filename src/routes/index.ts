import { Hono } from "hono";
import type { AppBindings } from "@types";
import { slack } from "./slack.ts";
import { bling } from "./bling.ts";

const api = new Hono<AppBindings>().basePath("api");

api.route("slack", slack);
api.route("bling", bling);

export { api };
