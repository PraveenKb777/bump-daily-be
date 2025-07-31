import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { auth } from "./auth";
import { profile } from "./profile";
import { admin } from "./admin";
import { communitiesRoute } from "./communities";
import { post } from "./posts";
import feed from "./feed";
import { files } from "./files";

export function setupRoutes(
  app: Hono<{ Bindings: Bindings; Variables: Variables }>
) {
  // Health check
  app.get("/", (c) => {
    return c.json({ message: "User data API is running" });
  });

  // Mount route groups
  app.route("/api/communities", communitiesRoute);
  app.route("/api/posts", post);
  app.route("/api/feed", feed);
  app.route("/files", files);
  app.route("/api/comments", communitiesRoute);
  app.route("/api", auth);
  app.route("/api/profile", profile);
  app.route("/api/admin", admin);
}

export { auth, profile, admin };
