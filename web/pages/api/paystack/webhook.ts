import type { NextApiRequest, NextApiResponse } from 'next'
import crypto from 'crypto'
import { PrismaClient } from '@prisma/client'
import { InventoryUnavailableError, markOrderPaidWithInventory } from '../../../utils/orders'
import { logError, logInfo, logWarn } from '../../../utils/observability'
import { ORDER_STATUS } from '../../../utils/orderStatus'

export const config = { api: { bodyParser: false } }

const prisma = new PrismaClient()

async function getRawBody(req: NextApiRequest) {
  const reqAny = req as any

  if (typeof reqAny._getRawBody === 'function') {
    const raw = reqAny._getRawBody()
    if (Buffer.isBuffer(raw)) return raw
    if (typeof raw === 'string') return Buffer.from(raw)
  }

  if (Buffer.isBuffer(req.body)) return req.body
  if (typeof req.body === 'string') return Buffer.from(req.body)
  if (req.body && typeof req.body === 'object') return Buffer.from(JSON.stringify(req.body))

  const chunks: Uint8Array[] = []
  for await (const chunk of req as any) chunks.push(chunk)
  return Buffer.concat(chunks)
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end()

  const signature = req.headers['x-paystack-signature'] as string
  const raw = await getRawBody(req)
  const expected = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET || '').update(raw.toString('utf8')).digest('hex')
  if (!signature || signature !== expected) {
    logWarn('paystack_webhook.invalid_signature', {})
    return res.status(400).json({ error: 'Invalid signature' })
  }

  const event = JSON.parse(raw.toString())
  logInfo('paystack_webhook.received', { event: event.event })

  try {
    // handle successful charge
    const evt = event.event
    const data = event.data
    if ((evt === 'charge.success' || evt === 'charge.completed' || evt === 'payment.success') && data && data.status === 'success') {
      const reference = data.reference
      const order = await prisma.order.findUnique({
        where: { paystackReference: reference },
        select: { id: true, totalAmount: true }
      })
      if (order) {
        try {
          await markOrderPaidWithInventory(prisma, {
            orderId: order.id,
            amount: data.amount ?? order.totalAmount,
            status: data.status,
            reference,
            rawPayload: data
          })
          logInfo('paystack_webhook.order_paid', { orderId: order.id, reference })
        } catch (error) {
          if (error instanceof InventoryUnavailableError) {
            await prisma.order.update({ where: { id: order.id }, data: { status: ORDER_STATUS.FAILED } })
            logWarn('paystack_webhook.inventory_unavailable', { orderId: order.id, reference })
          } else {
            throw error
          }
        }
      } else {
        logWarn('paystack_webhook.order_not_found', { reference })
      }
    }
  } catch (err) {
    logError('paystack_webhook.failed', {
      message: err instanceof Error ? err.message : 'Unknown error'
    })
    return res.status(500).json({ error: 'internal' })
  }

  res.status(200).json({ received: true })
}
