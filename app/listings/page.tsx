import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { productVisual } from "@/lib/products";
import { getAvailableListings, getProducts } from "@/lib/queries";

export const metadata = { title: "Buy produce" };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const productId = Number(product);
  const activeId = Number.isInteger(productId) && productId > 0 ? productId : undefined;

  const [products, listings] = await Promise.all([getProducts(), getAvailableListings({ productId: activeId })]);
  const active = products.find((p) => p.id === activeId);

  const chip = (on: boolean) =>
    `flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white hover:border-brand-600"}`;

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{active ? `${productVisual(active.name).emoji} ${active.name}` : "Fresh produce"}</h1>
      <p className="mt-1 text-gray-600">Direct from verified farmers in Baringo County. Send a request and we&apos;ll call you to confirm.</p>

      <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-2">
        <Link href="/listings" className={chip(!activeId)}>All</Link>
        {products.map((p) => (
          <Link key={p.id} href={`/listings?product=${p.id}`} className={chip(activeId === p.id)}>
            <span aria-hidden="true">{productVisual(p.name).emoji}</span>{p.name}
          </Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-10 text-center">
          <p className="text-4xl" aria-hidden="true">🧺</p>
          <p className="mt-2 font-semibold">Nothing listed here right now</p>
          <p className="text-sm text-gray-600">New harvests are added every week. Check back soon.</p>
        </div>
      ) : (
        <>
          <p className="mt-4 text-sm text-gray-500">{listings.length} listing{listings.length > 1 ? "s" : ""} available</p>
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
          </div>
        </>
      )}
    </div>
  );
}
