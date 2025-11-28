import jwt, { Secret, SignOptions, Algorithm, JwtPayload } from 'jsonwebtoken'
import { readFileSync, existsSync } from 'fs'

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
  // Use RS256 when provided a PEM key, otherwise fall back to HS256 with a shared secret (dev)
  const algorithm: SignOptions['algorithm'] = key.includes('BEGIN') ? 'RS256' : 'HS256'
  return jwt.sign(payload as any, key as Secret, { ...opts, algorithm })
}

export function verifyJWT(token: string, secret: string): TokenPayload | null {
  try {
    const key = loadKey(secret)
    const algorithms: Algorithm[] = key.includes('BEGIN') ? ['RS256'] : ['HS256']
    const decoded = jwt.verify(token, key as Secret, { algorithms })

    if (!isTokenPayload(decoded)) return null
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

  // If a file exists at the path, load its contents, otherwise treat it as the secret itself
  if (existsSync(value)) {
    try {
      return readFileSync(value, 'utf8')
    } catch (e) {
      return value
    }
  }

  return value
}

function isTokenPayload(decoded: string | JwtPayload): decoded is TokenPayload {
  return (
    typeof decoded === 'object' &&
    decoded !== null &&
    typeof decoded.sub === 'string' &&
    typeof (decoded as any).username === 'string' &&
    ((decoded as any).role === 'admin' || (decoded as any).role === 'user')
  )
}
