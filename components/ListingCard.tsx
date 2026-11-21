import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatDate, formatKes, formatQty } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { PinIcon, ShieldIcon } from "./Icons";

export function ListingCard({ listing }: { listing: Listing }) {
  const name = listing.products?.name ?? "Produce";
  const { emoji, tint } = productVisual(name);
  const readyNow = new Date(listing.available_from) <= new Date();

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md"
    >
      <div className={`relative flex h-32 items-center justify-center ${tint}`}>
        <span className="text-6xl drop-shadow-sm transition group-hover:scale-110" aria-hidden="true">{emoji}</span>
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold ${readyNow ? "bg-brand-700 text-white" : "bg-white/90 text-gray-700"}`}>
          {readyNow ? "Ready now" : `Ready ${formatDate(listing.available_from)}`}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="whitespace-nowrap text-right">
            <span className="text-lg font-bold text-brand-700">{formatKes(listing.price_per_unit_kes)}</span>
            <span className="block text-xs text-gray-500">per {listing.unit}</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-gray-600">{formatQty(listing.quantity)} {listing.unit} available</p>
        <div className="mt-auto flex items-center justify-between pt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1"><PinIcon className="h-4 w-4" />{listing.location}</span>
          <span className="flex items-center gap-1 text-brand-700"><ShieldIcon className="h-4 w-4" />Verified farmer</span>
        </div>
      </div>
    </Link>
  );
}
