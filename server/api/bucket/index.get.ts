import { defineEventHandler, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireRole } from '~/server/middleware/auth'

// GET /api/bucket — admin-only bucket list
// Return shape must stay compatible with frontend (array of bucket names)
export default defineEventHandler(async (event) => {
  await requireRole(event, 'admin')

  try {
    const buckets = await minioClient.listBuckets()
    return { buckets: buckets.map((b) => b.name) }
  } catch (err: any) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Bad Gateway',
      data: {
        message: err?.message || 'Failed to reach MinIO',
      },
    })
  }
})
