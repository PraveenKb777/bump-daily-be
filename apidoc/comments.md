# 💬 Comments API Documentation

All endpoints below are prefixed with `/comments`

---

## 📄 GET `/comments/:id`

Fetch a single comment by ID.

### URL Parameter

- `id: string` — ID of the comment

### Response

```ts
{
  id: string;
  post_id: string;
  author_id: string;
  parent_id: string | null;
  body: string;
  created_at: number;
  updated_at: number;
  upvotes: number;
  downvotes: number;
  score: number;
  reply_count: number;
  depth: number;
  is_deleted: boolean;
  author_username: string;
  author_display_name: string;
}
```

### Error Responses

- `404` – Comment not found
- `500` – Failed to fetch comment

---

## 👍 POST `/comments/:id/vote`

Vote on a comment. Requires authentication.

### Request Body

```ts
{
  vote_type: 1 | -1 | 0; // upvote, downvote, or remove
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

### Error Responses

- `400` – Invalid vote type
- `404` – Comment not found
- `500` – Failed to vote on comment

---

## ✏️ PUT `/comments/:id`

Edit a comment. Requires authentication. Only allowed within 10 minutes of creation.

### Request Body

```ts
{
  body: string;
}
```

### Success Response

```ts
{
  message: "Comment updated successfully";
  body: string;
  updated_at: number;
}
```

### Error Responses

- `400` – Body missing, too long, or edit time exceeded
- `404` – Comment not found or unauthorized
- `500` – Failed to update comment

---

## ❌ DELETE `/comments/:id`

Soft delete a comment. Requires authentication.

### Success Response

```ts
{
  message: "Comment deleted successfully";
}
```

### Error Responses

- `404` – Comment not found or unauthorized
- `500` – Failed to delete comment

---

## 📝 Notes

- Voting updates the aggregate score and vote counts.
- Comments can only be edited by their authors within 10 minutes.
- Deleting a comment is a soft delete (data is retained but marked as deleted).
- Deleting also decrements the reply count and post comment count.
