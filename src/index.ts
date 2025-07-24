import { Hono } from 'hono'
import type { Bindings, Variables } from './types'
import { corsMiddleware } from './middleware'
import { setupRoutes } from './routes'

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>()

// Apply global middleware
app.use('*', corsMiddleware)

// Setup all routes
setupRoutes(app)

export default app