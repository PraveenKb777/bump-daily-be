import { eq } from 'drizzle-orm'
import type { Context, Next } from 'hono'
import type { Bindings, Variables, AuthenticatedUser } from '../types'
import { createDatabase, userRoles, type User } from '../db'
import { verifySupabaseToken, extractTokenFromHeader } from '../utils'

type AuthContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const authMiddleware = async (c: AuthContext, next: Next) => {
  try {
    const authHeader = c.req.header('Authorization')
    const token = extractTokenFromHeader(authHeader)

    console.log(authHeader)

    const { user_metadata, sub } = await verifySupabaseToken(
      token, 
      c.env.SUPABASE_JWT_SECRET
    )

    if (!user_metadata) {
      return c.json({ error: 'Invalid token' }, 401)
    }

    const userData: User = {
      email: user_metadata.email,
      id: sub,
      createdAt: new Date().toISOString()
    }

    const db = createDatabase(c.env.DB)
    const userRole = await db
      .select({ role: userRoles.role })
      .from(userRoles)
      .where(eq(userRoles.userId, userData.id))
      .get()

    const authenticatedUser: AuthenticatedUser = {
      id: userData.id,
      email: userData.email,
      role: userRole?.role || 'user'
    }

    c.set('user', authenticatedUser)
    await next()
  } catch (error) {
    console.error('Authentication failed:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
}