import { createMocks } from 'node-mocks-http'
import inventoryHandler from '../pages/api/admin/products/[id]/inventory'
import { PrismaClient } from '@prisma/client'
import * as nextAuthReact from 'next-auth/react'

jest.mock('next-auth/react', () => ({
  getSession: jest.fn()
}))

jest.mock('@prisma/client', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    product: { update: jest.fn() }
  }

  return {
    PrismaClient: jest.fn(() => prisma)
  }
})

describe('Admin Inventory API', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('returns 401 for unauthenticated requests', async () => {
    ;(nextAuthReact.getSession as jest.Mock).mockResolvedValue(null)
    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: '1' },
      body: { inventory: 10 }
    })

    await inventoryHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(401)
  })

  test('updates inventory for admin users', async () => {
    const prismaAny: any = new PrismaClient()

    ;(nextAuthReact.getSession as jest.Mock).mockResolvedValue({
      user: { email: 'admin@example.com' }
    })
    prismaAny.user.findUnique.mockResolvedValue({ role: 'ADMIN' })
    prismaAny.product.update.mockResolvedValue({
      id: 1,
      title: 'Test Product',
      sku: 'TP-1',
      inventory: 12
    })

    const { req, res } = createMocks({
      method: 'PATCH',
      query: { id: '1' },
      body: { inventory: 12 }
    })

    await inventoryHandler(req as any, res as any)

    expect(res._getStatusCode()).toBe(200)
    const data = JSON.parse(res._getData())
    expect(data.product.inventory).toBe(12)
  })
})
