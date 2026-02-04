import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'

export const config = { api: { bodyParser: false } }

const prisma = new PrismaClient()

async function getRawBody(req: NextApiRequest) {
  const chunks: Uint8Array[] = []
  for await (const chunk of req as any) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const signature = req.headers['x-paystack-signature'] as string
  const raw = await getRawBody(req)
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET || '').update(raw).digest('hex')
  if (!signature || signature !== expected) {
    console.warn('Invalid Paystack signature')
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(raw.toString())
  console.log('Paystack webhook event:', event.event)

  try {
    // handle successful charge
    const evt = event.event
    const data = event.data
    if ((evt === 'charge.success' || evt === 'charge.completed' || evt === 'payment.success') && data && data.status === 'success') {
      const reference = data.reference
      const order = await prisma.order.findUnique({ where: { paystackReference: reference } })
      if (order) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: data.amount ?? order.totalAmount,
            provider: 'paystack',
            status: data.status,
            reference: reference,
            rawPayload: data
          }
        })
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
        console.log('Order updated to PAID for reference', reference)
      } else {
        console.warn('No order found for reference', reference)
      }
    }
  } catch (err) {
    console.error('Error handling webhook', err)
    return res.status(500).json({ error: 'internal' })
  }

  res.status(200).json({ received: true })
}
