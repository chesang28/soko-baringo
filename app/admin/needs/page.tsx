import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, formatKes, formatQty, whatsappLink } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";
import { markResponseHandled, updateNeedStatus } from "../actions";

type Need = {
  id: string; quantity: number; unit: string; max_price_kes: number | null; needed_by: string; location: string;
  buyer_name: string; buyer_phone: string; buyer_org: string | null; note: string | null; status: string; created_at: string;
  products: { name: string } | null;
  need_responses: { id: string; name: string; phone: string; quantity: number; price_per_unit_kes: number | null; handled: boolean; created_at: string }[];
};

export default async function AdminNeedsPage({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show } = await searchParams;
  const all = show === "all";
  const supabase = await createClient();
  let q = supabase.from("buyer_needs")
    .select("id, quantity, unit, max_price_kes, needed_by, location, buyer_name, buyer_phone, buyer_org, note, status, created_at, products(name), need_responses(id, name, phone, quantity, price_per_unit_kes, handled, created_at)")
    .order("needed_by").limit(200);
  if (!all) q = q.eq("status", "open");
  const { data } = await q;
  const needs = (data ?? []) as unknown as Need[];

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-bold">Buyer requests {all ? "(all)" : "(open)"}</h1>
        <a href={all ? "/admin/needs" : "/admin/needs?show=all"} className="text-sm text-brand-700">{all ? "Show open only" : "Show all"}</a>
      </div>
      <p className="text-xs text-gray-500">Buyers post what they need (including next-harvest bookings). Farmers respond publicly with offers. Call both sides, then register the farmer's produce as a listing and create the order.</p>
      {needs.length === 0 && <p className="card text-gray-600">No requests.</p>}
      {needs.map((n) => {
        const v = productVisual(n.products?.name);
        const offered = n.need_responses.reduce((s, r) => s + Number(r.quantity), 0);
        return (
          <div key={n.id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex gap-3">
                <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${v.tint}`}>{v.emoji}</span>
                <div>
                  <p className="font-semibold">{formatQty(n.quantity)} {n.unit} {n.products?.name} · by {formatDate(n.needed_by)} · {n.location}</p>
                  <p className="text-sm text-gray-600">{n.buyer_name}{n.buyer_org ? ` · ${n.buyer_org}` : ""}{n.max_price_kes ? ` · max ${formatKes(n.max_price_kes)}/${n.unit}` : ""}</p>
                  {n.note && <p className="text-sm italic text-gray-600">“{n.note}”</p>}
                  <p className="text-xs text-gray-500">Posted {formatDate(n.created_at)} · offers cover {formatQty(offered)} of {formatQty(n.quantity)} {n.unit}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <a className="btn-ghost" href={`tel:+${n.buyer_phone}`}>Call {displayPhone(n.buyer_phone)}</a>
                <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={whatsappLink(n.buyer_phone, `Hello ${n.buyer_name}, this is Soko Baringo about your request for ${n.quantity} ${n.unit} of ${n.products?.name}.`)}>WhatsApp</a>
                <form action={updateNeedStatus} className="flex gap-1">
                  <input type="hidden" name="id" value={n.id} />
                  <select name="status" defaultValue={n.status} className="input py-1 text-sm"><option>open</option><option>matched</option><option>closed</option></select>
                  <SubmitButton className="btn-ghost">Save</SubmitButton>
                </form>
              </div>
            </div>
            {n.need_responses.length > 0 && (
              <ul className="mt-3 divide-y rounded-lg bg-gray-50 px-3 text-sm">
                {n.need_responses.map((r) => (
                  <li key={r.id} className={`flex flex-wrap items-center justify-between gap-2 py-2 ${r.handled ? "opacity-50" : ""}`}>
                    <span>🤝 <b>{r.name}</b> · {formatQty(r.quantity)} {n.unit}{r.price_per_unit_kes ? ` @ ${formatKes(r.price_per_unit_kes)}` : ""} · {formatDate(r.created_at)}</span>
                    <span className="flex gap-2">
                      <a className="btn-ghost bg-white" href={`tel:+${r.phone}`}>Call {displayPhone(r.phone)}</a>
                      {!r.handled && <form action={markResponseHandled}><input type="hidden" name="id" value={r.id} /><SubmitButton className="btn-ghost bg-white">Done ✓</SubmitButton></form>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
