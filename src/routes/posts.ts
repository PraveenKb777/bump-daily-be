import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import {
  comments,
  communities,
  posts,
  postVotes,
  profiles,
  users,
} from "../db";
import { and, desc, eq, SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { authMiddleware } from "../middleware";
import {
  calculateControversyScore,
  calculateHotScore,
  calculateTrendingScore,
  generateId,
  now,
} from "../utils";

const post = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

// Get posts (feed) based on community
post.get("/", async (c) => {
  const db = drizzle(c.env.DB);
  const communityName = c.req.query("community");
  const sort = c.req.query("sort") || "hot"; // hot, new, top, top24h, trending, controversial
  const timeFrame = c.req.query("timeFrame") || "24h"; // 1h, 6h, 24h, 7d, 30d, all
  const limit = Math.min(parseInt(c.req.query("limit") || "25"), 100); // Max 100 posts
  const offset = parseInt(c.req.query("offset") || "0");
  const includeNSFW = c.req.query("nsfw") === "true";

  try {
    const datenow = new Date(now()).getTime();
    let timeFilter = 0;

    // Calculate time filter based on timeFrame
    switch (timeFrame) {
      case "1h":
        timeFilter = datenow - 1 * 60 * 60;
        break;
      case "6h":
        timeFilter = datenow - 6 * 60 * 60;
        break;
      case "24h":
        timeFilter = datenow - 24 * 60 * 60;
        break;
      case "7d":
        timeFilter = datenow - 7 * 24 * 60 * 60;
        break;
      case "30d":
        timeFilter = datenow - 30 * 24 * 60 * 60;
        break;
      case "all":
        timeFilter = 0;
        break;
      default:
        timeFilter = datenow - 24 * 60 * 60;
        break;
    }

    // Base query with all necessary fields
    // Build dynamic filter conditions
    const conditions = [eq(posts.is_deleted, false)];

    if (
      (sort === "top" || sort === "top24h" || sort === "trending") &&
      timeFrame !== "all"
    ) {
      conditions.push(sql`${posts.created_at} >= ${timeFilter}`);
    }

    if (communityName) {
      conditions.push(eq(communities.name, communityName));
    }

    if (sort === "hot") {
      conditions.push(sql`${posts.upvotes} + ${posts.downvotes} >= 1`);
    }

    if (sort === "rising") {
      conditions.push(sql`${posts.created_at} >= ${datenow - 6 * 60 * 60}`);
    }

    if (sort === "controversial") {
      conditions.push(sql`${posts.upvotes} > 5 AND ${posts.downvotes} > 5`);
    }

    // Define order by expressions based on sort type
    const orderByMap: Record<string, any[]> = {
      new: [desc(posts.created_at)],
      top: [desc(posts.score), desc(posts.created_at)],
      top24h: [desc(posts.score), desc(posts.created_at)],
      hot: [
        desc(sql`
      CASE 
        WHEN (${posts.upvotes} + ${posts.downvotes}) = 0 THEN 0
        ELSE 
          (LOG(MAX(ABS(${posts.score}), 1)) / LOG(10) * 
          CASE WHEN ${posts.score} > 0 THEN 1 WHEN ${posts.score} < 0 THEN -1 ELSE 0 END) + 
          (${posts.created_at} / 45000.0)
      END
    `),
        desc(posts.created_at),
      ],
      trending: [
        desc(sql`
  (${posts.score} + (LOG(${posts.comment_count} + 1) / LOG(10)) * 2) * 
  POW((${datenow} - ${posts.created_at}) / 3600.0 + 2, -1.5)
`),
        desc(posts.created_at),
      ],
      controversial: [
        desc(sql`
      POW(${posts.upvotes} + ${posts.downvotes}, 0.5) * 
      CASE 
        WHEN ${posts.upvotes} > ${posts.downvotes} 
        THEN CAST(${posts.downvotes} AS FLOAT) / ${posts.upvotes}
        ELSE CAST(${posts.upvotes} AS FLOAT) / ${posts.downvotes}
      END
    `),
        desc(posts.created_at),
      ],
      rising: [
        desc(sql`
      (${posts.score} + ${posts.comment_count} * 0.5) / 
      POW((${datenow} - ${posts.created_at}) / 3600.0 + 1, 0.8)
    `),
        desc(posts.created_at),
      ],
    };

    // Fallback to 'hot' if sort is unrecognized
    const finalOrderBy = orderByMap[sort] || orderByMap["hot"];

    // Build query directly
    const query = db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        type: posts.type,
        url: posts.url,
        score: posts.score,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        comment_count: posts.comment_count,
        created_at: posts.created_at,
        updated_at: posts.updated_at,
        author_username: profiles.username,
        author_display_name: profiles.firstName,
        community_name: communities.name,
        community_display_name: communities.display_name,
        age_hours: sql<number>`(${datenow} - ${posts.created_at}) / 3600.0`,
        engagement_rate: sql<number>`CAST(${posts.comment_count} AS FLOAT) / (JULIANDAY('datenow') - JULIANDAY(${posts.created_at}, 'unixepoch') + 1)`,
        vote_ratio: sql<number>`CASE 
      WHEN (${posts.upvotes} + ${posts.downvotes}) = 0 THEN 0.5
      ELSE CAST(${posts.upvotes} AS FLOAT) / (${posts.upvotes} + ${posts.downvotes})
    END`,
      })
      .from(posts)
      .leftJoin(profiles, eq(posts.author_id, profiles.userId))
      .leftJoin(communities, eq(posts.community_id, communities.id))
      .where(and(...conditions))
      .orderBy(...finalOrderBy);

    // Apply pagination
    const result = await query.limit(limit).offset(offset);

    // Post-process results to add computed fields
    const processedResults = result.map((post) => {
      const ageInHours =
        (datenow - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
      const hotScore = calculateHotScore(
        post.upvotes || 0,
        post.downvotes || 0,
        ageInHours
      );
      const controversyScore = calculateControversyScore(
        post.upvotes || 0,
        post.downvotes || 0
      );
      const trendingScore = calculateTrendingScore(
        post.score || 0,
        ageInHours,
        post.comment_count || 0
      );

      return {
        ...post,
        // Add computed scores for client-side reference
        computed_scores: {
          hot: hotScore,
          controversy: controversyScore,
          trending: trendingScore,
        },
        // Add relative time info
        age_info: {
          hours: Math.round(ageInHours * 10) / 10,
          days: Math.round((ageInHours / 24) * 10) / 10,
          is_fresh: ageInHours < 2,
          is_recent: ageInHours < 24,
        },
        // Add engagement metrics
        engagement_metrics: {
          vote_ratio: post.vote_ratio,
          engagement_rate: post.engagement_rate,
          total_votes: Number(post.upvotes) + Number(post.downvotes),
          comments_per_hour:
            Number(post.comment_count) / Math.max(ageInHours, 1),
        },
      };
    });

    // Add metadata about the feed
    const feedMetadata = {
      sort_type: sort,
      time_frame: timeFrame,
      community: communityName || "all",
      total_returned: processedResults.length,
      has_more: processedResults.length === limit,
      next_offset: offset + limit,
      generated_at: datenow,
      filters_applied: {
        community_filter: !!communityName,
        time_filter: timeFrame !== "all",
        nsfw_included: includeNSFW,
      },
    };

    return c.json({
      posts: processedResults,
      metadata: feedMetadata,
    });
  } catch (error) {
    console.error("Feed error:", error);
    return c.json({ error: "Failed to fetch posts feed" }, 500);
  }
});

