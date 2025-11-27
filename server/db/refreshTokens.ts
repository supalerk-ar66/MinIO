import { createHash } from 'crypto'
import { prisma } from '~/server/utils/prisma'

export function hashToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export async function addRefreshToken(token: string, userId: string, expiresInSec: number) {
  const hash = hashToken(token)
  const expiresAt = new Date(Date.now() + expiresInSec * 1000)

  await prisma.refreshToken.upsert({
    where: { hash },
    update: {
      userId,
      expiresAt,
    },
    create: {
      hash,
      userId,
      expiresAt,
    },
  })
}

export async function removeRefreshToken(token: string) {
  const hash = hashToken(token)
  await prisma.refreshToken.deleteMany({
    where: { hash },
  })
}

export async function findRefreshToken(token: string) {
  const hash = hashToken(token)
  const record = await prisma.refreshToken.findUnique({
    where: { hash },
  })

  if (!record) {
    return null
  }

  if (record.expiresAt < new Date()) {
    await prisma.refreshToken
      .delete({
        where: { hash },
      })
      .catch(() => {})
    return null
  }

  return record
}

export async function clearAllRefreshTokens() {
  await prisma.refreshToken.deleteMany()
}

export async function countRefreshTokens() {
  return prisma.refreshToken.count()
}
