// server/api/bucket/index.post.ts
import { defineEventHandler, readBody, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireRole } from '~/server/middleware/auth'

export default defineEventHandler(async (event) => {
  // Only admin can create buckets
  requireRole(event, 'admin')

  const { bucketName } = await readBody(event)

  if (!bucketName) {
    throw createError({ statusCode: 400, message: 'Missing bucket name' })
  }

  try {
    await minioClient.makeBucket(bucketName, 'us-east-1')
    return { ok: true, message: `Bucket ${bucketName} created` }
  } catch (err: any) {
    throw createError({ statusCode: 400, message: err.message })
  }
})
