import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { generateId, now } from "../utils";
import { drizzle } from "drizzle-orm/d1";
import { tempFiles } from "../db";
import { eq } from "drizzle-orm";

const files = new Hono<{ Bindings: Bindings; Variables: Variables }>();

files.post("/upload", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const contentType = c.req.header("Content-Type") || "";
    console.log(c.req.header("Accept-Encoding"), contentType);

    if (!contentType.includes("multipart/form-data")) {
      console.log(contentType);
      return c.json({ error: "Content-Type header is not provided" }, 400);
    }
    const formData = await c.req.formData();
    const file = formData.get("file") as File;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "Invalid file" }, 400);
    }

    if (file.size > 2 * 1024 * 1024) {
      return c.json({ error: "File exceeds 2MB limit" }, 400);
    }

    const ext = file.name.split(".").pop() || "bin";
    const key = `${generateId()}.${ext}`;

    const data = await c.env.BUCKET.put(key, await file.arrayBuffer(), {
      httpMetadata: {
        contentType: file.type,
      },
    });

    await db.insert(tempFiles).values({
      id: key,
      createdAt: now(),
    });

    console.log(data);

    return c.json({ url: `${c.env.HOST}/files/${key}` });
  } catch (error) {
    console.log(error);
    c.json({ error: "Something went wrong" });
  }
});
files.put("/:key/used", async (c) => {
  try {
    const db = drizzle(c.env.DB);
    const key = c.req.param("key");

    if (!key) {
      return c.json({ error: "Missing file key" }, 400);
    }

    const [file] = await db
      .select()
      .from(tempFiles)
      .where(eq(tempFiles.id, key));

    if (!file) {
      return c.json({ error: "File not found in the temp file list" }, 404);
    }

    const deletedResult = await db
      .delete(tempFiles)
      .where(eq(tempFiles.id, key))
      .returning();

    if (deletedResult.length) {
      return c.json({ error: "Failed to delete file from temp storage" }, 500);
    }

    return c.json({ message: "File saved permanently" }, 200);
  } catch (error) {
    console.error("Error in /:key/used:", error);
    return c.json({ error: "Internal server error" }, 500);
  }
});

files.get("/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.BUCKET.get(key);
  if (!object) return c.notFound();

  return new Response(object.body, {
    headers: {
      "Content-Type":
        object.httpMetadata?.contentType || "application/octet-stream",
    },
  });
});

export { files };
