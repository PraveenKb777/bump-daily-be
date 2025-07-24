import type { Context, Next } from 'hono'
import type { Bindings, Variables } from '../types'
import type { Role } from '../constants/roles'

type RBACContext = Context<{ Bindings: Bindings; Variables: Variables }>

export const requireRole = (allowedRoles: Role[]) => {
  return async (c: RBACContext, next: Next) => {
    const user = c.get('user')
    
    if (!allowedRoles.includes(user.role as Role)) {
      return c.json({ error: 'Insufficient permissions' }, 403)
    }
    
    await next()
  }
}