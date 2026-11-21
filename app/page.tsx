import Link from "next/link";
import { FarmerLeadForm } from "@/components/FarmerLeadForm";
import { CoinIcon, ShieldIcon, TruckIcon, CheckIcon } from "@/components/Icons";
import { ListingCard } from "@/components/ListingCard";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { productVisual } from "@/lib/products";
import { getAvailableListings, getProducts, getSiteStats } from "@/lib/queries";

const FAQ = [
  ["How do I pay?", "You don't pay when you send a request. Our agent calls to confirm the price, quantity and delivery, then you pay by M-Pesa or cash as agreed."],
  ["Can you deliver outside Baringo?", "Yes. Put your town in the request note and we'll quote transport to places like Nakuru, Eldoret or Nairobi."],
  ["Is there a minimum order?", "No. We serve households, traders, hotels and processors. Bulk orders get the best prices."],
  ["How do farmers get paid?", "Farmers receive their share by M-Pesa after delivery. Soko Baringo keeps a small 5% service fee, so farmers keep 95% of the sale."],
];

export default async function HomePage() {
  const [listings, products, stats] = await Promise.all([getAvailableListings({ limit: 60 }), getProducts(), getSiteStats()]);

  const counts = new Map<number, number>();
  listings.forEach((l) => counts.set(l.product_id, (counts.get(l.product_id) ?? 0) + 1));
  const categories = [...products].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  const heroEmojis = ["🥭", "🍯", "🥑", "🍊"];

  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="relative -mx-4 -mt-6 overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-emerald-700 px-4 py-14 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-honey-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-brand-100 ring-1 ring-white/20">Kabarnet · Kerio Valley · Marigat</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              Fresh from Baringo farms.<br /><span className="text-honey-400">Fair for every farmer.</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">
              Buy mangoes, pure Baringo honey and more straight from verified local farmers. No middlemen, no waste, honest prices.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/listings" className="rounded-xl bg-honey-400 px-6 py-3.5 text-base font-bold text-gray-900 shadow-lg shadow-black/10 transition hover:bg-honey-500">
                Buy produce →
              </Link>
              <Link href="#sell" className="rounded-xl bg-white/10 px-6 py-3.5 text-base font-semibold ring-1 ring-white/30 transition hover:bg-white/20">
                I&apos;m a farmer
              </Link>
            </div>
          </div>
          <div className="hidden grid-cols-2 gap-4 md:grid" aria-hidden="true">
            {heroEmojis.map((e, i) => (
              <div key={e} className={`flex aspect-square items-center justify-center rounded-3xl bg-white/10 text-7xl ring-1 ring-white/15 backdrop-blur ${i % 2 ? "translate-y-6" : ""}`}>{e}</div>
            ))}
          </div>
        </div>
        {stats.farmers > 0 && (
          <dl className="relative mt-12 grid grid-cols-2 gap-4 border-t border-white/15 pt-6 sm:grid-cols-4">
            {[
              [stats.farmers, "Verified farmers"],
              [stats.wards, stats.wards === 1 ? "Ward served" : "Wards served"],
              [stats.listings, "Listings live now"],
              [stats.deliveries, "Deliveries made"],
            ].map(([n, label]) => (
              <div key={label as string}>
                <dt className="text-sm text-brand-100">{label}</dt>
                <dd className="text-3xl font-extrabold">{n}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {/* Categories */}
      <section>
        <h2 className="text-2xl font-bold">Shop by produce</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {categories.map((p) => {
            const v = productVisual(p.name);
            const n = counts.get(p.id) ?? 0;
            return (
              <Link key={p.id} href={`/listings?product=${p.id}`}
                    className={`flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-3 text-center transition hover:border-brand-600 hover:shadow-sm ${n ? "" : "opacity-60"}`}>
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${v.tint}`} aria-hidden="true">{v.emoji}</span>
                <span className="mt-2 text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-gray-500">{n ? `${n} available` : "Coming soon"}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Latest */}
      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">Available now</h2>
          <Link href="/listings" className="text-sm font-semibold text-brand-700">See all →</Link>
        </div>
        {listings.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">New harvests are being added. Check back soon.</p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>

      {/* How it works */}
      <section className="grid gap-6 md:grid-cols-2">
        {[
          { title: "For buyers", tone: "bg-white", steps: ["Browse fresh produce with clear prices", "Send a request. No account, no upfront payment", "We confirm by phone and arrange delivery", "Receive and pay by M-Pesa or cash"] },
          { title: "For farmers", tone: "bg-honey-400/15", steps: ["An agent visits and registers you for free", "We list your harvest and find buyers", "We arrange collection and transport", "You get paid by M-Pesa and keep 95%"] },
        ].map((c) => (
          <div key={c.title} className={`rounded-3xl border border-gray-200 p-6 ${c.tone}`}>
            <h3 className="text-xl font-bold">{c.title}</h3>
            <ol className="mt-4 space-y-3">
              {c.steps.map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-700 text-sm font-bold text-white">{i + 1}</span>
                  <span className="pt-0.5 text-gray-700">{s}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>

      {/* Why */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { icon: <ShieldIcon className="h-6 w-6" />, title: "Verified farmers", body: "Every farmer is visited and registered by our agent." },
          { icon: <CheckIcon className="h-6 w-6" />, title: "Straight from the farm", body: "Harvested to order, so produce arrives fresher." },
          { icon: <CoinIcon className="h-6 w-6" />, title: "Fair, clear prices", body: "Farmers keep 95% of every sale. You pay no hidden markups." },
          { icon: <TruckIcon className="h-6 w-6" />, title: "Delivery arranged", body: "Pickup in Baringo or transport to your town." },
        ].map((f) => (
          <div key={f.title} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{f.icon}</div>
            <h3 className="mt-3 font-semibold">{f.title}</h3>
            <p className="mt-1 text-sm text-gray-600">{f.body}</p>
          </div>
        ))}
      </section>

      {/* Farmers */}
      <section id="sell" className="scroll-mt-24 overflow-hidden rounded-3xl border border-honey-400/40 bg-gradient-to-br from-amber-50 to-white">
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-honey-500">For farmers</p>
            <h2 className="mt-2 text-3xl font-extrabold">Sell your harvest at a fair price</h2>
            <p className="mt-3 text-gray-700">Stop losing mangoes to rot and honey to low middleman prices. We bring the buyers. You keep 95%.</p>
            <ul className="mt-5 space-y-2 text-gray-700">
              {["Free registration. No smartphone needed", "Paid by M-Pesa after delivery", "Group and co-op harvests welcome"].map((t) => (
                <li key={t} className="flex items-center gap-2"><CheckIcon className="h-5 w-5 text-brand-700" />{t}</li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-4 text-lg font-semibold">Leave your details and we&apos;ll visit you</h3>
            <FarmerLeadForm />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-24">
        <h2 className="text-2xl font-bold">Questions</h2>
        <div className="mt-4 divide-y rounded-2xl border border-gray-200 bg-white">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
                {q}<span className="text-xl text-brand-700 transition group-open:rotate-45">+</span>
              </summary>
              <p className="mt-2 text-gray-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <WhatsAppFab phone={stats.agent_phone} />
    </div>
  );
}
