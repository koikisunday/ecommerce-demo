import crypto from 'crypto'
import { createMocks } from 'node-mocks-http'
import webhookHandler from '../pages/api/paystack/webhook'

describe('Paystack webhook', () => {
  test('rejects invalid signature', async () => {
    const { req, res } = createMocks({ method: 'POST', body: { some: 'payload' } })
    // set an invalid signature
    req.headers['x-paystack-signature'] = 'invalid'

    await webhookHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(400)
  })

  test('accepts valid signature and handles charge.success', async () => {
    const payload = JSON.stringify({ event: 'charge.success', data: { status: 'success', reference: 'ref-123', amount: 100 } })
    const signature = crypto.createHmac('sha512', process.env.PAYSTACK_SECRET || '').update(Buffer.from(payload)).digest('hex')
    const { req, res } = createMocks({ method: 'POST' })
    req.headers['x-paystack-signature'] = signature
    // feed raw body
    req._getRawBody = () => Buffer.from(payload)

    // Call handler; no exceptions means success (DB mocked in environment for tests)
    await webhookHandler(req as any, res as any)
    expect(res._getStatusCode()).toBe(200)
  })
})
