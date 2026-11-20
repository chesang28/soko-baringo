import Link from "next/link";
import type { Listing } from "@/lib/types";
import { formatDate, formatKes, formatQty } from "@/lib/format";

export function ListingCard({ listing }: { listing: Listing }) {
  return (
    <Link href={`/listings/${listing.id}`} className="card block transition hover:border-brand-600">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold">{listing.products?.name ?? "Produce"}</h3>
        <span className="whitespace-nowrap font-bold text-brand-700">
          {formatKes(listing.price_per_unit_kes)}<span className="text-xs font-normal text-gray-500">/{listing.unit}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600">
        {formatQty(listing.quantity)} {listing.unit} · {listing.location}
      </p>
      <p className="mt-2 text-xs text-gray-500">Available from {formatDate(listing.available_from)}</p>
    </Link>
  );
}
