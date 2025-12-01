import { defineEventHandler, createError, getCookie } from 'h3'
import {
  buildUserFromTokens,
  exchangeRefreshToken,
  getKeycloakConfig,
  setRefreshCookie,
} from '~/server/utils/keycloak'

// POST /api/auth/refresh -> rotate refresh token via Keycloak
export default defineEventHandler(async (event) => {
  const refreshToken = getCookie(event, 'refreshToken')
  if (!refreshToken) {
    throw createError({ statusCode: 400, message: 'Missing refresh token' })
  }

  const kc = getKeycloakConfig()
  const tokens = await exchangeRefreshToken(kc, refreshToken)
  const user = await buildUserFromTokens(kc, tokens)

  setRefreshCookie(event, kc, tokens.refresh_token, tokens.refresh_expires_in)

  return {
    accessToken: tokens.access_token,
    user,
  }
})
