import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, formatKes, orderRef, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { ORDER_STATUSES, type Order, type OrderBalance, type Payment } from "@/lib/types";
import { recordPayment, updateOrder } from "../actions";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const overdueOnly = filter === "overdue";

  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("id, listing_id, buyer_name, buyer_phone, buyer_org, quantity, note, status, agreed_total_kes, commission_kes, delivery_fee_kes, created_at, listings(unit, location, price_per_unit_kes, products(name))")
    .order("created_at", { ascending: false })
    .limit(200);
  if (overdueOnly) q = q.eq("status", "new").lt("created_at", new Date(Date.now() - DAY_MS).toISOString());
  const { data } = await q;
  const orders = (data ?? []) as unknown as (Order & { listings: Order["listings"] & { price_per_unit_kes: number } })[];
  const ids = orders.map((o) => o.id);

  const [balRes, payRes] = ids.length
    ? await Promise.all([
        supabase.from("order_balances").select("*").in("order_id", ids),
        supabase.from("payments").select("id, order_id, direction, amount_kes, method, reference, paid_at").in("order_id", ids).order("paid_at"),
      ])
    : [{ data: [] }, { data: [] }];
  const balances = new Map(((balRes.data ?? []) as OrderBalance[]).map((b) => [b.order_id, b]));
  const paymentsByOrder = new Map<string, Payment[]>();
  ((payRes.data ?? []) as Payment[]).forEach((p) => paymentsByOrder.set(p.order_id, [...(paymentsByOrder.get(p.order_id) ?? []), p]));
  const now = Date.now();

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">{overdueOnly ? "Overdue requests (24h+)" : "Buy requests"}</h1>
        {overdueOnly && <a href="/admin/orders" className="text-sm text-brand-700">Show all</a>}
      </div>
      <p className="text-xs text-gray-500">
        Total = quantity × listed price, and commission is worked out from it. Change the total if you negotiate a different price.
        Confirming takes stock off the listing; cancelling puts it back.
      </p>
      {orders.length === 0 && <p className="card text-gray-600">No requests here.</p>}
      {orders.map((o) => {
        const item = `${o.quantity} ${o.listings?.unit} of ${o.listings?.products?.name}`;
        const overdue = o.status === "new" && now - new Date(o.created_at).getTime() > DAY_MS;
        const b = balances.get(o.id);
        const pays = paymentsByOrder.get(o.id) ?? [];
        const buyerLeft = b?.buyer_owes_kes ?? 0;
        const farmerLeft = b?.farmer_owed_kes ?? 0;
        const committed = ["confirmed", "delivered", "paid"].includes(o.status);
        const delivered = ["delivered", "paid"].includes(o.status);
        return (
          <div key={o.id} className={`card ${overdue ? "border-red-400 bg-red-50" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">
                  {o.buyer_name}{o.buyer_org ? ` · ${o.buyer_org}` : ""}
                  <span className="ml-2 font-mono text-xs text-gray-400">{orderRef(o.id)}</span>
                  {overdue && <span className="ml-2 text-xs font-medium text-red-700">⚠ waiting over 24h</span>}
                </p>
                <p className="text-sm text-gray-600">{item} @ {formatKes(o.listings?.price_per_unit_kes ?? 0)} · pickup {o.listings?.location}</p>
                {o.note && <p className="mt-1 text-sm italic text-gray-600">“{o.note}”</p>}
                <p className="mt-1 text-xs text-gray-500">{formatDate(o.created_at)}{b ? ` · Farmer: ${b.farmer_name}` : ""}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={o.status} />
                <a className="btn-ghost" href={`tel:+${o.buyer_phone}`}>Call {displayPhone(o.buyer_phone)}</a>
                {o.status !== "new" && o.status !== "cancelled" && <a className="btn-ghost" href={`/admin/orders/${o.id}/invoice`}>Invoice</a>}
                <a className="btn-ghost" target="_blank" rel="noopener noreferrer"
                   href={whatsappLink(o.buyer_phone, `Hello ${o.buyer_name}, this is Soko Baringo about your request ${orderRef(o.id)} for ${item}.`)}>WhatsApp</a>
              </div>
            </div>

            {b && (
              <div className="mt-3 grid gap-2 rounded-lg bg-gray-50 p-3 text-sm sm:grid-cols-3">
                <div><p className="text-xs text-gray-500">Total · your commission{b.delivery_fee_kes ? " · delivery" : ""}</p><p className="font-semibold">{formatKes(b.total_kes)} · <span className="text-brand-700">{formatKes(b.commission_kes)}</span>{b.delivery_fee_kes ? ` · ${formatKes(b.delivery_fee_kes)}` : ""}</p></div>
                <div>
                  <p className="text-xs text-gray-500">Buyer paid</p>
                  <p className="font-semibold">{formatKes(b.received_kes)}{" "}
                    {!committed ? <span className="font-normal text-gray-500">(due once confirmed)</span>
                      : buyerLeft > 0 ? <span className="text-red-700">(owes {formatKes(buyerLeft)})</span>
                      : b.total_kes > 0 && <span className="text-brand-700">✓ paid in full</span>}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Farmer paid (share {formatKes(b.farmer_share_kes)})</p>
                  <p className="font-semibold">{formatKes(b.paid_out_kes)}{" "}
                    {!delivered ? <span className="font-normal text-gray-500">(due once delivered)</span>
                      : farmerLeft > 0 ? <span className="text-orange-700">(you owe {formatKes(farmerLeft)})</span>
                      : b.farmer_share_kes > 0 && <span className="text-brand-700">✓ settled</span>}
                  </p>
                </div>
                {pays.length > 0 && (
                  <ul className="text-xs text-gray-600 sm:col-span-3">
                    {pays.map((p) => (
                      <li key={p.id}>{formatDate(p.paid_at)}: {p.direction === "from_buyer" ? "received from buyer" : "paid to farmer"} {formatKes(p.amount_kes)} via {p.method === "mpesa" ? "M-Pesa" : p.method}{p.reference ? ` (${p.reference})` : ""}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div className="mt-3 grid gap-3 border-t pt-3 lg:grid-cols-2">
              <ActionForm action={updateOrder} resetOnSuccess={false}>
                <p className="mb-1 text-xs font-semibold text-gray-500">Update order</p>
                <div className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  <label className="flex flex-col gap-1 text-xs text-gray-600">Status
                    <select className="input py-1 text-sm" name="status" defaultValue={o.status}>
                      {ORDER_STATUSES.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-600">Total (KES)
                    <input className="input w-28 py-1 text-sm" name="agreed_total_kes" type="number" min="0" step="1" defaultValue={o.agreed_total_kes ?? ""} />
                  </label>
                  <label className="flex flex-col gap-1 text-xs text-gray-600">Delivery fee
                    <input className="input w-24 py-1 text-sm" name="delivery_fee_kes" type="number" min="0" step="1" defaultValue={o.delivery_fee_kes ?? 0} />
                  </label>
                <label className="flex flex-col gap-1 text-xs text-gray-600">Commission
                    <input className="input w-24 py-1 text-sm" name="commission_kes" type="number" min="0" step="1" placeholder="auto" defaultValue={o.commission_kes ?? ""} />
                  </label>
                  <SubmitButton className="btn-ghost">Save</SubmitButton>
                </div>
              </ActionForm>

              {o.status !== "new" && o.status !== "cancelled" && (
                <ActionForm action={recordPayment}>
                  <p className="mb-1 text-xs font-semibold text-gray-500">Record a payment</p>
                  <div className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="order_id" value={o.id} />
                    <label className="flex flex-col gap-1 text-xs text-gray-600">Type
                      <select className="input py-1 text-sm" name="direction" defaultValue={buyerLeft > 0 ? "from_buyer" : "to_farmer"}>
                        <option value="from_buyer">Buyer paid me</option>
                        <option value="to_farmer">I paid farmer</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-600">Amount
                      <input className="input w-24 py-1 text-sm" name="amount_kes" type="number" min="1" step="1" required
                             placeholder={buyerLeft > 0 ? String(buyerLeft) : farmerLeft > 0 ? String(farmerLeft) : ""} />
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-600">Via
                      <select className="input py-1 text-sm" name="method" defaultValue="mpesa">
                        <option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank">Bank</option><option value="other">Other</option>
                      </select>
                    </label>
                    <label className="flex flex-col gap-1 text-xs text-gray-600">M-Pesa code
                      <input className="input w-28 py-1 text-sm" name="reference" maxLength={60} placeholder="optional" />
                    </label>
                    <SubmitButton className="btn-ghost">Record</SubmitButton>
                  </div>
                </ActionForm>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
