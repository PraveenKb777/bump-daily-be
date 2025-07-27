import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { communities, posts, postVotes, profiles, users } from "../db";
import { and, desc, eq, SQL, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { authMiddleware } from "../middleware";
import { generateId, now } from "../utils";

const post = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();



// Get posts (feed) based on community
post.get('/', async (c) => {
  try {
    const db = drizzle(c.env.DB);

    const communityName = c.req.query('community');
    const sort = (c.req.query('sort') || 'hot').toLowerCase();
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100);
    const offset = Math.max(parseInt(c.req.query('offset') || '0', 10), 0);

    if (isNaN(limit) || isNaN(offset)) {
      return c.json({ error: 'Invalid limit or offset' }, 400);
    }

    const conditions = [eq(posts.is_deleted, false)];
    if (communityName) {
      conditions.push(eq(communities.name, communityName));
    }

    let orderByConditions:SQL<unknown>;
    switch (sort) {
      case 'new':
        orderByConditions = (desc(posts.created_at));
        break;
      case 'top':
        orderByConditions = (desc(posts.score));
        break;
      case 'hot':
      default:
        orderByConditions = (
          desc(
            sql`(posts.upvotes - posts.downvotes) * 1.0 / (julianday('now') - julianday(posts.created_at, 'unixepoch') + 1)`
          )
        );
        break;
    }

    let query = db
      .select()
      .from(posts)
      .leftJoin(profiles, eq(posts.author_id, profiles.userId))
      .leftJoin(communities, eq(posts.community_id, communities.id))
      .where(and(...conditions)).orderBy(orderByConditions);



    const result = await query.limit(limit).offset(offset);

    const mapped = result.map((row) => ({
      id: row.posts.id,
      title: row.posts.title,
      body: row.posts.body,
      type: row.posts.type,
      url: row.posts.url,
      score: row.posts.score,
      upvotes: row.posts.upvotes,
      downvotes: row.posts.downvotes,
      comment_count: row.posts.comment_count,
      created_at: row.posts.created_at,
      author_username: row.profiles?.username,
      community_name: row.communities?.name,
      community_display_name: row.communities?.display_name,
    }));

    return c.json(mapped);
  } catch (error) {
  console.error('Error fetching posts:', error);

  if (error instanceof Error) {
    return c.json({ error: 'Failed to fetch posts', details: error.message }, 500);
  }

  return c.json({ error: 'Failed to fetch posts', details: String(error) }, 500);
}
});




// Get single post
post.get('/:id', async (c) => {
  const db = drizzle(c.env.DB);
  const postId = c.req.param('id');
  
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
      return c.json({ error: 'Post not found' }, 404);
    }
    
    return c.json(post[0]);
  } catch (error) {
    return c.json({ error: 'Failed to fetch post' }, 500);
  }
});

// Create post
post.post('/', authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  
  try {
    let { title, body, type, url, community_name } = await c.req.json();


    
    if (!title || !type) {
      return c.json({ error: 'Title,any ,type are required' }, 400);
    }
    if(!community_name) {
        community_name = "general"
    }
    if (!['text', 'link', 'image'].includes(type)) {
      return c.json({ error: 'Invalid post type' }, 400);
    }
    
    if ((type === 'link' || type === 'image') && !url) {
      return c.json({ error: 'URL is required for link/image posts' }, 400);
    }
    
    // Get community
    const community = await db
      .select()
      .from(communities)
      .where(eq(communities.name, community_name))
      .limit(1);
    
    if (community.length === 0) {
      return c.json({ error: 'Community not found' }, 404);
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
    
    return c.json({ 
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
    }, 201);
  } catch (error) {
    return c.json({ error: 'Failed to create post' }, 500);
  }
});

// Vote on post
post.post('/:id/vote', authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get('user');
  const postId = c.req.param('id');
  
  try {
    const { vote_type } = await c.req.json(); // 1 for upvote, -1 for downvote, 0 to remove vote
    
    if (![1, -1, 0].includes(vote_type)) {
      return c.json({ error: 'Invalid vote type' }, 400);
    }
    
    // Check if post exists
    const post = await db
      .select()
      .from(posts)
      .where(eq(posts.id, postId))
      .limit(1);
    
    if (post.length === 0) {
      return c.json({ error: 'Post not found' }, 404);
    }
    
    // Check existing vote
    const existingVote = await db
      .select()
      .from(postVotes)
      .where(and(
        eq(postVotes.post_id, postId),
        eq(postVotes.user_id, user.id)
      ))
      .limit(1);
    
    if (vote_type === 0) {
      // Remove vote
      if (existingVote.length > 0) {
        await db
          .delete(postVotes)
          .where(and(
            eq(postVotes.post_id, postId),
            eq(postVotes.user_id, user.id)
          ));
      }
    } else {
      // Add or update vote
      if (existingVote.length > 0) {
        await db
          .update(postVotes)
          .set({ vote_type, created_at:now() })
          .where(and(
            eq(postVotes.post_id, postId),
            eq(postVotes.user_id, user.id)
          ));
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
    return c.json({ error: 'Failed to vote on post' }, 500);
  }
});


export {post}