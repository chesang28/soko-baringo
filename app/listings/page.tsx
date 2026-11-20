import Link from "next/link";
import { ListingCard } from "@/components/ListingCard";
import { getAvailableListings, getProducts } from "@/lib/queries";

export const metadata = { title: "Buy produce" };

export default async function ListingsPage({ searchParams }: { searchParams: Promise<{ product?: string }> }) {
  const { product } = await searchParams;
  const productId = Number(product);
  const activeId = Number.isInteger(productId) && productId > 0 ? productId : undefined;

  const [products, listings] = await Promise.all([getProducts(), getAvailableListings({ productId: activeId })]);

  const chip = (active: boolean) =>
    `rounded-full border px-3 py-1 text-sm ${active ? "border-brand-700 bg-brand-700 text-white" : "border-gray-300 bg-white hover:border-brand-600"}`;

  return (
    <div>
      <h1 className="text-2xl font-bold">Available produce</h1>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href="/listings" className={chip(!activeId)}>All</Link>
        {products.map((p) => (
          <Link key={p.id} href={`/listings?product=${p.id}`} className={chip(activeId === p.id)}>{p.name}</Link>
        ))}
      </div>

      {listings.length === 0 ? (
        <p className="card mt-6 text-gray-600">Nothing listed here right now. Check back soon.</p>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  );
}
