import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, formatKes, whatsappLink } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { siteUrl } from "@/lib/site";
import { markAlertNotified, repeatOrder } from "../actions";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance } from "@/lib/types";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const [{ data }, { data: alertRows }, { data: stockRows }] = await Promise.all([
    supabase.from("order_balances").select("*").order("created_at", { ascending: false }).limit(5000),
    supabase.from("stock_alerts").select("id, product_id, name, phone, created_at, products(name)").is("notified_at", null).order("created_at"),
    supabase.from("listings").select("id, product_id").eq("status", "available"),
  ]);
  const rows = (data ?? []) as OrderBalance[];
  type Alert = { id: string; product_id: number; name: string; phone: string; created_at: string; products: { name: string } | null };
  const alerts = (alertRows ?? []) as unknown as Alert[];
  const inStock = new Map<number, string>();
  ((stockRows ?? []) as { id: string; product_id: number }[]).forEach((l) => { if (!inStock.has(l.product_id)) inStock.set(l.product_id, l.id); });
  const byProduct = new Map<number, Alert[]>();
  alerts.forEach((a) => byProduct.set(a.product_id, [...(byProduct.get(a.product_id) ?? []), a]));

  type C = { name: string; org: string | null; phone: string; orders: number; value: number; owes: number; last: string; lastOrderId: string; products: Set<string> };
  const map = new Map<string, C>();
  for (const b of rows) {
    const c = map.get(b.buyer_phone) ?? { name: b.buyer_name, org: b.buyer_org, phone: b.buyer_phone, orders: 0, value: 0, owes: 0, last: b.created_at, lastOrderId: b.order_id, products: new Set<string>() };
    c.orders += 1;
    if (["confirmed", "delivered", "paid"].includes(b.status)) c.value += b.total_kes + b.delivery_fee_kes;
    c.owes += b.buyer_owes_kes;
    if (b.created_at > c.last) { c.last = b.created_at; c.lastOrderId = b.order_id; c.name = b.buyer_name; c.org = b.buyer_org ?? c.org; }
    c.products.add(b.product);
    map.set(b.buyer_phone, c);
  }
  const customers = [...map.values()].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
      {byProduct.size > 0 && (
        <div className="card border-honey-400 bg-amber-50">
          <h2 className="font-semibold">🔔 Waiting for stock ({alerts.length})</h2>
          <p className="mb-2 text-xs text-gray-600">Buyers who asked to be told when a crop is available. When it&apos;s in stock, WhatsApp them, then tap &ldquo;Mark told&rdquo;.</p>
          <div className="space-y-3">
            {[...byProduct.entries()].map(([pid, list]) => {
              const name = list[0].products?.name ?? "Produce";
              const listingId = inStock.get(pid);
              return (
                <div key={pid} className="rounded-lg bg-white p-3 ring-1 ring-amber-200">
                  <p className="font-medium">{productVisual(name).emoji} {name} · {list.length} waiting {listingId ? <span className="ml-1 rounded bg-brand-100 px-1.5 text-xs text-brand-800">in stock now ✓</span> : <span className="ml-1 text-xs text-gray-500">(not in stock yet)</span>}</p>
                  <ul className="mt-1 divide-y text-sm">
                    {list.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                        <span>{a.name} · {displayPhone(a.phone)} <span className="text-xs text-gray-500">since {formatDate(a.created_at)}</span></span>
                        <span className="flex gap-1">
                          <a className="btn-ghost px-2 py-1 text-xs" target="_blank" rel="noopener noreferrer"
                             href={whatsappLink(a.phone, listingId
                               ? `Hello ${a.name}, good news! ${name} is now available on Soko Baringo: ${siteUrl()}/listings/${listingId}`
                               : `Hello ${a.name}, this is Soko Baringo. We'll let you know as soon as ${name} is available.`)}>WhatsApp</a>
                          <form action={markAlertNotified}><input type="hidden" name="id" value={a.id} /><SubmitButton className="btn-ghost px-2 py-1 text-xs">Mark told ✓</SubmitButton></form>
                        </span>
                      </li>
                    ))}
                  </ul>
                  {list.length > 1 && (
                    <form action={markAlertNotified} className="mt-1">{list.map((a) => <input key={a.id} type="hidden" name="id" value={a.id} />)}<SubmitButton className="text-xs text-brand-700 underline">Mark all {list.length} as told</SubmitButton></form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <h1 className="text-xl font-bold">Customers ({customers.length})</h1>
      <p className="text-xs text-gray-500">Every buyer, ranked by lifetime value. Repeat business buyers (hotels, schools, processors) are your most valuable relationships. Keep them stocked.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-2">Customer</th><th>Buys</th><th>Orders</th><th>Lifetime value</th><th>Owes</th><th>Last order</th><th></th></tr></thead>
          <tbody className="divide-y">
            {customers.map((c) => (
              <tr key={c.phone}>
                <td className="py-2"><b>{c.name}</b>{c.org && <div className="text-xs text-gray-500">{c.org}</div>}</td>
                <td className="text-xs">{[...c.products].join(", ")}</td>
                <td>{c.orders}{c.orders > 1 && <span className="ml-1 rounded bg-brand-100 px-1 text-[10px] text-brand-800">repeat</span>}</td>
                <td className="font-semibold">{formatKes(c.value)}</td>
                <td className={c.owes ? "font-semibold text-red-700" : "text-gray-400"}>{c.owes ? formatKes(c.owes) : "—"}</td>
                <td>{formatDate(c.last)}</td>
                <td className="whitespace-nowrap text-right">
                  <a className="btn-ghost px-2 py-1 text-xs" href={`tel:+${c.phone}`}>{displayPhone(c.phone)}</a>{" "}
                  <a className="btn-ghost px-2 py-1 text-xs" target="_blank" rel="noopener noreferrer" href={whatsappLink(c.phone, `Hello ${c.name}, this is Soko Baringo. We have fresh stock this week. Would you like to order?`)}>WhatsApp</a>
                  <ActionForm action={repeatOrder} resetOnSuccess={false} className="mt-1 text-left">
                    <input type="hidden" name="order_id" value={c.lastOrderId} />
                    <SubmitButton className="btn-ghost px-2 py-1 text-xs">🔁 Repeat last order</SubmitButton>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
