import Link from "next/link";
import { StatusBadge } from "@/components/StatusBadge";
import { formatDate, formatKes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";

export default async function AdminHome() {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;

  const [farmers, listings, newOrders, earnings, recent] = await Promise.all([
    supabase.from("farmers").select("id", head),
    supabase.from("listings").select("id", head).eq("status", "available"),
    supabase.from("orders").select("id", head).eq("status", "new"),
    supabase.from("orders").select("commission_kes").eq("status", "paid"),
    supabase.from("orders")
      .select("id, buyer_name, quantity, status, created_at, listings(unit, products(name))")
      .order("created_at", { ascending: false }).limit(8),
  ]);

  const earned = (earnings.data ?? []).reduce((s, o) => s + (o.commission_kes ?? 0), 0);
  const stats = [
    ["Farmers", farmers.count ?? 0],
    ["Live listings", listings.count ?? 0],
    ["New requests", newOrders.count ?? 0],
    ["Commission earned", formatKes(earned)],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/admin/farmers" className="btn">+ Register farmer</Link>
        <Link href="/admin/listings" className="btn">+ Add produce</Link>
      </div>
      <div className="card">
        <h2 className="mb-3 font-semibold">Latest buy requests</h2>
        <ul className="divide-y">
          {((recent.data ?? []) as unknown as Order[]).map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2 text-sm">
              <span>{o.buyer_name} · {o.quantity} {o.listings?.unit} {o.listings?.products?.name}</span>
              <span className="flex items-center gap-2 text-gray-500">{formatDate(o.created_at)} <StatusBadge status={o.status} /></span>
            </li>
          ))}
          {!recent.data?.length && <li className="py-2 text-sm text-gray-500">No requests yet.</li>}
        </ul>
      </div>
    </div>
  );
}
