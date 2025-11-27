import { defineEventHandler, getHeader, createError } from 'h3'
import { verifyJWT } from '~/server/utils/jwt'

export function useAuthMiddleware(event: any) {
  const header = getHeader(event, 'authorization') || getHeader(event, 'Authorization')
  if (!header) return null

  const token = header.startsWith('Bearer ') ? header.slice(7) : header
  const config = useRuntimeConfig()
  const pubKey = config.jwtPublicKeyPath

  const payload = verifyJWT(token, pubKey)
  return payload
}

export function requireAuth(event: any) {
  const payload = useAuthMiddleware(event)
  if (!payload) {
    throw createError({ statusCode: 401, message: 'Unauthorized' })
  }
  return payload
}

export function requireRole(event: any, roles: 'admin' | 'user' | 'admin|user') {
  const payload = requireAuth(event)
  const allow = roles.split('|')
  if (!allow.includes(payload.role)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
  return payload
}

export default defineEventHandler(() => {})
