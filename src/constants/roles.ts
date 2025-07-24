export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  MODERATOR: 'moderator',
} as const

export type Role = typeof ROLES[keyof typeof ROLES]

export const ADMIN_ROLES: Role[] = [ROLES.ADMIN]
export const MODERATOR_ROLES: Role[] = [ROLES.ADMIN, ROLES.MODERATOR]