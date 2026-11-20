import Link from "next/link";
export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md text-center">
      <h1 className="text-xl font-bold">Not found</h1>
      <p className="mt-2 text-gray-600">This produce may have been sold already.</p>
      <Link href="/listings" className="btn mt-4">Browse produce</Link>
    </div>
  );
}
