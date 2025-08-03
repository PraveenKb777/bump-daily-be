// src/schema.ts
import {
  sqliteTable,
  text,
  integer,
  index,
  unique,
  foreignKey,
} from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";

export const tempFiles = sqliteTable("temp_files", {
  id: text("id").primaryKey(),
  isUsed: integer("is_used", { mode: "boolean" }).default(false),
  createdAt: text("created_at").notNull(),
});

// Users table - stores basic user info from Supabase
export const users = sqliteTable("users", {
  id: text("id").primaryKey(), // Supabase user ID
  email: text("email").notNull().unique(),
  createdAt: text("created_at").notNull(),
});

// User profiles table - stores additional user information
export const profiles = sqliteTable("profiles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  username: text("username").unique(), // Added username for display
  avatar: text("avatar"), // URL to avatar image
  bio: text("bio"),
  phone: text("phone"),
  company: text("company"),
  position: text("position"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// User roles table - for role-based access control
export const userRoles = sqliteTable("user_roles", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("user"), // 'user', 'admin', 'moderator'
  assignedAt: text("assigned_at").notNull().default("auto"),
  assignedBy: text("assigned_by"), // ID of admin who assigned the role
});

// Communities table
export const communities = sqliteTable(
  "communities",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull().unique(),
    display_name: text("display_name").notNull(),
    description: text("description"),
    created_at: text("created_at").notNull(),
    created_by: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    member_count: integer("member_count").default(0),
    post_count: integer("post_count").default(0),
    is_private: integer("is_private", { mode: "boolean" }).default(false),
  },
  (table) => [index("idx_communities_name").on(table.name)]
);

// Posts table
export const posts = sqliteTable(
  "posts",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    body: text("body"),
    type: text("type").notNull(), // 'text', 'link', 'image'
    url: text("url"),
    community_id: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    author_id: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
    upvotes: integer("upvotes").default(0),
    downvotes: integer("downvotes").default(0),
    score: integer("score").default(0),
    comment_count: integer("comment_count").default(0),
    is_deleted: integer("is_deleted", { mode: "boolean" }).default(false),
  },
  (table) => {
    return [
      index("idx_posts_community_created").on(
        table.community_id,
        table.created_at
      ),
      index("idx_posts_score").on(table.score),
      index("idx_posts_author").on(table.author_id),
    ];
  }
);

// Post votes table
export const postVotes = sqliteTable(
  "post_votes",
  {
    id: text("id").primaryKey(),
    post_id: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote_type: integer("vote_type").notNull(),
    created_at: text("created_at").notNull(),
  },
  (table) => [
    index("idx_post_votes_post").on(table.post_id),
    unique().on(table.post_id, table.user_id),
  ]
);

