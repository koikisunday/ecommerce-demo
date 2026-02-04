import axios from 'axios'

const PAYSTACK_BASE = 'https://api.paystack.co'

export async function initializeTransaction({ email, amount, callback_url }: { email: string; amount: number; callback_url: string }) {
  const res = await axios.post(
    `${PAYSTACK_BASE}/transaction/initialize`,
    { email, amount, callback_url },
    { headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` } }
  )
  return res.data
}

export async function verifyTransaction(reference: string) {
  const res = await axios.get(`${PAYSTACK_BASE}/transaction/verify/${reference}`, {
    headers: { Authorization: `Bearer ${process.env.PAYSTACK_SECRET}` }
  })
  return res.data
}
