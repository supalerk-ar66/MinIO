import { createError, setCookie } from 'h3'
import { createRemoteJWKSet, decodeJwt, jwtVerify, JWTPayload } from 'jose'

type AuthRole = 'admin' | 'user'

export interface KeycloakConfig {
  baseUrl: string
  realm: string
  clientId: string
  clientSecret?: string
  issuer: string
  tokenEndpoint: string
  userInfoEndpoint: string
  logoutEndpoint: string
  jwksUri: string
  secureCookie: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token?: string
  id_token?: string
  token_type: string
  expires_in: number
  refresh_expires_in?: number
}

export interface AuthUser {
  id: string
  username: string
  email: string | null
  role: AuthRole
  createdAt: string
}

let cachedJwksRealm = ''
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null

export function getKeycloakConfig(): KeycloakConfig {
  const config = useRuntimeConfig()
  const baseUrl = (config.keycloakBaseUrl as string | undefined)?.replace(/\/$/, '')
  const realm = config.keycloakRealm as string | undefined
  const clientId = config.keycloakClientId as string | undefined

  if (!baseUrl || !realm || !clientId) {
    throw createError({ statusCode: 500, message: 'Keycloak config is missing (BASE_URL/REALM/CLIENT_ID)' })
  }

  const issuer = `${baseUrl}/realms/${realm}`
  return {
    baseUrl,
    realm,
    clientId,
    clientSecret: (config.keycloakClientSecret as string | undefined) || undefined,
    issuer,
    tokenEndpoint: `${issuer}/protocol/openid-connect/token`,
    userInfoEndpoint: `${issuer}/protocol/openid-connect/userinfo`,
    logoutEndpoint: `${issuer}/protocol/openid-connect/logout`,
    jwksUri: `${issuer}/protocol/openid-connect/certs`,
    secureCookie: Boolean(config.authCookieSecure),
  }
}

export async function exchangePasswordGrant(
  kc: KeycloakConfig,
  username: string,
  password: string
): Promise<TokenResponse> {
  try {
    const form = new URLSearchParams({
      client_id: kc.clientId,
      grant_type: 'password',
      username,
      password,
      scope: 'openid profile email',
    })
    if (kc.clientSecret) form.set('client_secret', kc.clientSecret)

    return await $fetch<TokenResponse>(kc.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  } catch (err: any) {
    const msg = err?.data?.error_description || err?.message || 'Login failed'
    throw createError({ statusCode: 401, message: msg })
  }
}

export async function exchangeRefreshToken(
  kc: KeycloakConfig,
  refreshToken: string
): Promise<TokenResponse> {
  try {
    const form = new URLSearchParams({
      client_id: kc.clientId,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    })
    if (kc.clientSecret) form.set('client_secret', kc.clientSecret)

    return await $fetch<TokenResponse>(kc.tokenEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  } catch (err: any) {
    const msg = err?.data?.error_description || err?.message || 'Refresh token failed'
    throw createError({ statusCode: 401, message: msg })
  }
}

export async function logoutFromKeycloak(kc: KeycloakConfig, refreshToken: string) {
  try {
    const form = new URLSearchParams({
      client_id: kc.clientId,
      refresh_token: refreshToken,
    })
    if (kc.clientSecret) form.set('client_secret', kc.clientSecret)

    await $fetch(kc.logoutEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    })
  } catch {
    // logout failure is non-fatal; we still clear cookies locally
  }
}

export async function fetchUserInfo(kc: KeycloakConfig, accessToken: string) {
  try {
    return await $fetch<any>(kc.userInfoEndpoint, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
  } catch {
    return null
  }
}

export async function verifyAccessToken(token: string, kc: KeycloakConfig) {
  if (!jwks || cachedJwksRealm !== kc.realm) {
    jwks = createRemoteJWKSet(new URL(kc.jwksUri))
    cachedJwksRealm = kc.realm
  }

  try {
    const { payload } = await jwtVerify(token, jwks!, {
      issuer: kc.issuer,
      audience: kc.clientId,
    })
    return payload
  } catch (err: any) {
    // Fallback: if audience mismatch, verify issuer only then manually check aud/azp
    try {
      const { payload } = await jwtVerify(token, jwks!, {
        issuer: kc.issuer,
      })
      if (isAudienceAllowed(payload, kc.clientId)) return payload
      return null
    } catch {
      return null
    }
  }
}

function isAudienceAllowed(payload: JWTPayload, clientId: string) {
  const aud = payload.aud
  const azp = (payload as any).azp
  if (Array.isArray(aud)) {
    if (aud.includes(clientId) || aud.includes('account')) return true
  } else if (typeof aud === 'string') {
    if (aud === clientId || aud === 'account') return true
  }
  if (azp === clientId) return true
  return false
}

export function keycloakPayloadToUser(payload: JWTPayload, fallbackInfo?: any): AuthUser {
  const username =
    (payload.preferred_username as string | undefined) ||
    (fallbackInfo?.preferred_username as string | undefined) ||
    (fallbackInfo?.email as string | undefined) ||
    (payload.email as string | undefined) ||
    'user'

  const createdAt = payload.auth_time
    ? new Date(payload.auth_time * 1000).toISOString()
    : payload.iat
      ? new Date(payload.iat * 1000).toISOString()
      : new Date().toISOString()

  return {
    id: String(payload.sub),
    username,
    email: (payload.email as string | undefined) || fallbackInfo?.email || null,
    role: getRoleFromPayload(payload),
    createdAt,
  }
}

export async function buildUserFromTokens(kc: KeycloakConfig, tokens: TokenResponse): Promise<AuthUser> {
  const decoded =
    (tokens.id_token && safeDecode(tokens.id_token)) ||
    (tokens.access_token && safeDecode(tokens.access_token)) ||
    undefined

  const info = tokens.access_token ? await fetchUserInfo(kc, tokens.access_token) : null
  return keycloakPayloadToUser(decoded || {}, info || undefined)
}

export function setRefreshCookie(event: any, kc: KeycloakConfig, token?: string, maxAgeSec?: number) {
  if (!token) return
  setCookie(event, 'refreshToken', token, {
    httpOnly: true,
    secure: kc.secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeSec || 7 * 24 * 3600,
  })
}

export function clearRefreshCookie(event: any, kc: KeycloakConfig) {
  setCookie(event, 'refreshToken', '', {
    httpOnly: true,
    secure: kc.secureCookie,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  })
}

function safeDecode(token: string): JWTPayload | undefined {
  try {
    return decodeJwt(token)
  } catch {
    return undefined
  }
}

function getRoleFromPayload(payload: JWTPayload): AuthRole {
  const realmRoles: string[] = Array.isArray((payload as any).realm_access?.roles)
    ? (payload as any).realm_access.roles
    : []
  if (realmRoles.includes('admin')) return 'admin'
  return 'user'
}
