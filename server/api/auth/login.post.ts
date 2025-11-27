import { defineEventHandler, readBody, createError, setCookie } from 'h3'
import { findUserByUsername, verifyPassword, getUserWithoutPassword, ensureDefaultUser } from '~/server/db/users'
import { signJWT } from '~/server/utils/jwt'
import { addRefreshToken } from '~/server/db/refreshTokens'

// POST /api/auth/login — ตรวจสอบผู้ใช้ ออก access/refresh token (RS256) และเซ็ต cookie
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const body = await readBody(event)

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: 'Missing username or password' })
  }

  let user = await findUserByUsername(body.username)
  if (!user) {
    user = await ensureDefaultUser(body.username, body.password)
  }
  if (!user) {
    throw createError({ statusCode: 401, message: 'Invalid username or password' })
  }

  const isValid = await verifyPassword(body.password, user.password)
  if (!isValid) {
    throw createError({ statusCode: 401, message: 'Invalid username or password' })
  }

  const privateKey = config.jwtPrivateKeyPath
  const role = user.role === 'admin' ? 'admin' : 'user'
  const accessToken = signJWT(
    { sub: user.id, username: user.username, role },
    privateKey,
    config.jwtExpiry
  )

  const refreshToken = signJWT(
    { sub: user.id, username: user.username, role },
    privateKey,
    config.refreshTokenExpiry
  )

  const refreshExpirySec = parseExpiry(config.refreshTokenExpiry || '7d')
  await addRefreshToken(refreshToken, user.id, refreshExpirySec)

  // refresh token -> cookie (httpOnly)
  setCookie(event, 'refreshToken', refreshToken, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: refreshExpirySec,
  })

  return {
    accessToken,
    user: getUserWithoutPassword(user),
  }
})

function parseExpiry(str: string) {
  if (/^\d+$/.test(str)) return Number(str)
  const match = str.match(/(\d+)([smhd])/)
  if (!match) return 7 * 24 * 3600
  const num = Number(match[1])
  const unit = match[2]
  return unit === 's' ? num :
         unit === 'm' ? num * 60 :
         unit === 'h' ? num * 3600 :
         num * 86400
}
