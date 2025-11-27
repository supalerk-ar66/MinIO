import type { User } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { prisma } from '~/server/utils/prisma'

const DEFAULT_USERS: Record<
  string,
  { password: string; role: 'admin' | 'user'; email: string }
> = {
  admin: {
    password: 'admin123',
    role: 'admin',
    email: 'admin@example.com',
  },
  user: {
    password: 'user123',
    role: 'user',
    email: 'user@example.com',
  },
}

export async function findUserByUsername(username: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { username },
  })
}

export async function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({
    where: { id },
  })
}

export async function ensureDefaultUser(username: string, password: string) {
  const defaultUser = DEFAULT_USERS[username]
  if (!defaultUser || password !== defaultUser.password) {
    return null
  }

  const hashed = await bcrypt.hash(defaultUser.password, 10)
  try {
    return await prisma.user.create({
      data: {
        username,
        email: defaultUser.email,
        role: defaultUser.role,
        password: hashed,
      },
    })
  } catch (err) {
    return prisma.user.findUnique({ where: { username } })
  }
}

export async function verifyPassword(password: string, hashedPassword: string | null): Promise<boolean> {
  if (!hashedPassword) return false
  return bcrypt.compare(password, hashedPassword)
}

export function getUserWithoutPassword(user: User) {
  const { password, ...rest } = user
  return rest
}
