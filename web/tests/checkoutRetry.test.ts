import { createMocks } from 'node-mocks-http'
import retryHandler from '../pages/api/checkout/retry'
import { PrismaClient } from '@prisma/client'
import * as nextAuthReact from 'next-auth/react'
import * as paystack from '../utils/paystack'

jest.mock('next-auth/react', () => ({
  getSession: jest.fn()
}))

jest.mock('../utils/paystack', () => ({
  initializeTransaction: jest.fn()
}))

jest.mock('@prisma/client', () => {
  const prisma = {
    order: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    product: { findMany: jest.fn() }
  }

  return {
    PrismaClient: jest.fn(() => prisma)
  }
})

describe('Checkout Retry API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    ;(nextAuthReact.getSession as jest.Mock).mockResolvedValue({
      user: { email: 'buyer@example.com', name: 'Buyer' }
    })
  })

  test('retries failed order and returns authorization url', async () => {
    const prismaAny: any = new PrismaClient()

    prismaAny.order.findUnique.mockResolvedValue({
      id: 1,
      customerEmail: 'buyer@example.com',
      status: 'FAILED',
      items: [{ productId: 1, quantity: 2, unitPrice: 2000 }]
    })
    prismaAny.product.findMany.mockResolvedValue([
      { id: 1, title: 'Retry Product', sku: 'RT-1', price: 2000, inventory: 5 }
    ])
    prismaAny.order.create.mockResolvedValue({ id: 2 })

    ;(paystack.initializeTransaction as jest.Mock).mockResolvedValue({
      data: { authorization_url: 'https://paystack.test/retry', reference: 'retry-ref-123' }
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { reference: 'failed-ref-1' }
    })

    await retryHandler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.authorization_url).toBe('https://paystack.test/retry')
    expect(prismaAny.order.update).toHaveBeenCalledWith({
      where: { id: 2 },
      data: { paystackReference: 'retry-ref-123' }
    })
  })

  test('returns 409 when original order is not failed', async () => {
    const prismaAny: any = new PrismaClient()
    prismaAny.order.findUnique.mockResolvedValue({
      id: 1,
      customerEmail: 'buyer@example.com',
      status: 'PAID',
      items: []
    })

    const { req, res } = createMocks({
      method: 'POST',
      body: { reference: 'paid-ref-1' }
    })

    await retryHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(409)
  })
})
