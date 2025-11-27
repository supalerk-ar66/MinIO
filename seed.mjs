import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function hashPassword(password) {
  const salt = await bcrypt.genSalt(10)
  return bcrypt.hash(password, salt)
}

async function main() {
  console.log('Seeding database...')

  const [adminHash, userHash] = await Promise.all([
    hashPassword('admin123'),
    hashPassword('user123'),
  ])

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {
      password: adminHash,
    },
    create: {
      username: 'admin',
      email: 'admin@example.com',
      password: adminHash,
      role: 'admin',
    },
  })

  const user = await prisma.user.upsert({
    where: { username: 'user' },
    update: {
      password: userHash,
    },
    create: {
      username: 'user',
      email: 'user@example.com',
      password: userHash,
      role: 'user',
    },
  })

  console.log('Seeded users:', admin.username, user.username)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
