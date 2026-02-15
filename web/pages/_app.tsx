import '../styles/globals.css'
import type { AppProps } from 'next/app'
import SiteHeader from '../components/SiteHeader'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <SiteHeader />
      <Component {...pageProps} />
    </>
  )
}
