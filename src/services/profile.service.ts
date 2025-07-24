import { eq } from 'drizzle-orm'
import type { Database } from '../db'
import { profiles, users } from '../db'
import type { CreateProfileRequest, ProfileResponse, AuthenticatedUser } from '../types'

export class ProfileService {
  constructor(private db: Database) {}

  async getProfile(userId: string): Promise<ProfileResponse | null > {
    const profile = await this.db.select({
      profileId: profiles.id,
      userId: profiles.userId,
      firstName: profiles.firstName,
      lastName: profiles.lastName,
      avatar: profiles.avatar,
      createdAt: profiles.createdAt,
      updatedAt: profiles.updatedAt,
      email: users.email, 
    })
    .from(profiles)
    .innerJoin(users, eq(profiles.userId, users.id))
    .where(eq(profiles.userId, userId)) 
    .get()

    return profile as unknown as ProfileResponse  || null
  }

  async createOrUpdateProfile(
    user: AuthenticatedUser, 
    profileData: CreateProfileRequest
  ) {
    const { firstName, lastName, avatar } = profileData

    const existingProfile = await this.db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, user.id))
      .get()

    if (existingProfile) {
      return await this.db
        .update(profiles)
        .set({
          firstName,
          lastName,
          avatar,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(profiles.userId, user.id))
        .returning()
        .get()
    } else {
      return await this.db
        .insert(profiles)
        .values({
          userId: user.id,
          firstName,
          lastName,
          avatar,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
        .returning()
        .get()
    }
  }
}