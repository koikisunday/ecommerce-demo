import crypto from 'node:crypto'

function requiredEnv(name) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }
  return value
}

async function fetchWithBody(url, options = {}) {
  const response = await fetch(url, { redirect: 'manual', ...options })
  const text = await response.text()
  let json = null

  try {
    json = JSON.parse(text)
  } catch {
    // ignore non-JSON payloads
  }

  return { response, text, json }
}

function assertStatus(actual, expected, context) {
  if (actual !== expected) {
    throw new Error(`${context}: expected status ${expected}, got ${actual}`)
  }
}

async function main() {
  const stagingBaseUrl = requiredEnv('STAGING_BASE_URL').replace(/\/+$/, '')
  const paystackSecret = requiredEnv('STAGING_PAYSTACK_SECRET')
  const verifyReference = process.env.STAGING_VERIFY_REFERENCE

  const verifyMissingReference = await fetchWithBody(`${stagingBaseUrl}/api/paystack/verify`)
  assertStatus(verifyMissingReference.response.status, 400, 'verify endpoint (missing reference)')
  console.log('Verify endpoint missing-reference check passed')

  const webhookPayload = JSON.stringify({
    event: 'charge.success',
    data: {
      status: 'success',
      reference: `staging-smoke-${Date.now()}`,
      amount: 100
    }
  })

  const invalidWebhook = await fetchWithBody(`${stagingBaseUrl}/api/paystack/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': 'invalid-signature'
    },
    body: webhookPayload
  })
  assertStatus(invalidWebhook.response.status, 400, 'webhook endpoint (invalid signature)')
  console.log('Webhook invalid-signature check passed')

  const validSignature = crypto.createHmac('sha512', paystackSecret).update(webhookPayload).digest('hex')
  const validWebhook = await fetchWithBody(`${stagingBaseUrl}/api/paystack/webhook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-paystack-signature': validSignature
    },
    body: webhookPayload
  })
  assertStatus(validWebhook.response.status, 200, 'webhook endpoint (valid signature)')
  if (validWebhook.json?.received !== true) {
    throw new Error('webhook endpoint (valid signature): expected JSON response {"received": true}')
  }
  console.log('Webhook signed request check passed')

  if (verifyReference) {
    const verifyRealReference = await fetchWithBody(
      `${stagingBaseUrl}/api/paystack/verify?reference=${encodeURIComponent(verifyReference)}`
    )
    assertStatus(verifyRealReference.response.status, 302, 'verify endpoint (real reference)')
    const location = verifyRealReference.response.headers.get('location') ?? ''
    if (!location.includes('/checkout/result?reference=')) {
      throw new Error('verify endpoint (real reference): redirect location missing /checkout/result')
    }
    console.log('Verify endpoint real-reference redirect check passed')
  } else {
    console.log('Skipping real-reference verify check (STAGING_VERIFY_REFERENCE not set)')
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