// Get single post
post.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const postId = c.req.param("id");

  try {
    const post = await db
      .select({
        id: posts.id,
        title: posts.title,
        body: posts.body,
        type: posts.type,
        url: posts.url,
        score: posts.score,
        upvotes: posts.upvotes,
        downvotes: posts.downvotes,
        comment_count: posts.comment_count,
        created_at: posts.created_at,
        updated_at: posts.updated_at,
        author_username: profiles.username,
        community_name: communities.name,
        community_display_name: communities.display_name,
      })
      .from(posts)
      .leftJoin(profiles, eq(posts.author_id, profiles.userId))
      .leftJoin(communities, eq(posts.community_id, communities.id))
      .where(and(eq(posts.id, postId), eq(posts.is_deleted, false)))
      .limit(1);

    if (post.length === 0) {
      return c.json({ error: "Post not found" }, 404);
    }

    return c.json(post[0]);
  } catch (error) {
    return c.json({ error: "Failed to fetch post" }, 500);
  }
});

// Create post
post.post("/", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");

  try {
    let { title, body, type, url, community_name } = await c.req.json();

    if (!title || !type) {
      return c.json({ error: "Title,any ,type are required" }, 400);
    }
    if (!community_name) {
      community_name = "general";
    }
    if (!["text", "link", "image"].includes(type)) {
      return c.json({ error: "Invalid post type" }, 400);
    }

    if ((type === "link" || type === "image") && !url) {
      return c.json({ error: "URL is required for link/image posts" }, 400);
    }

    // Get community
    const community = await db
      .select()
      .from(communities)
      .where(eq(communities.name, community_name))
      .limit(1);

    if (community.length === 0) {
      return c.json({ error: "Community not found" }, 404);
    }

    const postId = generateId();

    // Create post
    await db.insert(posts).values({
      id: postId,
      title,
      body: body || null,
      type,
      url: url || null,
      community_id: community[0].id,
      author_id: user.id,
      created_at: now(),
    });

    // Update community post count
    await db
      .update(communities)
      .set({ post_count: sql`post_count + 1` })
      .where(eq(communities.id, community[0].id));

    return c.json(
      {
        id: postId,
        title,
        body,
        type,
        url,
        community_name,
        score: 0,
        upvotes: 0,
        downvotes: 0,
        comment_count: 0,
        created_at: now(),
      },
      201
    );
  } catch (error) {
    return c.json({ error: "Failed to create post" }, 500);
  }
});

