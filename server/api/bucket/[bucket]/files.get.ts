import { defineEventHandler, getRouterParam, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { handleMinioBucketError } from '~/server/utils/minioErrors'
import { prisma } from '~/server/utils/prisma'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// GET /api/bucket/:bucket/files — รายการไฟล์ภายใน bucket (auth ทั้ง admin/user)
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) throw createError({ statusCode: 400, message: 'Missing bucket' })
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  try {
    const exists = await minioClient.bucketExists(bucket).catch((err: any) => {
      if (err?.code === 'NoSuchBucket') return false
      throw err
    })

    if (!exists) {
      throw createError({ statusCode: 404, message: `Bucket "${bucket}" not found` })
    }

    const items = await new Promise<any[]>((resolve, reject) => {
      const collected: any[] = []
      const stream = minioClient.listObjects(bucket, '', true)

      stream.on('data', (obj) => {
        if (!obj?.name) return
        collected.push({
          key: obj.name,
          size: obj.size,
          mtime: obj.lastModified,
          url: `/api/bucket/${bucket}/object?key=${encodeURIComponent(obj.name)}`,
        })
      })

      stream.on('end', () => resolve(collected))
      stream.on('error', (err) => reject(err))
    })

    const keys = items.map((item) => item.key)
    const metadata = keys.length
      ? await prisma.fileMeta.findMany({
          where: {
            bucket,
            objectKey: { in: keys },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                role: true,
              },
            },
          },
        })
      : []

    const metaMap = new Map(metadata.map((meta) => [meta.objectKey, meta]))
    const enriched = items.map((item) => {
      const meta = metaMap.get(item.key)
      const ownerId = meta?.userId ?? null
      const ownerName = meta?.user?.username ?? null
      const ownerRole = meta?.user?.role ?? null
      const isOwner = !!ownerId && ownerId === auth.user.id
      const canModify = auth.user.role === 'admin' || isOwner
      return {
        ...item,
        ownerId,
        ownerName,
        ownerRole,
        isOwner,
        canDelete: canModify,
        canShare: canModify,
      }
    })

    return { items: enriched }
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Failed to list files')
  }
})
