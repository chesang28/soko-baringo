import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Soko Baringo · Fresh produce direct from Baringo farmers", template: "%s · Soko Baringo" },
  description: "Buy mangoes, honey and fresh produce directly from verified farmers in Kabarnet and the Kerio Valley. Fair prices for farmers, reliable supply for buyers.",
  openGraph: {
    title: "Soko Baringo · Fresh from Baringo farms",
    description: "Mangoes, honey and more, direct from verified farmers in Baringo County.",
    type: "website",
    locale: "en_KE",
  },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#33631f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col bg-stone-50 text-gray-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-lg" aria-hidden="true">🌿</span>
              <span className="leading-tight">
                <span className="block text-lg font-extrabold text-brand-800">Soko Baringo</span>
                <span className="hidden text-[11px] text-gray-500 sm:block">Farm-fresh from Baringo County</span>
              </span>
            </Link>
            <div className="flex items-center gap-1 text-sm font-medium sm:gap-2">
              <Link href="/listings" className="rounded-lg px-3 py-2 hover:bg-brand-50">Buy produce</Link>
              <Link href="/#sell" className="hidden rounded-lg px-3 py-2 hover:bg-brand-50 sm:block">Sell with us</Link>
              <Link href="/admin" className="rounded-lg px-3 py-2 text-gray-500 hover:bg-gray-100">Agent</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mt-12 border-t bg-white">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-bold text-brand-800">🌿 Soko Baringo</p>
              <p className="mt-2 text-gray-600">Connecting Baringo farmers directly to buyers. Fair prices, fresh produce, less waste.</p>
            </div>
            <div>
              <p className="font-semibold">Buyers</p>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li><Link href="/listings" className="hover:text-brand-700">Browse produce</Link></li>
                <li><Link href="/#faq" className="hover:text-brand-700">How payment works</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">Farmers</p>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li><Link href="/#sell" className="hover:text-brand-700">Sell with us</Link></li>
                <li>Kabarnet · Kerio Valley · Marigat</li>
              </ul>
            </div>
          </div>
          <p className="pb-6 text-center text-xs text-gray-400">© {new Date().getFullYear()} Soko Baringo · Kabarnet, Baringo County, Kenya</p>
        </footer>
      </body>
    </html>
  );
}
