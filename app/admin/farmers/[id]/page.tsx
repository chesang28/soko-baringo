import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { displayPhone, formatDate, formatKes, formatQty, isUuid, orderRef, whatsappLink } from "@/lib/format";
import { siteUrl } from "@/lib/site";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance, Payment } from "@/lib/types";

export const metadata = { title: "Farmer statement" };

export default async function FarmerStatement({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: farmer }, { data: bal }] = await Promise.all([
    supabase.from("farmers").select("*").eq("id", id).maybeSingle(),
    supabase.from("order_balances").select("*").eq("farmer_id", id).order("created_at", { ascending: false }),
  ]);
  if (!farmer) notFound();
  const orders = ((bal ?? []) as OrderBalance[]).filter((o) => ["confirmed", "delivered", "paid"].includes(o.status));
  const ids = orders.map((o) => o.order_id);
  const { data: pays } = ids.length
    ? await supabase.from("payments").select("*").in("order_id", ids).eq("direction", "to_farmer").order("paid_at")
    : { data: [] };
  const payments = (pays ?? []) as Payment[];

  const sold = orders.reduce((s, o) => s + o.total_kes, 0);
  const share = orders.filter((o) => o.status !== "confirmed").reduce((s, o) => s + o.farmer_share_kes, 0);
  const paid = payments.reduce((s, p) => s + p.amount_kes, 0);
  const months = new Set(orders.map((o) => o.created_at.slice(0, 7))).size;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href="/admin/farmers" className="text-sm text-brand-700">← Farmers</Link>
        <div className="flex gap-2">
          <a className="btn-ghost" target="_blank" rel="noopener noreferrer"
             href={whatsappLink(farmer.phone, `Habari ${farmer.full_name.split(" ")[0]}! This is your Soko Baringo passbook. It shows all your sales and every payment we make you. Keep this link: ${siteUrl()}/p/${farmer.passbook_token}`)}>
            📒 Send passbook on WhatsApp
          </a>
          <a className="btn-ghost" target="_blank" rel="noopener noreferrer" href={`/p/${farmer.passbook_token}`}>View passbook</a>
          <PrintButton label="Print statement" />
        </div>
      </div>
      <div className="rounded-2xl bg-white p-8 ring-1 ring-gray-200 print:ring-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-gray-500">Farmer sales statement</p>
            <h1 className="text-2xl font-bold">{farmer.full_name}</h1>
            <p className="text-sm text-gray-600">{displayPhone(farmer.phone)} · {farmer.ward}{farmer.village ? `, ${farmer.village}` : ""}{farmer.group_name ? ` · ${farmer.group_name}` : ""}</p>
            <p className="text-sm text-gray-600">Registered {formatDate(farmer.created_at)}</p>
          </div>
          <p className="text-right text-lg font-extrabold text-brand-800">🌿 Soko Baringo</p>
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[["Total sold", formatKes(sold)], ["Farmer earnings", formatKes(share)], ["Paid to farmer", formatKes(paid)], ["Active months", String(months)]].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-gray-50 p-3"><dt className="text-xs text-gray-500">{k}</dt><dd className="text-lg font-bold">{v}</dd></div>
          ))}
        </dl>
        <h2 className="mt-6 font-semibold">Sales</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="border-b text-left text-gray-500"><tr><th className="py-1">Date</th><th>Ref</th><th>Produce</th><th className="text-right">Sale</th><th className="text-right">Farmer share</th><th className="text-right">Status</th></tr></thead>
          <tbody className="divide-y">
            {orders.map((o) => (
              <tr key={o.order_id}><td className="py-1.5">{formatDate(o.confirmed_at ?? o.created_at)}</td><td className="font-mono text-xs">{orderRef(o.order_id)}</td><td>{formatQty(o.quantity)} {o.unit} {o.product}</td>
                <td className="text-right">{formatKes(o.total_kes)}</td><td className="text-right">{formatKes(o.farmer_share_kes)}</td><td className="text-right capitalize">{o.status}</td></tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="py-3 text-gray-500">No sales yet.</td></tr>}
          </tbody>
        </table>
        <h2 className="mt-6 font-semibold">Payments received</h2>
        <ul className="mt-2 text-sm">
          {payments.map((p) => <li key={p.id}>{formatDate(p.paid_at)}: {formatKes(p.amount_kes)} via {p.method === "mpesa" ? "M-Pesa" : p.method}{p.reference ? ` (${p.reference})` : ""}</li>)}
          {payments.length === 0 && <li className="text-gray-500">None yet.</li>}
        </ul>
        <p className="mt-8 text-xs text-gray-500">This statement records sales made through Soko Baringo and may be shared with SACCOs, banks or input suppliers at the farmer&apos;s request.</p>
      </div>
    </div>
  );
}
