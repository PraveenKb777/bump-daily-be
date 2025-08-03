import { Hono } from "hono";
import { AuthenticatedUser, Bindings, Variables } from "../types";
import { drizzle } from "drizzle-orm/d1";
import {
  communities,
  Community,
  communityMemberships,
  profiles,
  users,
} from "../db";
import { and, desc, eq, sql } from "drizzle-orm";
import { generateId } from "../utils";
import { authMiddleware } from "../middleware";
import { isValidUsername } from "../utils/checkValidUserName";
import { optionalAuthMiddleware } from "../middleware/optionalAuth";

const communitiesRoute = new Hono<{
  Bindings: Bindings;
  Variables: Variables;
}>();

communitiesRoute.get("/", async (c) => {
  const db = drizzle(c.env.DB);

  try {
    const allCommunities = await db
      .select({
        id: communities.id,
        name: communities.name,
        display_name: communities.display_name,
        description: communities.description,
        member_count: communities.member_count,
        post_count: communities.post_count,
        created_at: communities.created_at,
      })
      .from(communities)
      .orderBy(desc(communities.member_count));

    return c.json(allCommunities);
  } catch (error) {
    return c.json({ error: "Failed to fetch communities" }, 500);
  }
});

communitiesRoute.get("/details/:name", optionalAuthMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const communityName = c.req.param("name");

  try {
    const community = await db
      .select({
        id: communities.id,
        name: communities.name,
        display_name: communities.display_name,
        description: communities.description,
        member_count: communities.member_count,
        post_count: communities.post_count,
        created_at: communities.created_at,
        creator_username: profiles.username,
      })
      .from(communities)
      .leftJoin(profiles, eq(communities.created_by, profiles.userId))
      .where(eq(communities.name, communityName))
      .limit(1);

    if (community.length === 0) {
      return c.json({ error: "Community not found" }, 404);
    }

    const communityData = community[0];

    // If user is logged in, check if they're a member
    const user = c.get("user") as AuthenticatedUser | undefined;
    let isMember = false;

    if (user) {
      const membership = await db
        .select()
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.community_id, communityData.id),
            eq(communityMemberships.user_id, user.id)
          )
        )
        .limit(1)
        .all();
      console.log("membership", membership);

      isMember = membership.length > 0;
    }

    return c.json({
      ...communityData,
      isMember,
    });
  } catch (error) {
    console.error("Error fetching community:", error);
    return c.json({ error: "Failed to fetch community" }, 500);
  }
});

communitiesRoute.get("/my-communities", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");

    if (!user || !user.id) {
      return c.json({ error: "Unauthorized access." }, 401);
    }

    const data = await db
      .select({
        id: communities.id,
        name: communities.name,
        display_name: communities.display_name,
        description: communities.description,
        member_count: communities.member_count,
        post_count: communities.post_count,
        created_at: communities.created_at,
        role: communityMemberships.role,
      })
      .from(communities)
      .innerJoin(
        communityMemberships,
        eq(communities.id, communityMemberships.community_id)
      )
      .where(eq(communityMemberships.user_id, user.id));

    return c.json(data);
  } catch (error) {
    console.error("Failed to fetch user communities:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

communitiesRoute.get("/check-community-name", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const communityName = c.req.query("community-name");

    if (!isValidUsername(communityName || "")) {
      return c.json({ error: "Invalid username format" }, 400);
    }
    if (!communityName || typeof communityName !== "string") {
      return c.json({ error: "Community Name is required" }, 400);
    }

    const result = await db
      .select({ id: communities.id })
      .from(communities)
      .where(eq(communities.name, communityName))
      .get();

    return c.json({ isValid: !result }, 200);
  } catch (error) {
    console.log(error);

    return c.json({ error: "Can't validate community name" }, 500);
  }
});

