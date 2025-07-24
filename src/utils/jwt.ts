import { verify } from 'hono/jwt'
import type { SupabaseJWTPayload } from '../types'

export async function verifySupabaseToken(
  token: string, 
  secret: string
): Promise<SupabaseJWTPayload> {
  try {
    const payload = await verify(token, secret) as SupabaseJWTPayload
    return payload
  } catch (error) {
    throw new Error('Invalid JWT token')
  }
}

export function extractTokenFromHeader(authHeader: string | undefined): string {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid authorization header')
  }
  return authHeader.substring(7)
}