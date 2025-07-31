import { Hono } from "hono";
import { drizzle } from "drizzle-orm/d1";
import { and, eq, sql } from "drizzle-orm";
import { comments, commentVotes, posts } from "../db/schema";
import { profiles } from "../db";
import { authMiddleware } from "../middleware";
import { generateId, now } from "../utils";
import { Bindings, Variables } from "../types";

const commentsRoute = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();


// Get single comment
commentsRoute.get("/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const commentId = c.req.param("id");

  try {
    const result = await db
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
      .leftJoin(profiles, eq(profiles.id, comments.author_id))
      .where(and(eq(comments.id, commentId), eq(comments.is_deleted, false)))
      .limit(1);

    if (result.length === 0) return c.json({ error: "Comment not found" }, 404);
    return c.json(result[0]);
  } catch {
    return c.json({ error: "Failed to fetch comment" }, 500);
  }
});

// Vote on a comment
commentsRoute.post("/:id/vote", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const commentId = c.req.param("id");

  try {
    const { vote_type } = await c.req.json();
    if (![1, -1, 0].includes(vote_type)) {
      return c.json({ error: "Invalid vote type" }, 400);
    }

    const comment = await db
      .select()
      .from(comments)
      .where(and(eq(comments.id, commentId), eq(comments.is_deleted, false)))
      .limit(1);

    if (comment.length === 0) return c.json({ error: "Comment not found" }, 404);

    const existingVote = await db
      .select()
      .from(commentVotes)
      .where(and(
        eq(commentVotes.comment_id, commentId),
        eq(commentVotes.user_id, user.id)
      ))
      .limit(1);

    if (vote_type === 0 && existingVote.length > 0) {
      await db.delete(commentVotes).where(and(
        eq(commentVotes.comment_id, commentId),
        eq(commentVotes.user_id, user.id)
      ));
    } else if (existingVote.length > 0) {
      await db.update(commentVotes)
        .set({ vote_type, created_at: now() })
        .where(and(
          eq(commentVotes.comment_id, commentId),
          eq(commentVotes.user_id, user.id)
        ));
    } else if (vote_type !== 0) {
      await db.insert(commentVotes).values({
        id: generateId(),
        comment_id: commentId,
        user_id: user.id,
        vote_type,
        created_at: now(),
      });
    }

    const voteStats = await db
      .select({
        upvotes: sql<number>`COUNT(CASE WHEN vote_type = 1 THEN 1 END)`,
        downvotes: sql<number>`COUNT(CASE WHEN vote_type = -1 THEN 1 END)`,
      })
      .from(commentVotes)
      .where(eq(commentVotes.comment_id, commentId));

    const upvotes = voteStats[0]?.upvotes || 0;
    const downvotes = voteStats[0]?.downvotes || 0;
    const score = upvotes - downvotes;

    await db.update(comments).set({ upvotes, downvotes, score }).where(eq(comments.id, commentId));

    return c.json({ upvotes, downvotes, score, user_vote: vote_type });
  } catch {
    return c.json({ error: "Failed to vote on comment" }, 500);
  }
});

// Edit a comment
commentsRoute.put("/:id", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const commentId = c.req.param("id");

  try {
    const { body } = await c.req.json();
    if (!body?.trim()) return c.json({ error: "Comment body is required" }, 400);
    if (body.length > 10000) return c.json({ error: "Comment too long" }, 400);

    const comment = await db
      .select()
      .from(comments)
      .where(and(
        eq(comments.id, commentId),
        eq(comments.author_id, user.id),
        eq(comments.is_deleted, false)
      ))
      .limit(1);

    if (comment.length === 0) return c.json({ error: "Comment not found or not authorized" }, 404);

    const createdAt = new Date(comment[0].created_at).getTime();
    const nowTime = Date.now();
    const editTimeLimit = 10 * 60 * 1000;

    if (nowTime - createdAt > editTimeLimit) {
      return c.json({ error: "Edit time limit exceeded (10 minutes)" }, 400);
    }

    await db.update(comments).set({ body: body.trim(), updated_at: now() }).where(eq(comments.id, commentId));
    return c.json({ message: "Comment updated successfully", body: body.trim(), updated_at: now });
  } catch {
    return c.json({ error: "Failed to update comment" }, 500);
  }
});

// Delete (soft delete) comment
commentsRoute.delete("/:id", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const commentId = c.req.param("id");

  try {
    const comment = await db
      .select()
      .from(comments)
      .where(and(
        eq(comments.id, commentId),
        eq(comments.author_id, user.id),
        eq(comments.is_deleted, false)
      ))
      .limit(1);

    if (comment.length === 0) return c.json({ error: "Comment not found or not authorized" }, 404);

    await db.update(comments).set({
      is_deleted: true,
      deleted_by: user.id,
      updated_at: now(),
    }).where(eq(comments.id, commentId));

    if (comment[0].parent_id) {
      await db.update(comments)
        .set({ reply_count: sql`reply_count - 1` })
        .where(eq(comments.id, comment[0].parent_id));
    }

    await db.update(posts)
      .set({ comment_count: sql`comment_count - 1` })
      .where(eq(posts.id, comment[0].post_id));

    return c.json({ message: "Comment deleted successfully" });
  } catch {
    return c.json({ error: "Failed to delete comment" }, 500);
  }
});

export default commentsRoute;
