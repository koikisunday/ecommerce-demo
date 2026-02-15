import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { getSession } from 'next-auth/react'
import { initializeTransaction } from '../../../utils/paystack'
import { buildOrderDraftFromItems } from '../../../utils/checkoutValidation'
import { logError, logInfo, logWarn } from '../../../utils/observability'
import { ORDER_STATUS } from '../../../utils/orderStatus'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession({ req } as any)
  const customerEmail = session?.user?.email ?? null
  const customerName = session?.user?.name ?? null
  if (!customerEmail) {
    logWarn('checkout_retry.unauthorized', { method: req.method })
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { reference } = req.body ?? {}
  if (typeof reference !== 'string' || reference.length === 0) {
    return res.status(400).json({ error: 'Missing reference' })
  }

  try {
    logInfo('checkout_retry.started', { customerEmail, reference })

    const previousOrder = await prisma.order.findUnique({
      where: { paystackReference: reference },
      include: { items: true }
    })

    if (!previousOrder) return res.status(404).json({ error: 'Order not found' })
    if (previousOrder.customerEmail !== customerEmail) return res.status(403).json({ error: 'Forbidden' })
    if (previousOrder.status !== ORDER_STATUS.FAILED) {
      return res.status(409).json({ error: 'Only failed orders can be retried' })
    }

    const retryItems = previousOrder.items.map((item) => ({
      productId: item.productId,
      quantity: item.quantity,
      expectedUnitPrice: item.unitPrice
    }))

    const { totalAmount, orderItems, mismatches } = await buildOrderDraftFromItems(prisma, retryItems)
    if (mismatches.length > 0) {
      logWarn('checkout_retry.mismatch', { customerEmail, reference, mismatches })
      return res.status(409).json({
        error: 'Retry cart is out of date. Review item changes and try checkout again.',
        mismatches
      })
    }

    const order = await prisma.order.create({
      data: {
        customerEmail,
        customerName,
        totalAmount,
        status: ORDER_STATUS.PENDING,
        items: { create: orderItems as any }
      }
    })
    logInfo('checkout_retry.order_created', { orderId: order.id, customerEmail, totalAmount })

    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/paystack/verify`
    const payRes = await initializeTransaction({
      email: customerEmail,
      amount: totalAmount * 100,
      callback_url: callbackUrl
    })

    await prisma.order.update({
      where: { id: order.id },
      data: { paystackReference: payRes.data.reference }
    })
    logInfo('checkout_retry.paystack_initialized', { orderId: order.id, reference: payRes.data.reference })

    return res.status(200).json({
      authorization_url: payRes.data.authorization_url,
      reference: payRes.data.reference
    })
  } catch (error) {
    logError('checkout_retry.failed', {
      customerEmail,
      reference,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return res.status(500).json({ error: 'Unable to retry checkout' })
  }
}
