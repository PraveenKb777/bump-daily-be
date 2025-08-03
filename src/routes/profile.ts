import { Hono } from "hono";
import type { Bindings, Variables } from "../types";
import { authMiddleware } from "../middleware";
import { createDatabase, profiles } from "../db";
import { ProfileService, UserService } from "../services";
import { validateProfileData } from "../utils";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { isValidUsername } from "../utils/checkValidUserName";

const profile = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Get current user profile
profile.get("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = createDatabase(c.env.DB);
    const profileService = new ProfileService(db);

    const profileData = await profileService.getProfile(user.id);

    if (!profileData) {
      return c.json({ error: "Profile not found" }, 404);
    }

    console.log("profile", profileData);
    return c.json({ profile: profileData });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

profile.get("/username", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const db = drizzle(c.env.DB);
    const [userOnDb] = await db
      .select({ userName: profiles.username })
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (userOnDb.userName === null) {
      return c.json({ error: "Username is not there kindly set a one" }, 404);
    }

    return c.json({ username: userOnDb.userName }, 200);
  } catch (error) {
    console.log(error);
    return c.json({ error: "Can't fetch username" }, 500);
  }
});
profile.get("/check-username", authMiddleware, async (c) => {
  const db = drizzle(c.env.DB);
  const username = c.req.query("username");

  if (!isValidUsername(username || "")) {
    return c.json({ error: "Invalid username format" }, 400);
  }

  if (!username || typeof username !== "string") {
    return c.json({ error: "Username is required" }, 400);
  }

  const result = await db
    .select({ id: profiles.id })
    .from(profiles)
    .where(eq(profiles.username, username))
    .get();

  return c.json({ available: !result });
});

profile.post("/username", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const { username } = await c.req.json();
    if (!isValidUsername(username || "")) {
      return c.json({ error: "Invalid username format" }, 400);
    }
    const db = drizzle(c.env.DB);

    const [userOnDb] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id));

    if (userOnDb.username) {
      return c.json({ error: "Cannot change existing user name" }, 400);
    }

    await db
      .update(profiles)
      .set({ username })
      .where(eq(profiles.userId, user.id));

    return c.json({ ...userOnDb, username }, 200);
  } catch (error) {
    console.log(error);

    return c.json(
      { error: "User Name not created, Something went wrong" },
      500
    );
  }
});

// Create or update user profile
profile.post("/", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();
    const db = createDatabase(c.env.DB);

    const profileService = new ProfileService(db);
    const userService = new UserService(db);

    // Validate input
    const profileData = validateProfileData(body);

    // Ensure the user exists in the users table
    await userService.ensureUserExists(user);

    // Create or update profile
    const updatedProfile = await profileService.createOrUpdateProfile(
      user,
      profileData
    );

    return c.json({ profile: updatedProfile });
  } catch (error) {
    console.error("Failed to save profile:", error);
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400);
    }
    return c.json({ error: "Failed to save profile" }, 500);
  }
});

export { profile };
