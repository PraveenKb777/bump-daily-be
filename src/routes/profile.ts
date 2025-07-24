import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware'
import { createDatabase } from '../db'
import { ProfileService, UserService } from '../services'
import { validateProfileData } from '../utils'

const profile = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Get current user profile
profile.get('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const db = createDatabase(c.env.DB)
    const profileService = new ProfileService(db)

    const profileData = await profileService.getProfile(user.id)

    if (!profileData) {
      return c.json({ error: 'Profile not found' }, 404)
    }

    console.log("profile", profileData)
    return c.json({ profile: profileData })
  } catch (error) {
    console.error('Failed to fetch profile:', error)
    return c.json({ error: 'Failed to fetch profile' }, 500)
  }
})

// Create or update user profile
profile.post('/', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json()
    const db = createDatabase(c.env.DB)
    
    const profileService = new ProfileService(db)
    const userService = new UserService(db)

    // Validate input
    const profileData = validateProfileData(body)

    // Ensure the user exists in the users table
    await userService.ensureUserExists(user)

    // Create or update profile
    const updatedProfile = await profileService.createOrUpdateProfile(user, profileData)

    return c.json({ profile: updatedProfile })
  } catch (error) {
    console.error('Failed to save profile:', error)
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400)
    }
    return c.json({ error: 'Failed to save profile' }, 500)
  }
})

export { profile }