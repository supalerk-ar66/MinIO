import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { prisma } from '~/server/utils/prisma'
import { handleMinioBucketError } from '~/server/utils/minioErrors'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// DELETE /api/bucket/:bucket/key?key=... — ลบไฟล์เดี่ยวภายใน bucket
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) throw createError({ statusCode: 400, message: 'Missing bucket' })
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  const q = getQuery(event)
  if (!q.key) throw createError({ statusCode: 400, message: 'Missing key' })

  const key = decodeURIComponent(String(q.key))

  try {
    const exists = await minioClient.bucketExists(bucket)
    if (!exists) {
      throw createError({ statusCode: 404, message: `Bucket "${bucket}" not found` })
    }

    const fileMeta = await prisma.fileMeta.findUnique({
      where: {
        bucket_objectKey: {
          bucket,
          objectKey: key,
        },
      },
    })

    if (auth.user.role !== 'admin') {
      if (!fileMeta || fileMeta.userId !== auth.user.id) {
        throw createError({ statusCode: 403, message: 'You cannot delete this file' })
      }
    }

    await minioClient.removeObject(bucket, key)
    await prisma.fileMeta.deleteMany({
      where: {
        bucket,
        objectKey: key,
      },
    })
    return { ok: true }
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Delete failed')
  }
})
