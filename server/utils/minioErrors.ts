import { createError } from 'h3'

export function handleMinioBucketError(err: any, bucket?: string, defaultMessage?: string): never {
  if (err?.statusCode && typeof err.statusCode === 'number') {
    throw err
  }

  const message = String(err?.message || '')
  const lower = message.toLowerCase()

  if (err?.code === 'NoSuchBucket' || lower.includes('nosuchbucket')) {
    throw createError({
      statusCode: 404,
      message: bucket ? `Bucket "${bucket}" not found` : 'Bucket not found',
    })
  }

  if (lower.includes('illegal path')) {
    throw createError({ statusCode: 400, message: 'Invalid bucket name' })
  }

  throw createError({
    statusCode: 500,
    message: message || defaultMessage || 'Bucket operation failed',
  })
}
