import { defineEventHandler, readBody, createError } from 'h3'
import {
  buildUserFromTokens,
  exchangePasswordGrant,
  getKeycloakConfig,
  setRefreshCookie,
} from '~/server/utils/keycloak'

// POST /api/auth/login -> delegate to Keycloak password grant and return access token + user info
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  if (!body.username || !body.password) {
    throw createError({ statusCode: 400, message: 'Missing username or password' })
  }

  const kc = getKeycloakConfig()
  const tokens = await exchangePasswordGrant(kc, body.username, body.password)
  const user = await buildUserFromTokens(kc, tokens)

  setRefreshCookie(event, kc, tokens.refresh_token, tokens.refresh_expires_in)

  return {
    accessToken: tokens.access_token,
    user,
  }
})
