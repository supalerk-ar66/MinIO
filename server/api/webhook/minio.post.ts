import { defineEventHandler, readRawBody, createError, getHeader } from 'h3'
import crypto from 'crypto'
import path from 'path'
import { minioClient } from '~/server/utils/minioClient'
import { esClient, ensureElasticSetup, FILES_INDEX, FILE_PIPELINE_ID } from '~/server/utils/elastic'

interface MinioRecord {
  s3: {
    bucket: { name: string }
    object: { key: string; size?: number; userMetadata?: Record<string, string> }
  }
  userIdentity?: { principalId?: string }
  eventTime?: string
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const secret = config.minioWebhookSecret || process.env.MINIO_WEBHOOK_SECRET
  if (!secret) {
    throw createError({ statusCode: 500, statusMessage: 'Webhook secret not configured' })
  }

  const raw = await readRawBody(event)
  if (!raw) {
    throw createError({ statusCode: 400, statusMessage: 'Empty body' })
  }

  const sigHeader = getHeader(event, 'x-minio-signature') || getHeader(event, 'x-hub-signature-256')
  if (!sigHeader) {
    throw createError({ statusCode: 401, statusMessage: 'Missing signature' })
  }
  if (!verifySignature(Buffer.from(raw), sigHeader, secret)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid signature' })
  }

  let payload: any
  try {
    payload = JSON.parse(raw.toString())
  } catch (err) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid JSON' })
  }

  const records: MinioRecord[] = payload?.Records || []
  if (!records.length) {
    throw createError({ statusCode: 400, statusMessage: 'No records' })
  }

  await ensureElasticSetup()

  for (const record of records) {
    const bucket = record.s3?.bucket?.name
    const rawKey = record.s3?.object?.key
    if (!bucket || !rawKey) continue

    const key = decodeURIComponent(rawKey.replace(/\+/g, ' '))
    const ownerId =
      record.userIdentity?.principalId ||
      record.s3?.object?.userMetadata?.ownerId ||
      'unknown'
    const size = record.s3?.object?.size || 0
    const updatedAt = record.eventTime || new Date().toISOString()
    const extension = path.extname(key).replace('.', '').toLowerCase()
    const filename = path.basename(key)

    const base64 = await fetchObjectBase64(bucket, key)

    await esClient.index({
      index: FILES_INDEX,
      id: `${bucket}:${key}`,
      pipeline: FILE_PIPELINE_ID,
      document: {
        bucket,
        key,
        path: key,
        filename,
        ownerId,
        size,
        extension,
        updatedAt,
        data: base64,
      },
    })
  }

  return { ok: true, indexed: records.length }
})

function verifySignature(raw: Buffer, sigHeader: string, secret: string) {
  const val = sigHeader.replace('sha256=', '')
  const mac = crypto.createHmac('sha256', secret).update(raw).digest('hex')
  return crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(val))
}

async function fetchObjectBase64(bucket: string, key: string) {
  const stream = await minioClient.getObject(bucket, key)
  const chunks: Buffer[] = []
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('base64')
}