// Vote on post
post.post("/:id/vote", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const postId = c.req.param("id");

  try {
    const { vote_type } = await c.req.json(); // 1 for upvote, -1 for downvote, 0 to remove vote

    if (![1, -1, 0].includes(vote_type)) {
      return c.json({ error: "Invalid vote type" }, 400);
    }

    // Check if post exists
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);

    if (post.length === 0) {
      return c.json({ error: "Post not found" }, 404);
    }

    // Check existing vote
    const existingVote = await db
      .select()
      .from(postVotes)
      .where(and(eq(postVotes.post_id, postId), eq(postVotes.user_id, user.id)))
      .limit(1);

    if (vote_type === 0) {
      // Remove vote
      if (existingVote.length > 0) {
        await db
          .delete(postVotes)
          .where(
            and(eq(postVotes.post_id, postId), eq(postVotes.user_id, user.id))
          );
      }
    } else {
      // Add or update vote
      if (existingVote.length > 0) {
        await db
          .update(postVotes)
          .set({ vote_type, created_at: now() })
          .where(
            and(eq(postVotes.post_id, postId), eq(postVotes.user_id, user.id))
          );
      } else {
        await db.insert(postVotes).values({
          id: generateId(),
          post_id: postId,
          user_id: user.id,
          vote_type,
          created_at: now(),
        });
      }
    }

    // Recalculate post score
    const voteStats = await db
      .select({
        upvotes: sql<number>`COUNT(CASE WHEN vote_type = 1 THEN 1 END)`,
        downvotes: sql<number>`COUNT(CASE WHEN vote_type = -1 THEN 1 END)`,
      })
      .from(postVotes)
      .where(eq(postVotes.post_id, postId));

    const upvotes = voteStats[0]?.upvotes || 0;
    const downvotes = voteStats[0]?.downvotes || 0;
    const score = upvotes - downvotes;

    await db
      .update(posts)
      .set({ upvotes, downvotes, score })
      .where(eq(posts.id, postId));

    return c.json({ upvotes, downvotes, score, user_vote: vote_type });
  } catch (error) {
    return c.json({ error: "Failed to vote on post" }, 500);
  }
});

