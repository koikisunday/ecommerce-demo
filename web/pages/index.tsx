import Head from 'next/head'
import dynamic from 'next/dynamic'

const ThreeBackground = dynamic(() => import('../components/ThreeBackground'), { ssr: false })

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <Head>
        <title>E-commerce Demo</title>
      </Head>

      <ThreeBackground />

      <main className="z-10 p-8 text-center">
        <h1 className="text-4xl font-bold">Welcome to your multi-vendor store</h1>
        <p className="mt-4 text-gray-600">Demo with Paystack sandbox and 3D background</p>
      </main>
    </div>
  )
}
