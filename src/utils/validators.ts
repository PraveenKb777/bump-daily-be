import type { CreateProfileRequest, UpdateRoleRequest } from '../types'
import { ROLES } from '../constants/roles'

export function validateProfileData(data: any): CreateProfileRequest {
  const { firstName, lastName, avatar } = data

  if (!firstName || typeof firstName !== 'string') {
    throw new Error('First name is required and must be a string')
  }

//   if (!lastName || typeof lastName !== 'string') {
//     throw new Error('Last name is required and must be a string')
//   }

  if (avatar && typeof avatar !== 'string') {
    throw new Error('Avatar must be a string')
  }

  return { firstName, lastName, avatar }
}

export function validateRoleData(data: any): UpdateRoleRequest {
  const { role } = data

  if (!role || !Object.values(ROLES).includes(role)) {
    throw new Error(`Invalid role. Must be one of: ${Object.values(ROLES).join(', ')}`)
  }

  return { role }
}