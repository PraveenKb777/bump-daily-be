import { Hono } from "hono";
import { Bindings, Variables } from "../types";
import { generateId } from "../utils";

const files = new Hono<{ Bindings: Bindings; Variables: Variables }>();

files.post("/upload", async (c) => {
  const contentType = c.req.header("Content-Type") || "";
  console.log(c.req.header("Accept-Encoding"), contentType);

  if (!contentType.includes("multipart/form-data")) {
    console.log(contentType);
    return c.text("Bad Request: Content-Type must be multipart/form-data", 400);
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

  console.log(data);

  return c.json({ url: `http://localhost:8787/file/${key}` });
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
