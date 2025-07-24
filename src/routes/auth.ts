import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware } from '../middleware'
import { createDatabase } from '../db'
import { UserService } from '../services'

const auth = new Hono<{ Bindings: Bindings; Variables: Variables }>()

auth.post('/init-user', authMiddleware, async (c) => {
  try {
    const user = c.get('user')
    const db = createDatabase(c.env.DB)
    const userService = new UserService(db)

    await userService.initializeUser(user)

    return c.json({ message: 'User initialized successfully' })
  } catch (error) {
    console.error('Failed to initialize user:', error)
    return c.json({ error: 'Failed to initialize user' }, 500)
  }
})

export { auth }