import { defineEventHandler } from 'h3'
import { requireAuth } from '~/server/middleware/auth'

export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)
  return {
    user: auth.user,
  }
})
