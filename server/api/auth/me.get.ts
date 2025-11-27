import { defineEventHandler, createError } from 'h3'
import { requireAuth } from '~/server/middleware/auth'
import { findUserById, getUserWithoutPassword } from '~/server/db/users'

export default defineEventHandler(async (event) => {
  const payload = requireAuth(event)
  const user = await findUserById(payload.sub)

  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  return {
    user: getUserWithoutPassword(user),
  }
})
