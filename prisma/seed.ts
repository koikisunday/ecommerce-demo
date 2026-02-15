import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const defaultPassword = await bcrypt.hash('changeme', 10)

  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin', hashedPassword: defaultPassword, role: 'ADMIN' }
  })

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@example.com' },
    update: {},
    create: { email: 'vendor@example.com', name: 'Vendor Owner', hashedPassword: defaultPassword, role: 'VENDOR' }
  })

  const vendor = await prisma.vendor.upsert({
    where: { name: 'Demo Vendor' },
    update: {},
    create: { name: 'Demo Vendor', ownerId: vendorUser.id }
  })

  await prisma.product.createMany({
    data: [
      { title: 'Demo Product 1', slug: 'demo-product-1', description: 'A demo product', vendorId: vendor.id, price: 2000, sku: 'DP-1', inventory: 10 },
      { title: 'Demo Product 2', slug: 'demo-product-2', description: 'Another demo', vendorId: vendor.id, price: 3500, sku: 'DP-2', inventory: 5 }
    ]
  })

  // Example order (pending)
  await prisma.order.create({
    data: {
      customerEmail: 'buyer@example.com',
      customerName: 'Buyer One',
      totalAmount: 2000,
      status: 'PENDING',
      items: {
        create: [
          {
            productId: 1,
            quantity: 1,
            unitPrice: 2000,
            productTitleSnapshot: 'Demo Product 1',
            productSkuSnapshot: 'DP-1'
          }
        ]
      }
    }
  })
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
