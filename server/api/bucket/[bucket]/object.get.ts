import { defineEventHandler, getRouterParam, getQuery, createError, sendStream } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { handleMinioBucketError } from '~/server/utils/minioErrors'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// GET /api/bucket/:bucket/object?key=... — ดาวน์โหลดไฟล์เดี่ยว (ส่ง stream)
export default defineEventHandler(async (event) => {
  requireAuth(event)

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) throw createError({ statusCode: 400, message: 'Missing bucket' })
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  const { key } = getQuery(event)
  if (!key || typeof key !== 'string') {
    throw createError({ statusCode: 400, message: 'Missing key' })
  }

  const decoded = decodeURIComponent(key)
  try {
    const exists = await minioClient.bucketExists(bucket)
    if (!exists) {
      throw createError({ statusCode: 404, message: `Bucket "${bucket}" not found` })
    }
    const stream = await minioClient.getObject(bucket, decoded)
    return sendStream(event, stream)
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Download failed')
  }
})
