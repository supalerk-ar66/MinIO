import { Client } from 'minio'

const {
  MINIO_ENDPOINT,
  MINIO_PORT,
  MINIO_ACCESS_KEY,
  MINIO_SECRET_KEY,
  MINIO_USE_SSL,
  MINIO_REGION
} = process.env

export const minioClient = new Client({
  endPoint: MINIO_ENDPOINT || 'minio',
  port: Number(MINIO_PORT) || 9000,
  useSSL: MINIO_USE_SSL === 'true',
  accessKey: MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: MINIO_SECRET_KEY || 'minioadmin',
  region: MINIO_REGION || 'us-east-1'
})
