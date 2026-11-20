import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatKes, formatQty } from "@/lib/format";
import { getListing } from "@/lib/queries";
import { requestOrder } from "./actions";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ListingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const listing = await getListing(id);
  if (!listing || listing.status !== "available") notFound();

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div>
        <Link href="/listings" className="text-sm text-brand-700">← All produce</Link>
        <h1 className="mt-2 text-2xl font-bold">{listing.products?.name}</h1>
        <p className="mt-1 text-3xl font-bold text-brand-700">
          {formatKes(listing.price_per_unit_kes)} <span className="text-base font-normal text-gray-500">per {listing.unit}</span>
        </p>
        <dl className="card mt-4 grid grid-cols-2 gap-3 text-sm">
          <dt className="text-gray-500">Available</dt><dd className="font-medium">{formatQty(listing.quantity)} {listing.unit}</dd>
          <dt className="text-gray-500">Pickup area</dt><dd className="font-medium">{listing.location}</dd>
          <dt className="text-gray-500">Ready from</dt><dd className="font-medium">{formatDate(listing.available_from)}</dd>
        </dl>
        {listing.description && <p className="mt-4 whitespace-pre-line text-gray-700">{listing.description}</p>}
      </div>

      <div className="card h-fit">
        <h2 className="text-lg font-semibold">Request to buy</h2>
        <p className="mb-4 text-sm text-gray-600">No payment now — our agent will call to confirm price and delivery.</p>
        <ActionForm action={requestOrder} className="space-y-3">
          <input type="hidden" name="listing_id" value={listing.id} />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div>
            <label className="label" htmlFor="quantity">Quantity ({listing.unit})</label>
            <input className="input" id="quantity" name="quantity" type="number" min="0.01" step="0.01" max={listing.quantity} required />
          </div>
          <div>
            <label className="label" htmlFor="name">Your name</label>
            <input className="input" id="name" name="name" required minLength={2} maxLength={120} autoComplete="name" />
          </div>
          <div>
            <label className="label" htmlFor="phone">Phone (M-Pesa)</label>
            <input className="input" id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required autoComplete="tel" />
          </div>
          <div>
            <label className="label" htmlFor="organisation">Business / organisation (optional)</label>
            <input className="input" id="organisation" name="organisation" maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="note">Note (optional)</label>
            <textarea className="input" id="note" name="note" rows={2} maxLength={500} placeholder="Delivery town, preferred date…" />
          </div>
          <SubmitButton className="btn w-full">Send request</SubmitButton>
        </ActionForm>
      </div>
    </div>
  );
}