communitiesRoute.post("/", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");

  try {
    const { name, display_name, description } = await c.req.json();

    if (!name || !display_name) {
      return c.json({ error: "Name and display name are required" }, 400);
    }

    // Check if community name already exists
    const existing = await db
      .select()
      .from(communities)
      .where(eq(communities.name, name))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ error: "Community name already exists" }, 400);
    }

    const communityId = generateId();
    const now = new Date().toISOString();

    // Create community
    await db.insert(communities).values({
      id: communityId,
      name: name.toLowerCase(),
      display_name,
      description: description || null,
      created_by: user.id,
      created_at: now,
      member_count: 1,
    });

    // Add creator as admin member
    await db.insert(communityMemberships).values({
      id: generateId(),
      community_id: communityId,
      user_id: user.id,
      joined_at: now,
      role: "admin",
    });

    return c.json(
      {
        id: communityId,
        name: name.toLowerCase(),
        display_name,
        description,
        member_count: 1,
        post_count: 0,
      },
      201
    );
  } catch (error) {
    console.log(error);
    return c.json({ error: "Failed to create community" }, 500);
  }
});
communitiesRoute.post("/:name/membership", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const user = c.get("user");
  const communityName = c.req.param("name");

  try {
    const { action } = await c.req.json(); // 'join' or 'leave'

    // Get community
    const community = await db
      .select()
      .from(communities)
      .where(eq(communities.name, communityName))
      .limit(1);

    if (community.length === 0) {
      return c.json({ error: "Community not found" }, 404);
    }

    const communityId = community[0].id;

    if (action === "join") {
      // Check if already a member
      const existing = await db
        .select()
        .from(communityMemberships)
        .where(
          and(
            eq(communityMemberships.community_id, communityId),
            eq(communityMemberships.user_id, user.id)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return c.json({ error: "Already a member" }, 400);
      }

      // Join community
      await db.insert(communityMemberships).values({
        id: generateId(),
        community_id: communityId,
        user_id: user.id,
        joined_at: new Date().toISOString(),
        role: "member",
      });

      // Update member count
      await db
        .update(communities)
        .set({ member_count: sql`member_count + 1` })
        .where(eq(communities.id, communityId));

      return c.json({ message: "Joined successfully", is_member: true });
    } else if (action === "leave") {
      // Remove membership
      const deleted = await db
        .delete(communityMemberships)
        .where(
          and(
            eq(communityMemberships.community_id, communityId),
            eq(communityMemberships.user_id, user.id)
          )
        );

      if (deleted.success) {
        // Update member count
        await db
          .update(communities)
          .set({ member_count: sql`member_count - 1` })
          .where(eq(communities.id, communityId));

        return c.json({ message: "Left successfully", is_member: false });
      } else {
        return c.json({ error: "Not a member" }, 400);
      }
    } else {
      return c.json({ error: "Invalid action" }, 400);
    }
  } catch (error) {
    return c.json({ error: "Failed to update membership" }, 500);
  }
});

communitiesRoute.patch("/:name", authMiddleware, async (c) => {
  try {
    const name = c.req.param("name");
    const user = c.get("user");
    const db = drizzle(c.env.DB);

    if (!user) {
      return c.json({ error: "User not authenticated" }, 401);
    }

    const { display_name, description, is_private }: Partial<Community> =
      await c.req.json();

    const community = await db
      .select()
      .from(communities)
      .where(eq(communities.name, name))
      .limit(1);

    if (!community.length) {
      return c.json({ error: "Community not found" }, 404);
    }

    const membership = await db
      .select()
      .from(communityMemberships)
      .where(
        and(
          eq(communityMemberships.user_id, user.id),
          eq(communityMemberships.community_id, community[0].id)
        )
      )
      .limit(1);

    if (!membership.length || membership[0].role !== "admin") {
      return c.json({ error: "No permission to edit this community" }, 403);
    }

    await db
      .update(communities)
      .set({ display_name, description, is_private })
      .where(eq(communities.name, name));

    return c.json({
      message: `Community '${name}' updated successfully.`,
      data: { name, display_name, description, is_private },
    });
  } catch (err) {
    console.error("Failed to update community:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export { communitiesRoute };
