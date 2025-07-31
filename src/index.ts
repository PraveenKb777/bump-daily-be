import { Hono } from "hono";
import type { Bindings, Variables } from "./types";
import { corsMiddleware } from "./middleware";
import { setupRoutes } from "./routes";

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>();

app.use("*", corsMiddleware);

setupRoutes(app);

export default {
  fetch: app.fetch,
};
