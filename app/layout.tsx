import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { getDict } from "@/lib/i18n";
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

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { lang, t } = await getDict();
  return (
    <html lang={lang}>
      <body className="flex min-h-screen flex-col bg-stone-50 text-gray-900 antialiased">
        <header className="sticky top-0 z-30 border-b border-gray-200/80 bg-white/90 backdrop-blur print:hidden">
          <nav className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3">
            <Link href="/" className="flex shrink-0 items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-700 text-lg" aria-hidden="true">🌿</span>
              <span className="leading-tight">
                <span className="block text-lg font-extrabold text-brand-800">Soko Baringo</span>
                <span className="hidden text-[11px] text-gray-500 sm:block">{t.tagline}</span>
              </span>
            </Link>
            <div className="flex items-center gap-0.5 text-sm font-medium sm:gap-1">
              <Link href="/listings" className="rounded-lg px-2.5 py-2 hover:bg-brand-50">{t.nav.buy}</Link>
              <Link href="/needs" className="hidden rounded-lg px-2.5 py-2 hover:bg-brand-50 md:block">{t.nav.needs}</Link>
              <Link href="/prices" className="hidden rounded-lg px-2.5 py-2 hover:bg-brand-50 md:block">{t.nav.prices}</Link>
              <Link href="/#sell" className="hidden rounded-lg px-2.5 py-2 hover:bg-brand-50 lg:block">{t.nav.sell}</Link>
              <a href={`/lang?to=${lang === "en" ? "sw" : "en"}`} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold hover:bg-gray-50"
                 aria-label={lang === "en" ? "Badilisha lugha kuwa Kiswahili" : "Switch language to English"}>
                {lang === "en" ? "SW" : "EN"}
              </a>
              <Link href="/admin" className="rounded-lg px-2.5 py-2 text-gray-500 hover:bg-gray-100">{t.nav.agent}</Link>
            </div>
          </nav>
          <div className="flex gap-1 overflow-x-auto border-t px-4 py-1.5 text-sm md:hidden">
            <Link href="/needs" className="whitespace-nowrap rounded-lg px-2.5 py-1 hover:bg-brand-50">{t.nav.needs}</Link>
            <Link href="/prices" className="whitespace-nowrap rounded-lg px-2.5 py-1 hover:bg-brand-50">{t.nav.prices}</Link>
            <Link href="/#sell" className="whitespace-nowrap rounded-lg px-2.5 py-1 hover:bg-brand-50">{t.nav.sell}</Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
        <footer className="mt-12 border-t bg-white print:hidden">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
            <div>
              <p className="font-bold text-brand-800">🌿 Soko Baringo</p>
              <p className="mt-2 text-gray-600">{t.footer.about}</p>
            </div>
            <div>
              <p className="font-semibold">{t.footer.buyers}</p>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li><Link href="/listings" className="hover:text-brand-700">{t.footer.browse}</Link></li>
                <li><Link href="/needs" className="hover:text-brand-700">{t.footer.post}</Link></li>
                <li><Link href="/#faq" className="hover:text-brand-700">{t.footer.payment}</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold">{t.footer.farmers}</p>
              <ul className="mt-2 space-y-1 text-gray-600">
                <li><Link href="/#sell" className="hover:text-brand-700">{t.nav.sell}</Link></li>
                <li><Link href="/prices" className="hover:text-brand-700">{t.footer.prices}</Link></li>
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
