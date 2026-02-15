import type { NextApiRequest, NextApiResponse } from 'next'
import { verifyTransaction } from '../../../utils/paystack'
import { PrismaClient } from '@prisma/client'
import { InventoryUnavailableError, markOrderPaidWithInventory } from '../../../utils/orders'
import { logError, logInfo, logWarn } from '../../../utils/observability'
import { ORDER_STATUS, type OrderStatus } from '../../../utils/orderStatus'

const prisma = new PrismaClient()

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { reference } = req.query
  if (!reference || typeof reference !== 'string') return res.status(400).end('Missing reference')

  try {
    logInfo('paystack_verify.started', { reference })
    const result = await verifyTransaction(reference)
    const status = result.data.status
    const ref = result.data.reference

    const order = await prisma.order.findUnique({
      where: { paystackReference: ref },
      select: { id: true, totalAmount: true }
    })

    let statusParam: OrderStatus = status === 'success' ? ORDER_STATUS.PAID : ORDER_STATUS.PENDING

    if (order) {
      if (status === 'success') {
        try {
          await markOrderPaidWithInventory(prisma, {
            orderId: order.id,
            amount: result.data.amount || order.totalAmount,
            status,
            reference: ref,
            rawPayload: result.data
          })
          logInfo('paystack_verify.order_paid', { orderId: order.id, reference: ref })
        } catch (error) {
          if (error instanceof InventoryUnavailableError) {
            await prisma.order.update({ where: { id: order.id }, data: { status: ORDER_STATUS.FAILED } })
            statusParam = ORDER_STATUS.FAILED
            logWarn('paystack_verify.inventory_unavailable', { orderId: order.id, reference: ref })
          } else {
            throw error
          }
        }
      } else {
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
          logInfo('paystack_verify.payment_recorded', { orderId: order.id, reference: ref, status })
        }
      }
    }

    return res.redirect(
      302,
      '/checkout/result?reference=' + encodeURIComponent(ref) + '&status=' + encodeURIComponent(statusParam)
    )
  } catch (err) {
    logError('paystack_verify.failed', {
      reference,
      message: err instanceof Error ? err.message : 'Unknown error'
    })
    return res.status(500).end('Verification failed')
  }
}
