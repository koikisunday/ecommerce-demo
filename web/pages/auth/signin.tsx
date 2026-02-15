import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/router'

export default function SignIn() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()
  const callbackUrl = typeof router.query.callbackUrl === 'string' ? router.query.callbackUrl : '/'

  return (
    <div className="min-h-screen flex items-center justify-center">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          signIn('credentials', { email, password, callbackUrl })
        }}
        className="p-8 bg-white rounded shadow-md w-full max-w-md"
      >
        <h2 className="text-xl font-semibold mb-4">Sign in</h2>
        <label className="block">Email</label>
        <input className="w-full p-2 border mb-3" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="block">Password</label>
        <input className="w-full p-2 border mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <button className="w-full p-2 bg-indigo-600 text-white rounded">Sign in</button>
      </form>
    </div>
  )
}
