export type CreateProfileRequest = {
  firstName: string
  lastName: string
  avatar?: string
}

export type UpdateProfileRequest = Partial<CreateProfileRequest>

export type UserWithProfile = {
  id: string
  email: string
  createdAt: string
  firstName?: string
  lastName?: string
  role?: string
}

export type ProfileResponse = {
  profileId: string
  userId: string
  firstName: string
  lastName: string
  avatar?: string
  createdAt: string
  updatedAt: string
  email: string
}

export type UpdateRoleRequest = {
  role: 'user' | 'admin' | 'moderator'
}