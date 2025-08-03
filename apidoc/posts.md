# 📫 Posts API Documentation

This document provides a detailed reference for the `/posts` endpoints, which manage post creation, listing, voting, and comments in your application.

---

## 🔍 GET `/posts`

Fetch a paginated feed of posts with optional filters.

### Query Parameters

```ts
{
  community?: string;
  sort?: "hot" | "new" | "top" | "top24h" | "trending" | "controversial";
  timeFrame?: "1h" | "6h" | "24h" | "7d" | "30d" | "all";
  limit?: number;     // max: 100
  offset?: number;
  nsfw?: boolean;
}
```

### Success Response

```ts
{
  posts: Array<PostWithMetrics>;
  metadata: {
    sort_type: string;
    time_frame: string;
    community: string;
    total_returned: number;
    has_more: boolean;
    next_offset: number;
    generated_at: number;
    filters_applied: {
      community_filter: boolean;
      time_filter: boolean;
      nsfw_included: boolean;
    }
  }
}
```

### Error Response

```ts
500 – { error: "Failed to fetch posts feed" }
```

---

## 📄 GET `/posts/:id`

Fetch details of a single post by ID.

### URL Parameter

- `id: string`

### Response

```ts
{
  id: string;
  title: string;
  body: string | null;
  type: "text" | "link" | "image";
  url: string | null;
  score: number;
  upvotes: number;
  downvotes: number;
  comment_count: number;
  created_at: number;
  updated_at: number;
  author_username: string;
  community_name: string;
  community_display_name: string;
}
```

---

## ➕ POST `/posts`

Create a new post. Requires authentication.

### Request Body

```ts
{
  title: string;
  body?: string;
  type: "text" | "link" | "image";
  url?: string;
  community_name?: string;
}
```

### Success Response

```ts
{
  id: string;
  title: string;
  body: string | null;
  type: string;
  url: string | null;
  community_name: string;
  score: 0;
  upvotes: 0;
  downvotes: 0;
  comment_count: 0;
  created_at: number;
}
```

---

## 👍 POST `/posts/:id/vote`

Vote on a post. Requires authentication.

### Request Body

```ts
{
  vote_type: 1 | -1 | 0; // upvote, downvote, remove vote
}
```

### Success Response

```ts
{
  upvotes: number;
  downvotes: number;
  score: number;
  user_vote: -1 | 0 | 1;
}
```

---

## 💬 GET `/posts/:postId/comments`

Get comments for a post.

### URL Parameter

- `postId: string`

### Query Parameters

- `maxDepth?: number` (default: 2)

### Success Response

```ts
CommentWithReplies[] // Nested with "replies" array
```

### Error Responses

- `404` – Post not found
- `500` – Failed to fetch comments

---

## ✍️ POST `/posts/:postId/comments`

Create a comment on a post. Requires authentication.

### Request Body

```ts
{
  body: string;
  parent_id?: string;
}
```

### Success Response

```ts
{
  id: string;
  post_id: string;
  parent_id: string | null;
  body: string;
  score: 0;
  upvotes: 0;
  downvotes: 0;
  reply_count: 0;
  depth: number;
  created_at: number;
}
```

### Error Responses

- `400` – Missing body, too long, or max depth exceeded
- `404` – Post or parent not found
- `500` – Failed to create comment

---

## 📝 Notes

- Pagination is supported via `limit` and `offset`.
- Filtering by `community`, `sort`, `timeFrame`, and `nsfw` is available on the feed.
- Comment replies are nested to a maximum of 2 levels.
- Authentication is required for post creation, commenting, and voting.

---
