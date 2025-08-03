import { verifySupabaseToken, extractTokenFromHeader } from "../utils";
import { createDatabase, userRoles, type User } from "../db";
import type { Context, Next } from "hono";
import type { AuthenticatedUser, Variables, Bindings } from "../types";
import { eq } from "drizzle-orm";

type AuthContext = Context<{ Bindings: Bindings; Variables: Variables }>;

export const optionalAuthMiddleware = async (c: AuthContext, next: Next) => {
  const authHeader = c.req.header("Authorization");
  let token;
  try {
    token = extractTokenFromHeader(authHeader);
  } catch (error) {
    console.log("Token error proceeding with no auth user");
  }
  console.log("token from optional auth", token, authHeader);
  if (!token) {
    return next();
  }

  try {
    const { user_metadata, sub } = await verifySupabaseToken(
      token,
      c.env.SUPABASE_JWT_SECRET
    );

    if (!user_metadata) {
      return next();
    }

    const userData: User = {
      email: user_metadata.email,
      id: sub,
      createdAt: new Date().toISOString(),
    };

    const db = createDatabase(c.env.DB);
    const userRole = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userData.id))
      .get();

    const authenticatedUser: AuthenticatedUser = {
      id: userData.id,
      email: userData.email,
      role: userRole?.role || "user",
    };

    c.set("user", authenticatedUser);
  } catch (error) {
    console.warn("Optional auth failed, skipping user:", error);
    // Don't throw or block — treat as unauthenticated
  }

  await next();
};
