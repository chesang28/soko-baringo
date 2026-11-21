import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, formatKes, formatQty, isUuid, orderRef } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { assignToRun, removeFromRun, updateRun } from "../../actions";

type RunOrder = {
  id: string; buyer_name: string; buyer_phone: string; buyer_org: string | null; quantity: number; note: string | null; status: string; delivery_fee_kes: number;
  listings: { unit: string; location: string; products: { name: string } | null; farmers: { full_name: string; phone: string; ward: string } | null } | null;
};
const SEL = "id, buyer_name, buyer_phone, buyer_org, quantity, note, status, delivery_fee_kes, listings(unit, location, products(name), farmers(full_name, phone, ward))";

export default async function RunPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: run }, { data: onRun }, { data: candidates }] = await Promise.all([
    supabase.from("delivery_runs").select("*").eq("id", id).maybeSingle(),
    supabase.from("orders").select(SEL).eq("run_id", id).order("created_at"),
    supabase.from("orders").select(SEL).is("run_id", null).in("status", ["confirmed", "contacted"]).order("created_at").limit(100),
  ]);
  if (!run) notFound();
  const orders = (onRun ?? []) as unknown as RunOrder[];
  const pending = (candidates ?? []) as unknown as RunOrder[];
  const fees = orders.reduce((s, o) => s + o.delivery_fee_kes, 0);

  const pickups = new Map<string, { farmer: NonNullable<NonNullable<RunOrder["listings"]>["farmers"]>; location: string; items: string[] }>();
  for (const o of orders) {
    const f = o.listings?.farmers; if (!f) continue;
    const k = f.phone;
    const p = pickups.get(k) ?? { farmer: f, location: o.listings!.location, items: [] };
    p.items.push(`${formatQty(o.quantity)} ${o.listings?.unit} ${o.listings?.products?.name} (${orderRef(o.id)})`);
    pickups.set(k, p);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/admin/runs" className="text-sm text-brand-700 print:hidden">← All runs</Link>
          <h1 className="text-2xl font-bold">Truck run · {formatDate(run.run_date)}</h1>
          <p className="text-gray-600">{run.route}{run.vehicle ? ` · ${run.vehicle}` : ""}{run.driver_name ? ` · Driver ${run.driver_name}` : ""}{run.driver_phone ? ` (${displayPhone(run.driver_phone)})` : ""}</p>
          <p className="text-sm text-gray-600">{orders.length} orders · delivery fees {formatKes(fees)} · trip cost {formatKes(run.cost_kes)} · <b className={fees - run.cost_kes >= 0 ? "text-brand-700" : "text-red-700"}>profit {formatKes(fees - run.cost_kes)}</b></p>
        </div>
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <form action={updateRun} className="flex items-center gap-1">
            <input type="hidden" name="id" value={run.id} />
            <select name="status" defaultValue={run.status} className="input py-1 text-sm"><option value="planned">planned</option><option value="on_route">on route</option><option value="done">done</option></select>
            <input name="cost_kes" type="number" min="0" defaultValue={run.cost_kes} className="input w-24 py-1 text-sm" aria-label="Trip cost" />
            <SubmitButton className="btn-ghost">Save</SubmitButton>
          </form>
          <PrintButton label="Print run sheet" />
        </div>
      </div>

      <section className="card">
        <h2 className="mb-2 font-semibold">1. Pickups (from farmers)</h2>
        {pickups.size === 0 ? <p className="text-sm text-gray-500">No orders on this run yet.</p> : (
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            {[...pickups.values()].map((p) => (
              <li key={p.farmer.phone}><b>{p.farmer.full_name}</b>, {p.location} ({p.farmer.ward}) · {displayPhone(p.farmer.phone)}<br /><span className="text-gray-600">{p.items.join("; ")}</span></li>
            ))}
          </ol>
        )}
      </section>

      <section className="card">
        <h2 className="mb-2 font-semibold">2. Drop-offs (to buyers)</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-1">Ref</th><th>Buyer</th><th>Goods</th><th>Delivery note</th><th>Fee</th><th className="print:hidden"></th></tr></thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="py-2 font-mono text-xs">{orderRef(o.id)}</td>
                <td><b>{o.buyer_name}</b>{o.buyer_org ? `, ${o.buyer_org}` : ""}<div className="text-xs">{displayPhone(o.buyer_phone)}</div></td>
                <td>{formatQty(o.quantity)} {o.listings?.unit} {o.listings?.products?.name}</td>
                <td className="text-xs">{o.note ?? "—"}</td>
                <td>{formatKes(o.delivery_fee_kes)}</td>
                <td className="print:hidden">
                  <form action={removeFromRun}><input type="hidden" name="order_id" value={o.id} /><input type="hidden" name="run_id" value={run.id} /><SubmitButton className="btn-ghost px-2 py-1 text-xs">Remove</SubmitButton></form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 hidden text-xs print:block">Driver signature: ____________________ &nbsp; Date: ____________</p>
      </section>

      {pending.length > 0 && (
        <form action={assignToRun} className="card print:hidden">
          <input type="hidden" name="run_id" value={run.id} />
          <h2 className="mb-2 font-semibold">Add orders to this run</h2>
          <ul className="max-h-80 divide-y overflow-y-auto text-sm">
            {pending.map((o) => (
              <li key={o.id} className="py-1.5">
                <label className="flex items-center gap-2">
                  <input type="checkbox" name="order_id" value={o.id} />
                  <span className="font-mono text-xs">{orderRef(o.id)}</span> {o.buyer_name} · {formatQty(o.quantity)} {o.listings?.unit} {o.listings?.products?.name} · from {o.listings?.location}
                  {o.note && <span className="text-xs text-gray-500">· “{o.note}”</span>}
                </label>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex items-end gap-2">
            <label className="flex flex-col gap-1 text-xs text-gray-600">Delivery fee per order (KES, optional)<input name="delivery_fee_kes" type="number" min="0" className="input w-40 py-1 text-sm" /></label>
            <SubmitButton className="btn">Add selected</SubmitButton>
          </div>
        </form>
      )}
    </div>
  );
}
