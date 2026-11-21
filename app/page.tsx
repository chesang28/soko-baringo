import Link from "next/link";
import { FarmerLeadForm } from "@/components/FarmerLeadForm";
import { JsonLd } from "@/components/JsonLd";
import { siteUrl } from "@/lib/site";
import { CheckIcon, CoinIcon, ShieldIcon, TruckIcon } from "@/components/Icons";
import { ListingCard } from "@/components/ListingCard";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { getDict } from "@/lib/i18n";
import { productVisual } from "@/lib/products";
import { getAvailableListings, getProducts, getSiteStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

type Review = { rating: number; comment: string; buyer: string; product: string; created_at: string };

const Stars = ({ n }: { n: number }) => (
  <span className="text-honey-500" aria-label={`${n} out of 5`}>{"★".repeat(Math.round(n))}<span className="text-gray-300">{"★".repeat(5 - Math.round(n))}</span></span>
);

export default async function HomePage() {
  const supabase = await createClient();
  const [{ t }, listings, products, stats, reviewsRes] = await Promise.all([
    getDict(), getAvailableListings({ limit: 60 }), getProducts(), getSiteStats(), supabase.rpc("public_reviews"),
  ]);
  const reviews = (reviewsRes.data ?? []) as Review[];

  const counts = new Map<number, number>();
  listings.forEach((l) => counts.set(l.product_id, (counts.get(l.product_id) ?? 0) + 1));
  const categories = [...products].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0));
  const heroEmojis = ["🥭", "🍯", "🥑", "🍊"];
  const whyIcons = [<ShieldIcon key="s" className="h-6 w-6" />, <CheckIcon key="c" className="h-6 w-6" />, <CoinIcon key="m" className="h-6 w-6" />, <TruckIcon key="t" className="h-6 w-6" />];

  const statItems: [string | number, string][] = [
    [stats.farmers, t.hero.farmers],
    [stats.wards, t.hero.wards],
    [stats.listings, t.hero.listings],
    stats.review_count > 0 ? [`${stats.avg_rating}★`, t.hero.rating] : [stats.deliveries, t.hero.deliveries],
  ];

  return (
    <div className="space-y-16">
      <section className="relative -mx-4 -mt-6 overflow-hidden bg-gradient-to-br from-brand-800 via-brand-700 to-emerald-700 px-4 py-14 text-white sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-10">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-honey-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 left-10 h-72 w-72 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative grid items-center gap-10 md:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="inline-block rounded-full bg-white/10 px-3 py-1 text-sm text-brand-100 ring-1 ring-white/20">{t.hero.pill}</p>
            <h1 className="mt-4 text-4xl font-extrabold leading-tight sm:text-5xl">
              {t.hero.title1}<br /><span className="text-honey-400">{t.hero.title2}</span>
            </h1>
            <p className="mt-4 max-w-xl text-lg text-brand-100">{t.hero.body}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href="/listings" className="rounded-xl bg-honey-400 px-6 py-3.5 text-base font-bold text-gray-900 shadow-lg shadow-black/10 transition hover:bg-honey-500">{t.hero.buy}</Link>
              <Link href="#sell" className="rounded-xl bg-white/10 px-6 py-3.5 text-base font-semibold ring-1 ring-white/30 transition hover:bg-white/20">{t.hero.farmer}</Link>
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
            {statItems.map(([n, label]) => (
              <div key={label}><dt className="text-sm text-brand-100">{label}</dt><dd className="text-3xl font-extrabold">{n}</dd></div>
            ))}
          </dl>
        )}
      </section>

      <section>
        <h2 className="text-2xl font-bold">{t.shopBy}</h2>
        <div className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-5">
          {categories.map((p) => {
            const v = productVisual(p.name);
            const n = counts.get(p.id) ?? 0;
            return (
              <Link key={p.id} href={`/listings?product=${p.id}`}
                    className={`flex flex-col items-center rounded-2xl border border-gray-200 bg-white p-3 text-center transition hover:border-brand-600 hover:shadow-sm ${n ? "" : "opacity-60"}`}>
                <span className={`flex h-14 w-14 items-center justify-center rounded-2xl text-3xl ${v.tint}`} aria-hidden="true">{v.emoji}</span>
                <span className="mt-2 text-sm font-semibold">{p.name}</span>
                <span className="text-xs text-gray-500">{n ? `${n} ${t.available}` : t.comingSoon}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-2xl font-bold">{t.availableNow}</h2>
          <Link href="/listings" className="text-sm font-semibold text-brand-700">{t.seeAll}</Link>
        </div>
        {listings.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">{t.emptyListings}</p>
        ) : (
          <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.slice(0, 6).map((l) => <ListingCard key={l.id} listing={l} t={t.card} />)}
          </div>
        )}
      </section>

      <section className="flex flex-col items-start justify-between gap-4 rounded-3xl bg-brand-800 p-6 text-white sm:flex-row sm:items-center sm:p-8">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">{t.bulk.title}</h2>
          <p className="mt-1 text-brand-100">{t.bulk.body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Link href="/needs#post" className="rounded-xl bg-honey-400 px-5 py-3 font-bold text-gray-900 hover:bg-honey-500">{t.bulk.cta}</Link>
          {stats.open_needs > 0 && <Link href="/needs" className="rounded-xl px-5 py-3 font-semibold ring-1 ring-white/30 hover:bg-white/10">{t.bulk.see} ({stats.open_needs})</Link>}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        {[{ title: t.how.buyers, tone: "bg-white", steps: t.how.b }, { title: t.how.farmers, tone: "bg-honey-400/15", steps: t.how.f }].map((c) => (
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

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {t.why.map(([title, body], i) => (
          <div key={title} className="rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-100 text-brand-700">{whyIcons[i]}</div>
            <h3 className="mt-3 font-semibold">{title}</h3>
            <p className="mt-1 text-sm text-gray-600">{body}</p>
          </div>
        ))}
      </section>

      {reviews.length > 0 && (
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-2xl font-bold">{t.reviews.title}</h2>
            {stats.avg_rating && <p className="text-sm text-gray-600"><Stars n={stats.avg_rating} /> {stats.avg_rating} · {stats.review_count}</p>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r, i) => (
              <figure key={i} className="rounded-2xl border border-gray-200 bg-white p-5">
                <Stars n={r.rating} />
                <blockquote className="mt-2 text-gray-800">&ldquo;{r.comment}&rdquo;</blockquote>
                <figcaption className="mt-3 text-sm text-gray-500">{r.buyer} · {productVisual(r.product).emoji} {r.product}</figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}

      <section id="sell" className="scroll-mt-24 overflow-hidden rounded-3xl border border-honey-400/40 bg-gradient-to-br from-amber-50 to-white">
        <div className="grid gap-8 p-6 sm:p-10 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wide text-honey-500">{t.sellSection.kicker}</p>
            <h2 className="mt-2 text-3xl font-extrabold">{t.sellSection.title}</h2>
            <p className="mt-3 text-gray-700">{t.sellSection.body}</p>
            <ul className="mt-5 space-y-2 text-gray-700">
              {t.sellSection.points.map((x) => <li key={x} className="flex items-center gap-2"><CheckIcon className="h-5 w-5 text-brand-700" />{x}</li>)}
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-gray-200">
            <h3 className="mb-4 text-lg font-semibold">{t.sellSection.formTitle}</h3>
            <FarmerLeadForm t={t.lead} />
          </div>
        </div>
      </section>

      <section id="faq" className="scroll-mt-24">
        <h2 className="text-2xl font-bold">{t.faq.title}</h2>
        <div className="mt-4 divide-y rounded-2xl border border-gray-200 bg-white">
          {t.faq.items.map(([q, a]) => (
            <details key={q} className="group p-5">
              <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">{q}<span className="text-xl text-brand-700 transition group-open:rotate-45">+</span></summary>
              <p className="mt-2 text-gray-600">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <WhatsAppFab phone={stats.agent_phone} label={t.chat} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "LocalBusiness",
        name: "Soko Baringo",
        description: "Farm produce marketplace connecting Baringo County farmers directly to buyers: mangoes, honey, avocados and more.",
        url: siteUrl(),
        image: `${siteUrl()}/icons/icon-512.png`,
        ...(stats.agent_phone ? { telephone: `+${stats.agent_phone}` } : {}),
        address: { "@type": "PostalAddress", addressLocality: "Kabarnet", addressRegion: "Baringo County", addressCountry: "KE" },
        areaServed: ["Baringo County", "Nakuru", "Eldoret", "Nairobi"],
        ...(stats.review_count > 0 && stats.avg_rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: stats.avg_rating, reviewCount: stats.review_count } } : {}),
      }} />
    </div>
  );
}
