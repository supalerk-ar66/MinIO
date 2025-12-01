import { defineEventHandler, readBody, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireRole } from '~/server/middleware/auth'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  const body = await readBody(event)
  const name = String(body?.name || '').toLowerCase()

  if (!BUCKET_NAME_REGEX.test(name)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  await minioClient.makeBucket(name)
  return { ok: true }
})
