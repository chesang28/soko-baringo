import { displayPhone, formatDate, formatKes, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance } from "@/lib/types";

export const metadata = { title: "Customers" };

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("order_balances").select("*").limit(5000);
  const rows = (data ?? []) as OrderBalance[];

  type C = { name: string; org: string | null; phone: string; orders: number; value: number; owes: number; last: string; products: Set<string> };
  const map = new Map<string, C>();
  for (const b of rows) {
    const c = map.get(b.buyer_phone) ?? { name: b.buyer_name, org: b.buyer_org, phone: b.buyer_phone, orders: 0, value: 0, owes: 0, last: b.created_at, products: new Set<string>() };
    c.orders += 1;
    if (["confirmed", "delivered", "paid"].includes(b.status)) c.value += b.total_kes + b.delivery_fee_kes;
    c.owes += b.buyer_owes_kes;
    if (b.created_at > c.last) { c.last = b.created_at; c.name = b.buyer_name; c.org = b.buyer_org ?? c.org; }
    c.products.add(b.product);
    map.set(b.buyer_phone, c);
  }
  const customers = [...map.values()].sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-4">
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
