import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { auth } from './auth'
import { profile } from './profile'
import { admin } from './admin'

export function setupRoutes(app: Hono<{ Bindings: Bindings; Variables: Variables }>) {
  // Health check
  app.get('/', (c) => {
    return c.json({ message: 'User data API is running' })
  })

  // Mount route groups
  app.route('/api', auth)
  app.route('/api/profile', profile)
  app.route('/api/admin', admin)
}

export { auth, profile, admin }