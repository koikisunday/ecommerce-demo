import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyTransaction } from '../../../utils/paystack'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { reference } = req.query
  if (!reference || typeof reference !== 'string') return res.status(400).end('Missing reference')

  try {
    const result = await verifyTransaction(reference)
    const status = result.data.status
    const ref = result.data.reference

    // find order
    const order = await prisma.order.findUnique({ where: { paystackReference: ref } })
    if (order) {
      const existingPayment = await prisma.payment.findFirst({ where: { reference: ref, provider: 'paystack' } })
      if (!existingPayment) {
        await prisma.payment.create({
          data: {
            orderId: order.id,
            amount: result.data.amount || order.totalAmount,
            provider: 'paystack',
            status,
            reference: ref,
            rawPayload: JSON.stringify(result.data)
          }
        })
      }
      if (status === 'success') {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'PAID' } })
      }
    }

    // redirect to a simple page
    const statusParam = status === 'success' ? 'PAID' : 'PENDING'
    return res.redirect(
      302,
      '/checkout/result?reference=' + encodeURIComponent(ref) + '&status=' + encodeURIComponent(statusParam)
    )
  } catch (err) {
    console.error(err)
    return res.status(500).end('Verification failed')
  }
}
