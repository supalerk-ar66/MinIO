import { defineEventHandler, createError, getCookie, setCookie } from 'h3'
import { verifyJWT, signJWT } from '~/server/utils/jwt'
import { findUserById, getUserWithoutPassword } from '~/server/db/users'
import { findRefreshToken, removeRefreshToken, addRefreshToken } from '~/server/db/refreshTokens'

// POST /api/auth/refresh — ตรวจสอบ refresh token ใน cookie แล้วออก access token ใหม่ (rotate token)
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  const cookieToken = getCookie(event, 'refreshToken')
  if (!cookieToken) {
    throw createError({ statusCode: 400, message: 'Missing refresh token' })
  }

  const pubKey = config.jwtPublicKeyPath
  const payload = verifyJWT(cookieToken, pubKey)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Invalid or expired refresh token' })
  }

  const rec = await findRefreshToken(cookieToken)
  if (!rec || rec.userId !== payload.sub) {
    throw createError({ statusCode: 401, message: 'Refresh token expired or revoked' })
  }

  const user = await findUserById(payload.sub)
  if (!user) {
    throw createError({ statusCode: 404, message: 'User not found' })
  }

  // 🔁 rotate refresh token
  await removeRefreshToken(cookieToken)

  const privateKey = config.jwtPrivateKeyPath
  const role = user.role === 'admin' ? 'admin' : 'user'
  const newAccessToken = signJWT(
    { sub: user.id, username: user.username, role },
    privateKey,
    config.jwtExpiry
  )

  const newRefreshToken = signJWT(
    { sub: user.id, username: user.username, role },
    privateKey,
    config.refreshTokenExpiry
  )

  const expirySec = parseExpiry(config.refreshTokenExpiry)
  await addRefreshToken(newRefreshToken, user.id, expirySec)

  // set new cookie
  setCookie(event, 'refreshToken', newRefreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: expirySec,
  })

  return {
    accessToken: newAccessToken,
    user: getUserWithoutPassword(user),
  }
})

function parseExpiry(str?: string) {
  if (!str) return 7 * 24 * 3600
  if (/^\d+$/.test(str)) return Number(str)
  const m = str.match(/(\d+)([smhd])/)
  const v = Number(m?.[1] || 7)
  const unit = m?.[2] || 'd'
  return unit === 's' ? v :
         unit === 'm' ? v * 60 :
         unit === 'h' ? v * 3600 :
         v * 86400
}
