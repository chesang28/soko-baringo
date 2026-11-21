import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PinIcon, ShieldIcon, TruckIcon } from "@/components/Icons";
import { JsonLd } from "@/components/JsonLd";
import { GradeBadge } from "@/components/ListingCard";
import { siteUrl } from "@/lib/site";
import { OrderForm } from "@/components/OrderForm";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty, isUuid } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { photoUrl } from "@/lib/photos";
import { productVisual } from "@/lib/products";
import { getListing, getSiteStats } from "@/lib/queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const l = await getListing(id);
  if (!l) return {};
  const img = photoUrl(l.photo_path);
  return {
    title: `${l.products?.name} · ${formatKes(l.price_per_unit_kes)}/${l.unit}`,
    description: `${formatQty(l.quantity)} ${l.unit} of ${l.products?.name} available in ${l.location}, Baringo.`,
    openGraph: img ? { images: [img] } : undefined,
  };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [{ t }, listing, stats] = await Promise.all([getDict(), getListing(id), getSiteStats()]);
  if (!listing || listing.status !== "available") notFound();

  const name = listing.products?.name ?? "Produce";
  const { emoji, tint } = productVisual(name);
  const readyNow = new Date(listing.available_from) <= new Date();
  const photo = photoUrl(listing.photo_path);
  const gradeText = listing.grade === "A" ? t.detail.gradeA : listing.grade === "B" ? t.detail.gradeB : listing.grade === "C" ? t.detail.gradeC : null;

  return (
    <div>
      <Link href="/listings" className="text-sm font-medium text-brand-700">{t.detail.back}</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className={`relative flex h-72 items-center justify-center overflow-hidden rounded-3xl ${tint}`}>
            {photo
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={photo} alt={name} className="h-full w-full object-cover" />
              : <span className="text-9xl drop-shadow" aria-hidden="true">{emoji}</span>}
            <span className="absolute right-4 top-4"><GradeBadge grade={listing.grade} label={t.card.grade} /></span>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold">{name}</h1>
              <p className="mt-1 flex items-center gap-1 text-gray-600"><PinIcon className="h-4 w-4" />{listing.location}, Baringo</p>
            </div>
            <p className="text-right">
              <span className="text-4xl font-extrabold text-brand-700">{formatKes(listing.price_per_unit_kes)}</span>
              <span className="block text-sm text-gray-500">{t.card.per} {listing.unit}</span>
            </p>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">{t.detail.available}</dt><dd className="mt-1 font-bold">{formatQty(listing.quantity)} {listing.unit}</dd></div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">{t.detail.ready}</dt><dd className="mt-1 font-bold">{readyNow ? t.detail.now : formatDate(listing.available_from)}</dd></div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">{t.detail.pickup}</dt><dd className="mt-1 truncate font-bold">{listing.location}</dd></div>
          </dl>
          {listing.description && <p className="mt-6 whitespace-pre-line text-gray-700">{listing.description}</p>}
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            {gradeText && <li className="flex items-center gap-2"><span className="w-5 text-center text-honey-500">★</span>{gradeText}</li>}
            <li className="flex items-center gap-2"><ShieldIcon className="h-5 w-5 text-brand-700" />{t.detail.verified}</li>
            <li className="flex items-center gap-2"><TruckIcon className="h-5 w-5 text-brand-700" />{t.detail.pickup}: {listing.location} {t.detail.delivery}</li>
          </ul>
        </div>
        <div className="h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 lg:sticky lg:top-24">
          <h2 className="mb-4 text-xl font-bold">{t.detail.request}</h2>
          <OrderForm listingId={listing.id} product={name} unit={listing.unit} maxQty={Number(listing.quantity)}
                     price={listing.price_per_unit_kes} agentPhone={stats.agent_phone} t={t.order} />
        </div>
      </div>
      <WhatsAppFab phone={stats.agent_phone} label={t.chat} />
      <JsonLd data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: `${name} from ${listing.location}, Baringo`,
        description: listing.description ?? `${name} direct from a verified farmer in ${listing.location}, Baringo County, Kenya.`,
        ...(photo ? { image: photo } : {}),
        category: "Fresh produce",
        brand: { "@type": "Brand", name: "Soko Baringo" },
        offers: {
          "@type": "Offer",
          url: `${siteUrl()}/listings/${listing.id}`,
          priceCurrency: "KES",
          price: listing.price_per_unit_kes,
          availability: "https://schema.org/InStock",
          eligibleQuantity: { "@type": "QuantitativeValue", maxValue: Number(listing.quantity), unitText: listing.unit },
          areaServed: "KE",
        },
      }} />
    </div>
  );
}