// Community memberships table
export const communityMemberships = sqliteTable(
  "community_memberships",
  {
    id: text("id").primaryKey(),
    community_id: text("community_id")
      .notNull()
      .references(() => communities.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    joined_at: text("joined_at").notNull(),
    role: text("role").default("member"),
  },
  (table) => [
    index("idx_community_memberships_user").on(table.user_id),
    unique().on(table.community_id, table.user_id),
  ]
);

// Comments table

export const comments = sqliteTable(
  "comments",
  {
    id: text("id").primaryKey(),
    post_id: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    author_id: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    parent_id: text("parent_id"), // Remove the reference initially
    body: text("body").notNull(),
    created_at: text("created_at").notNull(),
    updated_at: text("updated_at"),
    upvotes: integer("upvotes").default(0),
    downvotes: integer("downvotes").default(0),
    score: integer("score").default(0),
    reply_count: integer("reply_count").default(0),
    depth: integer("depth").default(0),
    is_deleted: integer("is_deleted", { mode: "boolean" }).default(false),
    deleted_by: text("deleted_by"),
  },
  (table) => [
    index("idx_comments_post_created").on(table.post_id, table.created_at),
    index("idx_comments_parent").on(table.parent_id),
    index("idx_comments_author").on(table.author_id),
    index("idx_comments_score").on(table.score),
    index("idx_comments_post_parent").on(table.post_id, table.parent_id),
    // Add the foreign key constraint here instead
    foreignKey({
      columns: [table.parent_id],
      foreignColumns: [table.id],
      name: "comments_parent_id_fk",
    }).onDelete("cascade"),
  ]
);

// Comment votes table
export const commentVotes = sqliteTable(
  "comment_votes",
  {
    id: text("id").primaryKey(),
    comment_id: text("comment_id")
      .notNull()
      .references(() => comments.id, { onDelete: "cascade" }),
    user_id: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    vote_type: integer("vote_type").notNull(),
    created_at: text("created_at").notNull(),
  },
  (table) => [
    index("idx_comment_votes_comment").on(table.comment_id),
    unique().on(table.comment_id, table.user_id),
  ]
);

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  profile: one(profiles, {
    fields: [users.id],
    references: [profiles.userId],
  }),
  role: one(userRoles, {
    fields: [users.id],
    references: [userRoles.userId],
  }),
  posts: many(posts),
  communities: many(communities),
  memberships: many(communityMemberships),
  votes: many(postVotes),
  comments: many(comments),
  commentVotes: many(commentVotes),
}));

export const profilesRelations = relations(profiles, ({ one }) => ({
  user: one(users, {
    fields: [profiles.userId],
    references: [users.id],
  }),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, {
    fields: [userRoles.userId],
    references: [users.id],
  }),
}));

export const communitiesRelations = relations(communities, ({ one, many }) => ({
  creator: one(users, {
    fields: [communities.created_by],
    references: [users.id],
  }),
  posts: many(posts),
  memberships: many(communityMemberships),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.author_id],
    references: [users.id],
  }),
  community: one(communities, {
    fields: [posts.community_id],
    references: [communities.id],
  }),
  votes: many(postVotes),
  comments: many(comments),
}));

export const postVotesRelations = relations(postVotes, ({ one }) => ({
  post: one(posts, {
    fields: [postVotes.post_id],
    references: [posts.id],
  }),
  user: one(users, {
    fields: [postVotes.user_id],
    references: [users.id],
  }),
}));

export const communityMembershipsRelations = relations(
  communityMemberships,
  ({ one }) => ({
    community: one(communities, {
      fields: [communityMemberships.community_id],
      references: [communities.id],
    }),
    user: one(users, {
      fields: [communityMemberships.user_id],
      references: [users.id],
    }),
  })
);

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.post_id],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.author_id],
    references: [users.id],
  }),
  parent: one(comments, {
    fields: [comments.parent_id],
    references: [comments.id],
    relationName: "parent_comment",
  }),
  replies: many(comments, {
    relationName: "parent_comment",
  }),
  votes: many(commentVotes),
}));

export const commentVotesRelations = relations(commentVotes, ({ one }) => ({
  comment: one(comments, {
    fields: [commentVotes.comment_id],
    references: [comments.id],
  }),
  user: one(users, {
    fields: [commentVotes.user_id],
    references: [users.id],
  }),
}));

// Types for TypeScript - Original tables
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

// Types for new tables
export type Community = typeof communities.$inferSelect;
export type NewCommunity = typeof communities.$inferInsert;

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;

export type PostVote = typeof postVotes.$inferSelect;
export type NewPostVote = typeof postVotes.$inferInsert;

export type CommunityMembership = typeof communityMemberships.$inferSelect;
export type NewCommunityMembership = typeof communityMemberships.$inferInsert;

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;

export type CommentVote = typeof commentVotes.$inferSelect;
export type NewCommentVote = typeof commentVotes.$inferInsert;

export type TempFiles = typeof tempFiles.$inferSelect;
export type NewTempFiles = typeof tempFiles.$inferSelect;
