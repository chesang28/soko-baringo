import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Soko Baringo — Fresh produce direct from Baringo farmers", template: "%s · Soko Baringo" },
  description: "Buy mangoes, honey and fresh produce directly from farmers in Kabarnet and the Kerio Valley.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#33631f" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900 antialiased">
        <header className="border-b bg-white">
          <nav className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-lg font-bold text-brand-700">Soko Baringo</Link>
            <div className="flex gap-4 text-sm font-medium">
              <Link href="/listings" className="hover:text-brand-700">Buy produce</Link>
              <Link href="/admin" className="text-gray-500 hover:text-brand-700">Agent login</Link>
            </div>
          </nav>
        </header>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-5xl px-4 py-8 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} Soko Baringo · Kabarnet, Baringo County
        </footer>
      </body>
    </html>
  );
}
