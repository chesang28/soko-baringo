import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { getAvailableListings } from "@/lib/queries";

export default async function HomePage() {
  const listings = await getAvailableListings({ limit: 6 });

  return (
    <div className="space-y-10">
      <section className="rounded-2xl bg-brand-700 px-6 py-10 text-white">
        <h1 className="text-3xl font-bold sm:text-4xl">Fresh from Baringo farms, straight to you.</h1>
        <p className="mt-3 max-w-xl text-brand-100">
          Mangoes from the Kerio Valley, pure Baringo honey and more — sourced directly from local farmers.
          Fair prices for farmers, reliable supply for buyers.
        </p>
        <Link href="/listings" className="mt-6 inline-block rounded-lg bg-honey-400 px-5 py-3 font-semibold text-gray-900 hover:bg-honey-500">
          Browse available produce
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          ["1. Browse", "See what farmers have ready, with quantity, price and pickup area."],
          ["2. Request", "Send a buy request with the quantity you need. No account required."],
          ["3. We deliver", "Our agent confirms with you and arranges collection or transport."],
        ].map(([title, body]) => (
          <div key={title} className="card">
            <h2 className="font-semibold text-brand-700">{title}</h2>
            <p className="mt-1 text-sm text-gray-600">{body}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-xl font-bold">Latest produce</h2>
          <Link href="/listings" className="text-sm font-medium text-brand-700">See all →</Link>
        </div>
        {listings.length === 0 ? (
          <p className="card text-gray-600">New harvests are being added — check back soon.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        )}
      </section>
    </div>
  );
}
