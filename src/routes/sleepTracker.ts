import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { drizzle } from "drizzle-orm/d1";
import { authMiddleware } from "../middleware";
import { NewSleepTracker, sleepTracker } from "../db";
import { generateId, now } from "../utils";
import { isValidISODateString } from "../utils/isValidISODateString";
import { calculateSleepDuration } from "../utils/calculateSleepDuration";
import { HttpError } from "../utils/HttpError";
import { and, desc, eq } from "drizzle-orm";

const sleepRoute = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Create sleep record
sleepRoute.post("/", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const { bedtime, wakeup_time, notes } = await c.req.json();

    if (!bedtime || !wakeup_time) {
      throw new HttpError(400, "Bedtime and wakeup time are required");
    }
    if (!isValidISODateString(bedtime)) {
      throw new HttpError(400, "Bedtime must be a valid ISO 8601 string");
    }
    if (!isValidISODateString(wakeup_time)) {
      throw new HttpError(400, "Wakeup time must be a valid ISO 8601 string");
    }

    const sleep_duration_minutes = calculateSleepDuration(bedtime, wakeup_time);

    const sleepData: NewSleepTracker = {
      id: generateId(),
      user_id: user.id,
      bedtime,
      wakeup_time,
      sleep_duration_minutes,
      notes: notes ?? null,
      created_at: now(),
    };

    await db.insert(sleepTracker).values(sleepData);

    return c.json({ message: "Sleep data added successfully", sleepData }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in POST /sleep:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Get all sleep records for current user
sleepRoute.get("/", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const records = await db
      .select()
      .from(sleepTracker)
      .where(eq(sleepTracker.user_id, user.id))
      .orderBy(desc(sleepTracker.created_at));

    return c.json(records, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in GET /sleep:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});
// Update sleep record
sleepRoute.patch("/:id", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const id = c.req.param("id");
    const { bedtime, wakeup_time, notes } = await c.req.json();

    // Validate if bedtime/wakeup_time provided
    if (bedtime && !isValidISODateString(bedtime)) {
      throw new HttpError(400, "Bedtime must be a valid ISO 8601 string");
    }
    if (wakeup_time && !isValidISODateString(wakeup_time)) {
      throw new HttpError(400, "Wakeup time must be a valid ISO 8601 string");
    }

    // Get existing record
    const existing = await db
      .select()
      .from(sleepTracker)
      .where(and(eq(sleepTracker.user_id, user.id), eq(sleepTracker.id, id)))
      .limit(1);

    if (existing.length === 0)
      throw new HttpError(404, "Sleep record not found");

    const updatedRecord = {
      bedtime: bedtime ?? existing[0].bedtime,
      wakeup_time: wakeup_time ?? existing[0].wakeup_time,
      notes: notes ?? existing[0].notes,
      sleep_duration_minutes: calculateSleepDuration(
        bedtime ?? existing[0].bedtime,
        wakeup_time ?? existing[0].wakeup_time
      ),
    };

    await db
      .update(sleepTracker)
      .set(updatedRecord)
      .where(and(eq(sleepTracker.user_id, user.id), eq(sleepTracker.id, id)));

    return c.json({ message: "Sleep record updated", updatedRecord }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in PATCH /sleep/:id:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

// Delete sleep record
sleepRoute.delete("/:id", authMiddleware, async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const user = c.get("user");
    if (!user) throw new HttpError(404, "User not found");

    const id = c.req.param("id");

    const deleted = await db
      .delete(sleepTracker)
      .where(and(eq(sleepTracker.user_id, user.id), eq(sleepTracker.id, id)))
      .returning();

    if (deleted.length === 0)
      throw new HttpError(404, "Sleep record not found");

    return c.json({ message: "Sleep record deleted" }, 200);
  } catch (err) {
    if (err instanceof HttpError) {
      return c.json({ error: err.message }, err.status);
    }
    console.error("Error in DELETE /sleep/:id:", err);
    return c.json({ error: "Internal server error" }, 500);
  }
});

export default sleepRoute;
