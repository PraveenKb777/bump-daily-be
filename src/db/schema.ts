// src/schema.ts
import { sqliteTable, text, integer, index, unique } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Users table - stores basic user info from Supabase
export const users = sqliteTable('users', {
  id: text('id').primaryKey(), // Supabase user ID
  email: text('email').notNull().unique(),
  createdAt: text('created_at').notNull(),
});

// User profiles table - stores additional user information
export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  username: text('username').unique(), // Added username for display
  avatar: text('avatar'), // URL to avatar image
  bio: text('bio'),
  phone: text('phone'),
  company: text('company'),
  position: text('position'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// User roles table - for role-based access control
export const userRoles = sqliteTable('user_roles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('user'), // 'user', 'admin', 'moderator'
  assignedAt: text('assigned_at').notNull().default('auto'),
  assignedBy: text('assigned_by'), // ID of admin who assigned the role
});

// Communities table
export const communities = sqliteTable('communities', {
  id: text('id').primaryKey(),
  name: text('name').notNull().unique(),
  display_name: text('display_name').notNull(),
  description: text('description'),
  created_at: integer('created_at').notNull(),
  created_by: text('created_by').notNull().references(() => users.id, { onDelete: 'cascade' }),
  member_count: integer('member_count').default(0),
  post_count: integer('post_count').default(0),
  is_private: integer('is_private', { mode: 'boolean' }).default(false),
}, (table) => ({
  nameIdx: index('idx_communities_name').on(table.name),
}));

// Posts table
export const posts = sqliteTable('posts', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  body: text('body'),
  type: text('type', { enum: ['text', 'link', 'image'] }).notNull(),
  url: text('url'),
  community_id: text('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
  author_id: text('author_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  created_at: integer('created_at').notNull(),
  updated_at: integer('updated_at'),
  upvotes: integer('upvotes').default(0),
  downvotes: integer('downvotes').default(0),
  score: integer('score').default(0),
  comment_count: integer('comment_count').default(0),
  is_deleted: integer('is_deleted', { mode: 'boolean' }).default(false),
}, (table) => ({
  communityCreatedIdx: index('idx_posts_community_created').on(table.community_id, table.created_at),
  scoreIdx: index('idx_posts_score').on(table.score),
  authorIdx: index('idx_posts_author').on(table.author_id),
}));

// Post votes table (for tracking individual votes)
export const postVotes = sqliteTable('post_votes', {
  id: text('id').primaryKey(),
  post_id: text('post_id').notNull().references(() => posts.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  vote_type: integer('vote_type').notNull(), // -1 for downvote, 1 for upvote
  created_at: integer('created_at').notNull(),
}, (table) => ({
  postIdx: index('idx_post_votes_post').on(table.post_id),
  uniqueVote: unique().on(table.post_id, table.user_id),
}));

// Community memberships table
export const communityMemberships = sqliteTable('community_memberships', {
  id: text('id').primaryKey(),
  community_id: text('community_id').notNull().references(() => communities.id, { onDelete: 'cascade' }),
  user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  joined_at: integer('joined_at').notNull(),
  role: text('role', { enum: ['member', 'moderator', 'admin'] }).default('member'),
}, (table) => ({
  userIdx: index('idx_community_memberships_user').on(table.user_id),
  uniqueMembership: unique().on(table.community_id, table.user_id),
}));

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

export const communityMembershipsRelations = relations(communityMemberships, ({ one }) => ({
  community: one(communities, {
    fields: [communityMemberships.community_id],
    references: [communities.id],
  }),
  user: one(users, {
    fields: [communityMemberships.user_id],
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