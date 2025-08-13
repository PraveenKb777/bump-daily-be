import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { authMiddleware } from "../middleware";
import { NewMoodTracker, moodTracker } from "../db";
import { generateId, now } from "../utils";
import { HttpError } from "../utils/HttpError";
import { and, desc, eq } from "drizzle-orm";

const ALLOWED_MOODS = ["happy", "content", "neutral", "sad", "angry"] as const;
const ALLOWED_FACTORS = [
  "partner",
  "body_changes",
  "hormonal",
  "sleep",
] as const;

const moodRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Create mood record
moodRoute.post("/", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const { mood, contributing_factors, notes } = await c.req.json();

    if (!mood || !ALLOWED_MOODS.includes(mood)) {
      throw new HttpError(
        400,
        `Mood is required and must be one of: ${ALLOWED_MOODS.join(", ")}`
      );
    }

    let factors: string | null = null;
    if (Array.isArray(contributing_factors)) {
      const invalid = contributing_factors.filter(
        (f) => !ALLOWED_FACTORS.includes(f)
      );
      if (invalid.length > 0) {
        throw new HttpError(
          400,
          `Invalid contributing factors: ${invalid.join(", ")}`
        );
      }
      factors = contributing_factors.join(",");
    }

    const moodData: NewMoodTracker = {
      id: generateId(),
      user_id: user.id,
      mood,
      contributing_factors: factors,
      notes: notes ?? null,
      created_at: now(),
    };

    await db.insert(moodTracker).values(moodData);

    return c.json({ message: "Mood data added successfully", moodData }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in POST /mood:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get all mood records for current user
moodRoute.get("/", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const records = await db
      .select()
      .from(moodTracker)
      .where(eq(moodTracker.user_id, user.id))
      .orderBy(desc(moodTracker.created_at));

    return c.json(records, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in GET /mood:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
// Update mood record
moodRoute.patch("/:id", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const id = c.req.param("id");
    const { mood, contributing_factors, notes } = await c.req.json();

    if (mood && !ALLOWED_MOODS.includes(mood)) {
      throw new HttpError(
        400,
        `Mood must be one of: ${ALLOWED_MOODS.join(", ")}`
      );
    }

    let factors: string | null = null;
    if (Array.isArray(contributing_factors)) {
      const invalid = contributing_factors.filter(
        (f) => !ALLOWED_FACTORS.includes(f)
      );
      if (invalid.length > 0) {
        throw new HttpError(
          400,
          `Invalid contributing factors: ${invalid.join(", ")}`
        );
      }
      factors = contributing_factors.join(",");
    }

    const existing = await db
      .select()
      .from(moodTracker)
      .where(and(eq(moodTracker.id, id), eq(moodTracker.user_id, user.id)))
      .limit(1);

    if (existing.length === 0)
      throw new HttpError(404, "Mood record not found");

    const updatedRecord = {
      mood: mood ?? existing[0].mood,
      contributing_factors: factors ?? existing[0].contributing_factors,
      notes: notes ?? existing[0].notes,
    };

    await db
      .update(moodTracker)
      .set(updatedRecord)
      .where(and(eq(moodTracker.id, id), eq(moodTracker.user_id, user.id)));

    return c.json({ message: "Mood record updated", updatedRecord }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in PATCH /mood/:id:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Delete mood record
moodRoute.delete("/:id", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const id = c.req.param("id");

    const deleted = await db
      .delete(moodTracker)
      .where(and(eq(moodTracker.id, id), eq(moodTracker.user_id, user.id)))
      .returning();

    if (deleted.length === 0) throw new HttpError(404, "Mood record not found");

    return c.json({ message: "Mood record deleted" }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in DELETE /mood/:id:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default moodRoute;
