````markdown
# 🏘️ Communities API Documentation

All routes are prefixed with `/communities`

---

## 📥 GET `/communities`

Fetch all communities ordered by member count.

### Success Response

```ts
Array<{
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  member_count: number;
  post_count: number;
  created_at: string;
}>;
```
````

### Error Response

```ts
500 – { error: "Failed to fetch communities" }
```

---

## 📄 GET `/communities/details/:name`

Fetch details of a single community.

### URL Param

- `name`: `string` – Community name

### Success Response

```ts
{
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  member_count: number;
  post_count: number;
  created_at: string;
  creator_username: string | null;
}
```

### Error Responses

- `404` – Community not found
- `500` – Failed to fetch community

---

## 🙋‍♂️ GET `/communities/my-communities` (Auth required)

Fetch communities the user is a member of.

### Success Response

```ts
Array<{
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  member_count: number;
  post_count: number;
  created_at: string;
  role: "member" | "admin";
}>;
```

### Error Responses

- `401` – Unauthorized access
- `500` – Internal server error

---

## ➕ POST `/communities` (Auth required)

Create a new community.

### Request Body

````ts
{
  name: string;
  display_name: string;
  description?: string;
}```

### Success Response
```ts
{
  id: string;
  name: string;
  display_name: string;
  description: string | null;
  member_count: 1;
  post_count: 0;
}
````

### Error Responses

- `400` – Missing name or display name, or name already exists
- `500` – Failed to create community

---

## 👥 POST `/communities/:name/membership` (Auth required)

Join or leave a community.

### URL Param

- `name`: `string` – Community name

### Request Body

```ts
{
  action: "join" | "leave";
}
```

### Success Responses

**Join:**

```ts
{ message: "Joined successfully", is_member: true }
```

**Leave:**

```ts
{ message: "Left successfully", is_member: false }
```

### Error Responses

- `400` – Invalid action, already a member, or not a member
- `404` – Community not found
- `500` – Failed to update membership

---

## ✏️ PATCH `/communities/:name` (Auth required, Admin only)

Update a community’s details.

### URL Param

- `name`: `string` – Community name

### Request Body

```ts
{
  display_name?: string;
  description?: string;
  is_private?: boolean;
}
```

### Success Response

```ts
{
  message: "Community '<name>' updated successfully.";
  data: {
    name: string;
    display_name?: string;
    description?: string;
    is_private?: boolean;
  }
}
```

### Error Responses

- `401` – Not authenticated
- `403` – No permission to edit
- `404` – Community not found
- `500` – Failed to update community

---

## 📝 Notes

- Community `name` must be unique and lowercase.
- Creator is automatically added as an admin.
- `my-communities` requires authentication and returns roles.
- Only admins can edit community metadata.```
