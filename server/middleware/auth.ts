import { defineEventHandler, getHeader, createError } from 'h3'
import { getKeycloakConfig, keycloakPayloadToUser, verifyAccessToken, AuthUser } from '~/server/utils/keycloak'

export interface AuthContext {
  token: string
  payload: any
  user: AuthUser
}

export async function useAuthMiddleware(event: any): Promise<AuthContext | null> {
  const header = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
  if (!header) return null

  const token = header.startsWith('Bearer ') ? header.slice(7) : header

  const kc = getKeycloakConfig()
  const payload = await verifyAccessToken(token, kc)
  if (!payload) return null

  const user = keycloakPayloadToUser(payload)
  const ctx: AuthContext = { token, payload: { ...payload, role: user.role }, user }
  event.context.auth = ctx
  return ctx
}

export async function requireAuth(event: any): Promise<AuthContext> {
  const auth = await useAuthMiddleware(event)
  if (!auth) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return auth
}

export async function requireRole(event: any, roles: 'admin' | 'user' | 'admin|user') {
  const auth = await requireAuth(event)
  const allow = roles.split('|')
  if (!allow.includes(auth.user.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return auth
}

export default defineEventHandler(() => {})
