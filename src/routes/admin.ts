import { Hono } from 'hono'
import type { Bindings, Variables } from '../types'
import { authMiddleware, requireRole } from '../middleware'
import { createDatabase } from '../db'
import { AdminService } from '../services'
import { validateRoleData } from '../utils'
import { ADMIN_ROLES } from '../constants/roles'

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Get all users (admin only)
admin.get('/users', authMiddleware, requireRole(ADMIN_ROLES), async (c) => {
  try {
    const db = createDatabase(c.env.DB)
    const adminService = new AdminService(db)
    
    const allUsers = await adminService.getAllUsers()

    return c.json({ users: allUsers })
  } catch (error) {
    console.error('Failed to fetch users:', error)
    return c.json({ error: 'Failed to fetch users' }, 500)
  }
})

// Update user role (admin only)
admin.put('/users/:userId/role', authMiddleware, requireRole(ADMIN_ROLES), async (c) => {
  try {
    const userId = c.req.param('userId')
    const body = await c.req.json()
    const db = createDatabase(c.env.DB)
    
    const adminService = new AdminService(db)

    // Validate input
    const { role } = validateRoleData(body)

    await adminService.updateUserRole(userId, role)

    return c.json({ message: 'Role updated successfully' })
  } catch (error) {
    console.error('Failed to update role:', error)
    if (error instanceof Error) {
      return c.json({ error: error.message }, 400)
    }
    return c.json({ error: 'Failed to update role' }, 500)
  }
})

export { admin }