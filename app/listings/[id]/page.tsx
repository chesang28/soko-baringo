import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PinIcon, ShieldIcon, TruckIcon } from "@/components/Icons";
import { OrderForm } from "@/components/OrderForm";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty, isUuid } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { getListing, getSiteStats } from "@/lib/queries";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  if (!isUuid(id)) return {};
  const l = await getListing(id);
  if (!l) return {};
  return { title: `${l.products?.name} · ${formatKes(l.price_per_unit_kes)}/${l.unit}`, description: `${formatQty(l.quantity)} ${l.unit} of ${l.products?.name} available in ${l.location}, Baringo.` };
}

export default async function ListingPage({ params }: Props) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [listing, stats] = await Promise.all([getListing(id), getSiteStats()]);
  if (!listing || listing.status !== "available") notFound();

  const name = listing.products?.name ?? "Produce";
  const { emoji, tint } = productVisual(name);
  const readyNow = new Date(listing.available_from) <= new Date();

  return (
    <div>
      <Link href="/listings" className="text-sm font-medium text-brand-700">← All produce</Link>
      <div className="mt-4 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <div className={`flex h-64 items-center justify-center rounded-3xl ${tint}`}>
            <span className="text-9xl drop-shadow" aria-hidden="true">{emoji}</span>
          </div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-3xl font-extrabold">{name}</h1>
              <p className="mt-1 flex items-center gap-1 text-gray-600"><PinIcon className="h-4 w-4" />{listing.location}, Baringo</p>
            </div>
            <p className="text-right">
              <span className="text-4xl font-extrabold text-brand-700">{formatKes(listing.price_per_unit_kes)}</span>
              <span className="block text-sm text-gray-500">per {listing.unit}</span>
            </p>
          </div>
          <dl className="mt-6 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">Available</dt><dd className="mt-1 font-bold">{formatQty(listing.quantity)} {listing.unit}</dd></div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">Ready</dt><dd className="mt-1 font-bold">{readyNow ? "Now" : formatDate(listing.available_from)}</dd></div>
            <div className="rounded-2xl bg-white p-4 ring-1 ring-gray-200"><dt className="text-xs text-gray-500">Pickup</dt><dd className="mt-1 truncate font-bold">{listing.location}</dd></div>
          </dl>
          {listing.description && <p className="mt-6 whitespace-pre-line text-gray-700">{listing.description}</p>}
          <ul className="mt-6 space-y-2 text-sm text-gray-700">
            <li className="flex items-center gap-2"><ShieldIcon className="h-5 w-5 text-brand-700" />Verified farmer, registered in person by our agent</li>
            <li className="flex items-center gap-2"><TruckIcon className="h-5 w-5 text-brand-700" />Pickup in {listing.location} or delivery to your town</li>
          </ul>
        </div>

        <div className="h-fit rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 lg:sticky lg:top-24">
          <h2 className="mb-4 text-xl font-bold">Request to buy</h2>
          <OrderForm listingId={listing.id} product={name} unit={listing.unit} maxQty={Number(listing.quantity)}
                     price={listing.price_per_unit_kes} agentPhone={stats.agent_phone} />
        </div>
      </div>
      <WhatsAppFab phone={stats.agent_phone} />
    </div>
  );
}
