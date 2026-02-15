import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../../../utils/auth'
import type { NextAuthConfig } from 'next-auth'

const prisma = new PrismaClient()

export const authOptions: NextAuthConfig = {
  adapter: PrismaAdapter(prisma as any),
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials) return null
        const email = typeof credentials.email === 'string' ? credentials.email : null
        const password = typeof credentials.password === 'string' ? credentials.password : null
        if (!email || !password) return null

        const user = await prisma.user.findUnique({ where: { email } })
        if (!user || !user.hashedPassword) return null
        const valid = await verifyPassword(password, user.hashedPassword)
        if (!valid) return null
        return { id: user.id.toString(), email: user.email, name: user.name }
      }
    })
  ],
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'database' },
  pages: { signIn: '/auth/signin' }
}

export default NextAuth(authOptions)
