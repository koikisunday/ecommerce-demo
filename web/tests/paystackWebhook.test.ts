import crypto from 'crypto'
import { createMocks } from 'node-mocks-http'
import webhookHandler from '../pages/api/paystack/webhook'
import { PrismaClient } from '@prisma/client'
import * as orderUtils from '../utils/orders'

jest.mock('../utils/orders', () => {
  return {
    InventoryUnavailableError: class InventoryUnavailableError extends Error {},
    markOrderPaidWithInventory: jest.fn()
  }
})

jest.mock('@prisma/client', () => {
  const prisma = {
    order: { findUnique: jest.fn(), update: jest.fn() }
  }

  return {
    PrismaClient: jest.fn(() => prisma)
  }
})

describe('Paystack webhook', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    process.env.PAYSTACK_SECRET = process.env.PAYSTACK_SECRET || 'test-secret'
  })

  test('rejects invalid signature', async () => {
    const payload = JSON.stringify({ some: 'payload' })
    const { req, res } = createMocks({ method: 'POST' })
    ;(req as any)._getRawBody = () => payload
    // set an invalid signature
    req.headers['x-paystack-signature'] = 'invalid'

    await webhookHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
  })

  test('accepts valid signature and handles charge.success', async () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: 'ref-123', amount: 100 } })
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET || '').update(payload).digest('hex')
    const { req, res } = createMocks({ method: 'POST' })
    const prismaAny: any = new PrismaClient()
    prismaAny.order.findUnique.mockResolvedValue({ id: 1, totalAmount: 100 })
    ;(orderUtils.markOrderPaidWithInventory as jest.Mock).mockResolvedValue({ applied: true })
    req.headers['x-paystack-signature'] = signature
    ;(req as any)._getRawBody = () => payload

    await webhookHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
    expect(orderUtils.markOrderPaidWithInventory).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ orderId: 1, reference: 'ref-123', status: 'success' })
    )
  })
})
