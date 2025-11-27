import { defineEventHandler, getCookie, setCookie } from 'h3'
import { removeRefreshToken } from '~/server/db/refreshTokens'

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, 'refreshToken')
  if (cookieToken) {
    await removeRefreshToken(cookieToken)
    // clear cookie
    setCookie(event, 'refreshToken', '', { httpOnly: true, path: '/', maxAge: 0 })
  }

  return { ok: true }
})
