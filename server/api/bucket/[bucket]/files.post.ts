import { defineEventHandler, getRouterParam, readMultipartFormData, createError } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'
import { prisma } from '~/server/utils/prisma'
import { handleMinioBucketError } from '~/server/utils/minioErrors'
import { esClient, ensureElasticSetup, FILES_INDEX, FILE_PIPELINE_ID } from '~/server/utils/elastic'

const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/

// POST /api/bucket/:bucket/files — อัปโหลดไฟล์/โฟลเดอร์เข้า bucket
export default defineEventHandler(async (event) => {
  const auth = await requireAuth(event)

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

    await ensureElasticSetup().catch(() => {}) // best-effort; ignore if ES unavailable

    for (const file of files) {
      const relativePath =
        file.filename && file.filename.includes('/')
          ? file.filename // e.g. folder1/folder2/img.png
          : file.filename || 'file'

      // Avoid FK errors when Keycloak user is not persisted locally
      const userRecord = await prisma.user.findUnique({ where: { id: auth.user.id } })
      const ownerId = userRecord ? auth.user.id : null

      await minioClient.putObject(bucket, relativePath, file.data)

      await prisma.fileMeta.upsert({
        where: {
          bucket_objectKey: {
            bucket,
            objectKey: relativePath,
          },
        },
        update: {
          userId: ownerId,
        },
        create: {
          bucket,
          objectKey: relativePath,
          userId: ownerId,
        },
      })

      // best-effort index into Elasticsearch (attachment pipeline)
      const base64 = Buffer.from(file.data).toString('base64')
      const extension = relativePath.split('.').pop()?.toLowerCase() || ''
      const filename = relativePath.split('/').pop() || relativePath
      const updatedAt = new Date().toISOString()

      esClient
        .index({
          index: FILES_INDEX,
          id: `${bucket}:${relativePath}`,
          pipeline: FILE_PIPELINE_ID,
          document: {
            bucket,
            key: relativePath,
            path: relativePath,
            filename,
            ownerId: auth.user.id,
            size: file.data.length,
            extension,
            updatedAt,
            data: base64,
          },
        })
        .catch(() => {})
    }

    return { ok: true }
  } catch (err: any) {
    handleMinioBucketError(err, bucket, 'Upload failed')
  }
})
