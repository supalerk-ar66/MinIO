import { defineEventHandler, getRouterParam, readMultipartFormData, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { prisma } from '~/server/utils/prisma'
import { handleMinioBucketError } from '~/server/utils/minioErrors'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// POST /api/bucket/:bucket/files — อัปโหลดไฟล์/โฟลเดอร์เข้า bucket
export default defineEventHandler(async (event) => {
  const auth = requireAuth(event)

  const bucket = getRouterParam(event, 'bucket')
  if (!bucket) throw createError({ statusCode: 400, message: 'Missing bucket' })
  if (!BUCKET_NAME_REGEX.test(bucket)) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  try {
    const exists = await minioClient.bucketExists(bucket)
    if (!exists) {
      throw createError({ statusCode: 404, message: `Bucket "${bucket}" not found` })
    }

    const files = await readMultipartFormData(event)
    if (!files?.length) {
      throw createError({ statusCode: 400, message: 'No files uploaded' })
    }

    for (const file of files) {
      const relativePath =
        file.filename && file.filename.includes('/')
          ? file.filename // e.g. folder1/folder2/img.png
          : file.filename || 'file'

      await minioClient.putObject(bucket, relativePath, file.data)

      await prisma.fileMeta.upsert({
        where: {
          bucket_objectKey: {
            bucket,
            objectKey: relativePath,
          },
        },
        update: {
          userId: auth.sub,
        },
        create: {
          bucket,
          objectKey: relativePath,
          userId: auth.sub,
        },
      })
    }

    return { ok: true }
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Upload failed')
  }
})
