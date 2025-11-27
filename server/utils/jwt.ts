import jwt, { Secret, SignOptions } from 'jsonwebtoken'
import { readFileSync } from 'fs'

export interface TokenPayload {
  sub: string // user id
  username: string
  role: 'admin' | 'user'
  iat?: number
  exp?: number
}

export function signJWT(payload: TokenPayload, secret: string, expiresIn: string = '1h'): string {
  const opts = { expiresIn } as SignOptions
  const key = loadKey(secret)
  return jwt.sign(payload as any, key as Secret, { ...opts, algorithm: 'RS256' })
}

export function verifyJWT(token: string, secret: string): TokenPayload | null {
  try {
    const key = loadKey(secret)
    const decoded = jwt.verify(token, key as Secret) as TokenPayload
    return decoded
  } catch (err) {
    return null
  }
}

export function decodeJWT(token: string): TokenPayload | null {
  try {
    const decoded = jwt.decode(token) as TokenPayload
    return decoded
  } catch (err) {
    return null
  }
}

function loadKey(value: string) {
  if (!value) return value
  // If the value looks like a PEM (contains BEGIN), return as-is
  if (value.includes('-----BEGIN')) return value

  try {
    return readFileSync(value, 'utf8')
  } catch (e) {
    // fallback: return original value
    return value
  }
}
