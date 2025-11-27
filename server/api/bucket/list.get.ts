import { defineEventHandler } from 'h3'
import { minioClient } from '~/server/utils/minioClient'
import { requireAuth } from '~/server/middleware/auth'

// GET /api/bucket/list — รายชื่อ bucket สำหรับผู้ใช้ทั่วไป (read-only)
// ใช้สำหรับ role=user เพื่อดูรายการ bucket โดยไม่ต้องเรียก endpoint ของ admin
export default defineEventHandler(async (event) => {
  requireAuth(event)

  const buckets = await minioClient.listBuckets()
  return { buckets: buckets.map((b) => b.name) }
})
