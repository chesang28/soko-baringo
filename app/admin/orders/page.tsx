import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUSES, type Order } from "@/lib/types";
import { updateOrder } from "../actions";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const overdueOnly = filter === "overdue";

  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, listing_id, buyer_name, buyer_phone, buyer_org, quantity, note, status, agreed_total_kes, commission_kes, created_at, listings(unit, location, products(name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (overdueOnly) q = q.eq("status", "new").lt("created_at", new Date(Date.now() - DAY_MS).toISOString());
  const { data } = await q;
  const orders = (data ?? []) as unknown as Order[];
  const now = Date.now();

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{overdueOnly ? "Overdue requests (24h+)" : "Buy requests"}</h1>
        {overdueOnly && <a href="/admin/orders" className="text-sm text-brand-700">Show all</a>}
      </div>
      <p className="text-xs text-gray-500">
        Confirming an order deducts stock automatically; cancelling returns it. Leave commission blank to auto-calculate.
      </p>
      {orders.length === 0 && <p className="card text-gray-600">No requests here.</p>}
      {orders.map((o) => {
        const item = `${o.quantity} ${o.listings?.unit} of ${o.listings?.products?.name}`;
        const overdue = o.status === "new" && now - new Date(o.created_at).getTime() > DAY_MS;
        return (
          <div key={o.id} className={`card ${overdue ? "border-red-400 bg-red-50" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {o.buyer_name}{o.buyer_org ? ` · ${o.buyer_org}` : ""}
                  {overdue && <span className="ml-2 text-xs font-medium text-red-700">⚠ waiting over 24h</span>}
                </p>
                <p className="text-sm text-gray-600">{item} · pickup {o.listings?.location}</p>
                {o.note && <p className="mt-1 text-sm italic text-gray-600">“{o.note}”</p>}
                <p className="mt-1 text-xs text-gray-500">{formatDate(o.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={o.status} />
                <a className="btn-ghost" href={`tel:+${o.buyer_phone}`}>Call {displayPhone(o.buyer_phone)}</a>
                <a className="btn-ghost" target="_blank" rel="noopener noreferrer"
                   href={whatsappLink(o.buyer_phone, `Hello ${o.buyer_name}, this is Soko Baringo about your request for ${item}.`)}>WhatsApp</a>
              </div>
            </div>
            <ActionForm action={updateOrder} resetOnSuccess={false} className="mt-3 border-t pt-3">
              <div className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={o.id} />
                <label className="text-xs">Status
                  <select className="input py-1 text-sm" name="status" defaultValue={o.status}>
                    {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </label>
                <label className="text-xs">Agreed total (KES)
                  <input className="input w-32 py-1 text-sm" name="agreed_total_kes" type="number" min="0" step="1" defaultValue={o.agreed_total_kes ?? ""} />
                </label>
                <label className="text-xs">Your commission (KES)
                  <input className="input w-32 py-1 text-sm" name="commission_kes" type="number" min="0" step="1" placeholder="auto" defaultValue={o.commission_kes ?? ""} />
                </label>
                <SubmitButton className="btn-ghost">Save</SubmitButton>
              </div>
            </ActionForm>
          </div>
        );
      })}
    </div>
  );
}
