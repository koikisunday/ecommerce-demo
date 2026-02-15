import type { NextApiRequest, NextApiResponse } from 'next'
import { PrismaClient } from '@prisma/client'
import { getSession } from 'next-auth/react'
import { initializeTransaction } from '../../utils/paystack'
import { buildOrderDraftFromItems, type CheckoutRequestItem } from '../../utils/checkoutValidation'
import { logError, logInfo, logWarn } from '../../utils/observability'
import { ORDER_STATUS } from '../../utils/orderStatus'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const session = await getSession({ req } as any)
  const customerEmail = session?.user?.email ?? null
  const customerName = session?.user?.name ?? null

  if (!customerEmail) {
    logWarn('checkout.unauthorized', { method: req.method })
    return res.status(401).json({ error: 'Authentication required' })
  }

  const { items } = req.body
  if (!items || !Array.isArray(items)) return res.status(400).json({ error: 'Invalid payload' })

  try {
    logInfo('checkout.started', { customerEmail, itemCount: items.length })

    const normalizedItems: CheckoutRequestItem[] = []
    for (const it of items) {
      if (
        typeof it?.productId !== 'number' ||
        typeof it?.quantity !== 'number' ||
        !Number.isInteger(it.productId) ||
        !Number.isInteger(it.quantity) ||
        it.quantity <= 0
      ) {
        return res.status(400).json({ error: 'Invalid item payload' })
      }

      if (
        typeof it.expectedUnitPrice !== 'undefined' &&
        (typeof it.expectedUnitPrice !== 'number' || !Number.isInteger(it.expectedUnitPrice))
      ) {
        return res.status(400).json({ error: 'Invalid item payload' })
      }

      normalizedItems.push({
        productId: it.productId,
        quantity: it.quantity,
        expectedUnitPrice: it.expectedUnitPrice
      })
    }

    const { totalAmount, orderItems, mismatches } = await buildOrderDraftFromItems(prisma, normalizedItems)
    if (mismatches.length > 0) {
      logWarn('checkout.mismatch', { customerEmail, mismatches })
      return res.status(409).json({
        error: 'Cart is out of date. Review item changes and try again.',
        mismatches
      })
    }

    // create order in DB (pending)
    const order = await prisma.order.create({
      data: {
        customerEmail,
        customerName,
        totalAmount,
        status: ORDER_STATUS.PENDING,
        items: { create: orderItems as any }
      }
    })
    logInfo('checkout.order_created', { orderId: order.id, customerEmail, totalAmount })

    // initialize Paystack transaction (amount in kobo if NGN; this example assumes minor units already)
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/paystack/verify`
    const payRes = await initializeTransaction({ email: customerEmail, amount: totalAmount * 100, callback_url: callbackUrl })

    const reference = payRes.data.reference

    // attach reference to order
    await prisma.order.update({ where: { id: order.id }, data: { paystackReference: reference } })
    logInfo('checkout.paystack_initialized', { orderId: order.id, reference })

    res.status(200).json({ authorization_url: payRes.data.authorization_url, reference })
  } catch (error) {
    logError('checkout.failed', {
      customerEmail,
      message: error instanceof Error ? error.message : 'Unknown error'
    })
    return res.status(500).json({ error: 'Unable to start checkout' })
  }
}
