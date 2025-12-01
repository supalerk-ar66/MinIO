import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { prisma } from '~/server/utils/prisma'
import { handleMinioBucketError } from '~/server/utils/minioErrors'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// DELETE /api/bucket/:bucket/folder?prefix=path/ — ลบโฟลเดอร์ (และไฟล์ทั้งหมดภายใน)
// User permissions: allow delete only if every object under prefix belongs to current user (FileMeta.userId)
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) throw createError({ statusCode: 400, message: 'Missing bucket' })
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  const q = getQuery(event)
  if (!q.prefix) throw createError({ statusCode: 400, message: 'Missing prefix' })
  const prefix = decodeURIComponent(String(q.prefix))
  if (!prefix.endsWith('/')) {
    throw createError({ statusCode: 400, message: 'Prefix must end with "/"' })
  }
  if (prefix.includes('..')) {
    throw createError({ statusCode: 400, message: 'Invalid prefix' })
  }

  try {
    const exists = await minioClient.bucketExists(bucket)
    if (!exists) {
      throw createError({ statusCode: 404, message: `Bucket "${bucket}" not found` })
    }

    const keys = await listObjectsWithPrefix(bucket, prefix)
    if (!keys.length) {
      return { ok: true, deleted: 0 }
    }

    if (auth.user.role !== 'admin') {
      const metas = await prisma.fileMeta.findMany({
        where: {
          bucket,
          objectKey: { in: keys },
        },
      })

      // Allow delete if file is owned by current user or has no owner (legacy/null records)
      const allowed = new Set(
        metas
          .filter((m) => !m.userId || m.userId === auth.user.id)
          .map((m) => m.objectKey)
      )

      for (const key of keys) {
        // If there is no meta entry at all, allow deletion (no ownership recorded)
        const hasMeta = metas.some((m) => m.objectKey === key)
        if (!hasMeta) continue

        if (!allowed.has(key)) {
          throw createError({
            statusCode: 403,
            message: 'You cannot delete files owned by other users',
          })
        }
      }
    }

    for (const key of keys) {
      await minioClient.removeObject(bucket, key)
    }

    await prisma.fileMeta.deleteMany({
      where: {
        bucket,
        objectKey: { in: keys },
      },
    })

    return { ok: true, deleted: keys.length }
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Delete folder failed')
  }
})

function listObjectsWithPrefix(bucket: string, prefix: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const keys: string[] = []
    const stream = minioClient.listObjects(bucket, prefix, true)
    stream.on('data', (obj) => {
      if (obj?.name) {
        keys.push(obj.name)
      }
    })
    stream.on('end', () => resolve(keys))
    stream.on('error', (err) => reject(err))
  })
}
