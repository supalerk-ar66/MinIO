import { defineEventHandler, getCookie } from 'h3'
import { clearRefreshCookie, getKeycloakConfig, logoutFromKeycloak } from '~/server/utils/keycloak'

export default defineEventHandler(async (event) => {
  const cookieToken = getCookie(event, 'refreshToken')
  if (cookieToken) {
    const kc = getKeycloakConfig()
    await logoutFromKeycloak(kc, cookieToken)
    clearRefreshCookie(event, kc)
  }

  return { ok: true }
})