// comments

post.get("/:postId/comments", async (c) => {
  const db = drizzle(c.env.DB);
  const postId = c.req.param("postId");
  const maxDepth = parseInt(c.req.query("maxDepth") || "2");

  try {
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (post.length === 0) return c.json({ error: "Post not found" }, 404);

    const allComments = await db
      .select({
        id: comments.id,
        post_id: comments.post_id,
        author_id: comments.author_id,
        parent_id: comments.parent_id,
        body: comments.body,
        created_at: comments.created_at,
        updated_at: comments.updated_at,
        upvotes: comments.upvotes,
        downvotes: comments.downvotes,
        score: comments.score,
        reply_count: comments.reply_count,
        depth: comments.depth,
        is_deleted: comments.is_deleted,
        author_username: profiles.username,
        author_display_name: profiles.firstName,
      })
      .from(comments)
      .leftJoin(profiles, eq(comments.author_id, profiles.userId))
      .where(
        and(
          eq(comments.post_id, postId),
          eq(comments.is_deleted, false),
          sql`${comments.depth} <= ${maxDepth}`
        )
      )
      .orderBy(comments.created_at);

    const commentMap = new Map();
    const rootComments: any[] = [];

    allComments.forEach((comment) => {
      commentMap.set(comment.id, { ...comment, replies: [] });
    });

    allComments.forEach((comment) => {
      if (comment.parent_id) {
        const parent = commentMap.get(comment.parent_id);
        if (parent) parent.replies.push(commentMap.get(comment.id));
      } else {
        rootComments.push(commentMap.get(comment.id));
      }
    });

    return c.json(rootComments);
  } catch (error) {
    console.log(error);

    return c.json({ error: "Failed to fetch comments" }, 500);
  }
});

// POST: Create a new comment or reply on a post
post.post("/:postId/comments", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const postId = c.req.param("postId");

  try {
    const { body, parent_id } = await c.req.json();

    if (!body?.trim())
      return c.json({ error: "Comment body is required" }, 400);
    if (body.length > 10000)
      return c.json({ error: "Comment too long (max 10000 characters)" }, 400);

    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    if (post.length === 0) return c.json({ error: "Post not found" }, 404);

    let depth = 0;

    if (parent_id) {
      const parent = await db
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.id, parent_id),
            eq(comments.post_id, postId),
            eq(comments.is_deleted, false)
          )
        )
        .limit(1);

      if (parent.length === 0)
        return c.json({ error: "Parent comment not found" }, 404);

      depth = (parent[0].depth || 0) + 1;
      if (depth > 2)
        return c.json({ error: "Maximum nesting depth reached" }, 400);
    }

    const commentId = generateId();
    let dateNow = now();

    await db.insert(comments).values({
      id: commentId,
      post_id: postId,
      author_id: user.id,
      parent_id: parent_id || null,
      body: body.trim(),
      created_at: dateNow,
      depth,
    });

    if (parent_id) {
      await db
        .update(comments)
        .set({ reply_count: sql`reply_count + 1` })
        .where(eq(comments.id, parent_id));
    }

    await db
      .update(posts)
      .set({ comment_count: sql`comment_count + 1` })
      .where(eq(posts.id, postId));

    return c.json(
      {
        id: commentId,
        post_id: postId,
        parent_id: parent_id || null,
        body: body.trim(),
        score: 0,
        upvotes: 0,
        downvotes: 0,
        reply_count: 0,
        depth,
        created_at: dateNow,
      },
      201
    );
  } catch {
    return c.json({ error: "Failed to create comment" }, 500);
  }
});

export { post };
