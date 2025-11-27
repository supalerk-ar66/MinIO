import { defineEventHandler } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireRole } from '~/server/middleware/auth'

// GET /api/bucket — รายชื่อ bucket ทั้งหมด (เฉพาะ admin)
export default defineEventHandler(async (event) => {
  requireRole(event, 'admin')
  
  const buckets = await minioClient.listBuckets()
  return { buckets: buckets.map(b => b.name) }
})
