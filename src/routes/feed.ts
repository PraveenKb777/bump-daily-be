import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { and, desc, eq, sql } from "drizzle-orm";
import { communities, posts } from "../db";

const feed = new Hono<{ Bindings: Bindings; Variables: Variables }>();

feed.get("/stats", async (c) => {
  const db = drizzle(c.env.DB);
  const communityName = c.req.query("community");
  const timeFrame = c.req.query("timeFrame") || "24h";

  try {
    const now = Math.floor(Date.now() / 1000);
    let timeFilter = now - 24 * 60 * 60; // Default 24h

    switch (timeFrame) {
      case "1h":
        timeFilter = now - 1 * 60 * 60;
        break;
      case "6h":
        timeFilter = now - 6 * 60 * 60;
        break;
      case "24h":
        timeFilter = now - 24 * 60 * 60;
        break;
      case "7d":
        timeFilter = now - 7 * 24 * 60 * 60;
        break;
    }

    const isoTimeFilter = new Date(timeFilter * 1000).toISOString();

    if (communityName) {
      const communityFound = await db
        .select()
        .from(communities)
        .where(eq(communities.name, communityName))
        .limit(1);

      if (!communityFound.length) {
        return c.json({ error: "Community not found" }, 404);
      }
    }

    const stats = await db
      .select({
        total_posts: sql<number>`COUNT(*)`,
        avg_score: sql<number>`AVG(${posts.score})`,
        max_score: sql<number>`MAX(${posts.score})`,
        total_comments: sql<number>`SUM(${posts.comment_count})`,
        avg_comments: sql<number>`AVG(${posts.comment_count})`,
        posts_with_positive_score: sql<number>`COUNT(CASE WHEN ${posts.score} > 0 THEN 1 END)`,
        posts_with_comments: sql<number>`COUNT(CASE WHEN ${posts.comment_count} > 0 THEN 1 END)`,
        post_types: sql<string>`GROUP_CONCAT(DISTINCT ${posts.type})`,
      })
      .from(posts)
      .leftJoin(communities, eq(posts.community_id, communities.id))
      .where(
        and(
          eq(posts.is_deleted, false),
          sql`${posts.created_at} >= ${isoTimeFilter}`,
          communityName ? eq(communities.name, communityName) : undefined
        )
      );

    return c.json({
      time_frame: timeFrame,
      community: communityName || "all",
      statistics: stats[0],
      generated_at: now,
    });
  } catch (error) {
    return c.json({ error: "Failed to fetch feed statistics" }, 500);
  }
});

feed.get("/trending", async (c) => {
  const db = drizzle(c.env.DB);
  const timeFrame = c.req.query("timeFrame") || "24h";
  const limit = Math.min(parseInt(c.req.query("limit") || "10"), 20);

  try {
    const now = Math.floor(Date.now() / 1000);
    let timeFilter = now - 24 * 60 * 60;

    switch (timeFrame) {
      case "1h":
        timeFilter = now - 1 * 60 * 60;
        break;
      case "6h":
        timeFilter = now - 6 * 60 * 60;
        break;
      case "24h":
        timeFilter = now - 24 * 60 * 60;
        break;
    }

    const isoTimeFilter = new Date(timeFilter * 1000).toISOString();

    const trendingCommunities = await db
      .select({
        community_name: communities.name,
        community_display_name: communities.display_name,
        recent_posts: sql<number>`COUNT(${posts.id})`,
        total_score: sql<number>`SUM(${posts.score})`,
        total_comments: sql<number>`SUM(${posts.comment_count})`,
        avg_score: sql<number>`AVG(${posts.score})`,
        trending_score: sql<number>`
  (COUNT(${posts.id}) * 2 + SUM(${posts.score}) + SUM(${posts.comment_count}) * 0.5) / 
  POW((${now} - MIN(${posts.created_at})) / 3600.0 + 1, 0.5)
`.as("trending_score"),
      })
      .from(posts)
      .leftJoin(communities, eq(posts.community_id, communities.id))
      .where(
        and(
          eq(posts.is_deleted, false),
          sql`${posts.created_at} >= ${isoTimeFilter}`
        )
      )
      .groupBy(communities.id, communities.name, communities.display_name)
      .having(sql`COUNT(${posts.id}) >= 2`)
      .orderBy(desc(sql`trending_score`))
      .limit(limit);

    return c.json({
      time_frame: timeFrame,
      trending_communities: trendingCommunities,
      generated_at: now,
    });
  } catch (error) {
    console.log(error);
    return c.json({ error: "Failed to fetch trending data" }, 500);
  }
});

export default feed;
