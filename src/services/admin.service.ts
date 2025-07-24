import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { users, profiles, userRoles } from '../db'
import type { UserWithProfile, UpdateRoleRequest } from '../types'
import type { Role } from '../constants/roles'

export class AdminService {
  constructor(private db: Database) {}

  async getAllUsers(): Promise<UserWithProfile[]> {
    let allUsers =  await this.db
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
        firstName: profiles.firstName,
        lastName: profiles.lastName,
        role: userRoles.role
      })
      .from(users)
      .leftJoin(profiles, eq(users.id, profiles.userId))
      .leftJoin(userRoles, eq(users.id, userRoles.userId))
      .all()


      return allUsers as UserWithProfile[]
  }

  async updateUserRole(userId: string, role: Role): Promise<void> {
    // Check if user role exists
    const existingRole = await this.db
      .select()
      .from(userRoles)
      .where(eq(userRoles.userId, userId))
      .get()

    if (existingRole) {
      await this.db
        .update(userRoles)
        .set({ role })
        .where(eq(userRoles.userId, userId))
    } else {
      await this.db
        .insert(userRoles)
        .values({ userId, role })
    }
  }
}