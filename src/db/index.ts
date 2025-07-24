import { drizzle } from 'drizzle-orm/d1'
import type { DrizzleD1Database } from 'drizzle-orm/d1'

export function createDatabase(d1: D1Database): DrizzleD1Database {
  return drizzle(d1)
}

export type Database = DrizzleD1Database

// Re-export schema
export * from './schema'