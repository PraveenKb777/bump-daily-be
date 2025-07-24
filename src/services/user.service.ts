import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { users, userRoles } from '../db'
import type { AuthenticatedUser } from '../types'
import { ROLES } from '../constants/roles'

export class UserService {
  constructor(private db: Database) {}

  async initializeUser(user: AuthenticatedUser): Promise<void> {
    // Check if user already exists
    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .get()

      console.log("user initial",existingUser)

    if (!existingUser) {
      // Create new user
      console.log("called here")
      await this.db
        .insert(users)
        .values({
          id: user.id,
          email: user.email,
          createdAt: new Date().toISOString()
        })

      // Assign default role
      await this.db
        .insert(userRoles)
        .values({
          userId: user.id,
          role: ROLES.USER
        })
    }
  }

  async ensureUserExists(user: AuthenticatedUser): Promise<void> {
    const existingUser = await this.db
      .select()
      .from(users)
      .where(eq(users.id, user.id))
      .get()
    console.log("existing user" , existingUser);
    
    if (!existingUser) {
      this.initializeUser(user)
    } else{
        
    }
  }
}