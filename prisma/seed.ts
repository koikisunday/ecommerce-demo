import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const DEFAULT_PASSWORD_HASH = '$2a$10$TWb717cwKnL21zZuJt7CSOWJtEA1uCPptoMhWGx73HjJNQ/zvkCeG'

async function main() {
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin', hashedPassword: DEFAULT_PASSWORD_HASH, role: 'ADMIN' }
  })

  const vendorUser = await prisma.user.upsert({
    where: { email: 'vendor@example.com' },
    update: {},
    create: { email: 'vendor@example.com', name: 'Vendor Owner', hashedPassword: DEFAULT_PASSWORD_HASH, role: 'VENDOR' }
  })

  const vendor = await prisma.vendor.upsert({
    where: { ownerId: vendorUser.id },
    update: { name: 'Demo Vendor' },
    create: { name: 'Demo Vendor', ownerId: vendorUser.id }
  })

  const productOne = await prisma.product.upsert({
    where: { slug: 'demo-product-1' },
    update: {
      title: 'Demo Product 1',
      description: 'A demo product',
      vendorId: vendor.id,
      price: 2000,
      sku: 'DP-1',
      inventory: 10
    },
    create: {
      title: 'Demo Product 1',
      slug: 'demo-product-1',
      description: 'A demo product',
      vendorId: vendor.id,
      price: 2000,
      sku: 'DP-1',
      inventory: 10
    }
  })

  await prisma.product.upsert({
    where: { slug: 'demo-product-2' },
    update: {
      title: 'Demo Product 2',
      description: 'Another demo',
      vendorId: vendor.id,
      price: 3500,
      sku: 'DP-2',
      inventory: 5
    },
    create: {
      title: 'Demo Product 2',
      slug: 'demo-product-2',
      description: 'Another demo',
      vendorId: vendor.id,
      price: 3500,
      sku: 'DP-2',
      inventory: 5
    }
  })

  // Example order (pending)
  const existingSeedOrder = await prisma.order.findUnique({
    where: { paystackReference: 'seed-order-1' }
  })
  if (!existingSeedOrder) {
    await prisma.order.create({
      data: {
        customerEmail: 'buyer@example.com',
        customerName: 'Buyer One',
        totalAmount: 2000,
        status: 'PENDING',
        paystackReference: 'seed-order-1',
        items: {
          create: [
            {
              productId: productOne.id,
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
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
