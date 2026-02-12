import { createMocks } from 'node-mocks-http'
import checkoutHandler from '../pages/api/checkout'
import * as paystack from '../utils/paystack'
import { PrismaClient } from '@prisma/client'

jest.mock('@prisma/client', () => {
  const prisma = {
    product: { findUnique: jest.fn() },
    order: { create: jest.fn(), update: jest.fn() }
  }

  return {
    PrismaClient: jest.fn(() => prisma)
  }
})

jest.mock('../utils/paystack')

describe('Checkout API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('creates an order and returns authorization url', async () => {
    const mockProduct = { id: 1, price: 2000 }
    const prismaAny: any = new PrismaClient()
    prismaAny.product.findUnique.mockResolvedValue(mockProduct)
    prismaAny.order.create.mockResolvedValue({ id: 1 })

    ;(paystack.initializeTransaction as jest.Mock).mockResolvedValue({ data: { authorization_url: 'https://paystack/pay', reference: 'ref-123' } })

    const { req, res } = createMocks({ method: 'POST', body: { items: [{ productId: 1, quantity: 1 }], customerEmail: 'a@b.com' } })
    await checkoutHandler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.authorization_url).toBe('https://paystack/pay')
  })
})
