import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { initializeTransaction } from '../../utils/paystack'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()
  const { items, customerEmail, customerName } = req.body
  if (!items || !Array.isArray(items) || !customerEmail) return res.status(400).json({ error: 'Invalid payload' })

  // calculate total
  let total = 0
  const orderItems = []
  for (const it of items) {
    const product = await prisma.product.findUnique({ where: { id: it.productId } })
    if (!product) return res.status(404).json({ error: 'Product not found' })
    total += product.price * it.quantity
    orderItems.push({ productId: product.id, quantity: it.quantity, unitPrice: product.price })
  }

  // create order in DB (pending)
  const order = await prisma.order.create({
    data: {
      customerEmail,
      customerName,
      totalAmount: total,
      status: 'PENDING',
      items: { create: orderItems }
    }
  })

  // initialize Paystack transaction (amount in kobo if NGN; this example assumes minor units already)
  const callbackUrl = `${process.env.NEXTAUTH_URL}/api/paystack/verify`
  const payRes = await initializeTransaction({ email: customerEmail, amount: total * 100, callback_url: callbackUrl })

  const reference = payRes.data.reference

  // attach reference to order
  await prisma.order.update({ where: { id: order.id }, data: { paystackReference: reference } })

  res.status(200).json({ authorization_url: payRes.data.authorization_url, reference })
}
