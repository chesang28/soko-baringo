import Link from "next/link";
import type { Dict } from "@/lib/i18n";
import type { Listing } from "@/lib/types";
import { formatDate, formatKes, formatQty } from "@/lib/format";
import { photoUrl } from "@/lib/photos";
import { productVisual } from "@/lib/products";
import { PinIcon, ShieldIcon } from "./Icons";

export function GradeBadge({ grade, label }: { grade: string | null; label: string }) {
  if (!grade) return null;
  const tone = grade === "A" ? "bg-honey-400 text-gray-900" : grade === "B" ? "bg-white text-gray-800" : "bg-gray-200 text-gray-700";
  return <span className={`rounded-full px-2.5 py-1 text-xs font-bold shadow-sm ${tone}`}>{label} {grade}</span>;
}

export function ListingCard({ listing, t }: { listing: Listing; t: Dict["card"] }) {
  const name = listing.products?.name ?? "Produce";
  const { emoji, tint } = productVisual(name);
  const readyNow = new Date(listing.available_from) <= new Date();
  const photo = photoUrl(listing.photo_path);

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-brand-600 hover:shadow-md"
    >
      <div className={`relative flex h-40 items-center justify-center overflow-hidden ${tint}`}>
        {photo
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={photo} alt={name} loading="lazy" className="h-full w-full object-cover transition group-hover:scale-105" />
          : <span className="text-6xl drop-shadow-sm transition group-hover:scale-110" aria-hidden="true">{emoji}</span>}
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${readyNow ? "bg-brand-700 text-white" : "bg-white/90 text-gray-700"}`}>
          {readyNow ? t.readyNow : `${t.ready} ${formatDate(listing.available_from)}`}
        </span>
        <span className="absolute right-3 top-3"><GradeBadge grade={listing.grade} label={t.grade} /></span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-semibold">{name}</h3>
          <p className="whitespace-nowrap text-right">
            <span className="text-lg font-bold text-brand-700">{formatKes(listing.price_per_unit_kes)}</span>
            <span className="block text-xs text-gray-500">{t.per} {listing.unit}</span>
          </p>
        </div>
        <p className="mt-1 text-sm text-gray-600">{formatQty(listing.quantity)} {listing.unit} {t.available}</p>
        <div className="mt-auto flex items-center justify-between gap-2 pt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1 truncate"><PinIcon className="h-4 w-4" />{listing.location}</span>
          <span className="flex shrink-0 items-center gap-1 text-brand-700"><ShieldIcon className="h-4 w-4" />{t.verified}</span>
        </div>
      </div>
    </Link>
  );
}
