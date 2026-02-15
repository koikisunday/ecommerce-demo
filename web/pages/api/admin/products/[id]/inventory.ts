import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { getSession } from 'next-auth/react'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'PATCH') return res.status(405).end()

  const session = await getSession({ req } as any)
  if (!session?.user?.email) return res.status(401).json({ error: 'Authentication required' })

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true }
  })

  if (!user || (user.role !== 'ADMIN' && user.role !== 'VENDOR')) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const id = Number(req.query.id)
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid product id' })

  const { inventory } = req.body ?? {}
  if (typeof inventory !== 'number' || !Number.isInteger(inventory) || inventory < 0) {
    return res.status(400).json({ error: 'Inventory must be a non-negative integer' })
  }

  const product = await prisma.product.update({
    where: { id },
    data: { inventory },
    select: { id: true, title: true, sku: true, inventory: true }
  })

  return res.status(200).json({ product })
}
