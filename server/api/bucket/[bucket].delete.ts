// server/api/bucket/[bucket].delete.ts
import { defineEventHandler, getRouterParam, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireRole } from '~/server/middleware/auth'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// DELETE /api/bucket/:bucket — ลบทั้ง bucket (เฉพาะ admin) โดย purge ไฟล์ก่อน
export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) {
    throw createError({ statusCode: 400, statusMessage: 'Missing bucket' })
  }
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid bucket name' })
  }

  try {
    // MinIO requires an empty bucket before removal, so purge objects first
    const objectKeys = await listAllObjects(bucket)
    if (objectKeys.length) {
      await Promise.all(
        objectKeys.map((key) =>
          minioClient.removeObject(bucket, key).catch((err) => {
            console.error(`removeObject failed for ${key}`, err)
            throw err
          })
        )
      )
    }

    await minioClient.removeBucket(bucket)
    return { success: true }
  } catch (err: any) {
    console.error('removeBucket error', err)
    throw createError({
      statusCode: 500,
      statusMessage: 'Delete bucket failed',
      data: { message: err?.message || 'Unknown error' },
    })
  }
})

function listAllObjects(bucket: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const keys: string[] = []
    const stream = minioClient.listObjects(bucket, '', true)
    stream.on('data', (obj) => {
      if (obj?.name) {
        keys.push(obj.name)
      }
    })
    stream.on('end', () => resolve(keys))
    stream.on('error', (err) => reject(err))
  })
}
