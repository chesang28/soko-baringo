import Link from "next/link";
import { notFound } from "next/navigation";
import { PrintButton } from "@/components/PrintButton";
import { displayPhone, formatDate, formatKes, formatQty, isUuid, orderRef } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance, Payment } from "@/lib/types";

export const metadata = { title: "Invoice" };

export default async function InvoicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data: b }, { data: pays }, { data: settings }] = await Promise.all([
    supabase.from("order_balances").select("*").eq("order_id", id).maybeSingle(),
    supabase.from("payments").select("*").eq("order_id", id).eq("direction", "from_buyer").order("paid_at"),
    supabase.from("settings").select("agent_phone").maybeSingle(),
  ]);
  if (!b) notFound();
  const o = b as OrderBalance;
  const payments = (pays ?? []) as Payment[];
  const unitPrice = o.quantity ? Math.round(o.total_kes / o.quantity) : 0;
  const due = o.total_kes + o.delivery_fee_kes;

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex justify-between print:hidden">
        <Link href="/admin/orders" className="text-sm text-brand-700">← Orders</Link>
        <PrintButton />
      </div>
      <div className="rounded-2xl bg-white p-8 ring-1 ring-gray-200 print:ring-0">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-2xl font-extrabold text-brand-800">🌿 Soko Baringo</p>
            <p className="text-sm text-gray-600">Kabarnet, Baringo County, Kenya</p>
            {settings?.agent_phone && <p className="text-sm text-gray-600">Tel {displayPhone(settings.agent_phone)}</p>}
          </div>
          <div className="text-right">
            <p className="text-xl font-bold">INVOICE</p>
            <p className="font-mono">{orderRef(o.order_id)}</p>
            <p className="text-sm text-gray-600">{formatDate(o.confirmed_at ?? o.created_at)}</p>
          </div>
        </div>
        <div className="mt-6 text-sm">
          <p className="text-gray-500">Bill to</p>
          <p className="font-semibold">{o.buyer_name}{o.buyer_org ? `, ${o.buyer_org}` : ""}</p>
          <p>{displayPhone(o.buyer_phone)}</p>
        </div>
        <table className="mt-6 w-full text-sm">
          <thead className="border-b text-left text-gray-500"><tr><th className="py-2">Item</th><th className="text-right">Qty</th><th className="text-right">Unit price</th><th className="text-right">Amount</th></tr></thead>
          <tbody className="divide-y">
            <tr><td className="py-2">{o.product}</td><td className="text-right">{formatQty(o.quantity)} {o.unit}</td><td className="text-right">{formatKes(unitPrice)}</td><td className="text-right">{formatKes(o.total_kes)}</td></tr>
            {o.delivery_fee_kes > 0 && <tr><td className="py-2">Delivery</td><td /><td /><td className="text-right">{formatKes(o.delivery_fee_kes)}</td></tr>}
          </tbody>
          <tfoot className="border-t font-semibold">
            <tr><td className="py-2" colSpan={3}>Total</td><td className="text-right">{formatKes(due)}</td></tr>
            {payments.map((p) => (
              <tr key={p.id} className="font-normal text-gray-600"><td colSpan={3}>Paid {formatDate(p.paid_at)} ({p.method === "mpesa" ? "M-Pesa" : p.method}{p.reference ? ` ${p.reference}` : ""})</td><td className="text-right">−{formatKes(p.amount_kes)}</td></tr>
            ))}
            <tr className="text-lg"><td className="py-2" colSpan={3}>Balance due</td><td className="text-right">{formatKes(Math.max(due - o.received_kes, 0))}</td></tr>
          </tfoot>
        </table>
        <p className="mt-8 text-center text-xs text-gray-500">Thank you for buying direct from Baringo farmers.</p>
      </div>
    </div>
  );
}
