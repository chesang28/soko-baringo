import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/Icons";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty, isUuid, orderRef } from "@/lib/format";
import { productVisual } from "@/lib/products";
import { getSiteStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "Track your request", robots: { index: false } };

const STEPS: { key: OrderStatus; label: string; hint: string }[] = [
  { key: "new", label: "Request received", hint: "We've got your request." },
  { key: "contacted", label: "Agent in touch", hint: "Our agent is confirming details with you." },
  { key: "confirmed", label: "Confirmed", hint: "Price and delivery agreed. We're collecting your produce." },
  { key: "delivered", label: "Delivered", hint: "Your produce has been delivered." },
  { key: "paid", label: "Completed", hint: "Paid in full. Thank you!" },
];

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ data }, stats] = await Promise.all([supabase.rpc("track_order", { p_id: id }), getSiteStats()]);
  const order = (data as { status: OrderStatus; product: string; quantity: number; unit: string; location: string; total_kes: number | null; created_at: string }[] | null)?.[0];
  if (!order) notFound();

  const current = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled";

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm text-gray-500">Reference</p>
      <h1 className="font-mono text-2xl font-bold">{orderRef(id)}</h1>
      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
        <span className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl ${productVisual(order.product).tint}`} aria-hidden="true">{productVisual(order.product).emoji}</span>
        <div className="flex-1">
          <p className="font-semibold">{formatQty(order.quantity)} {order.unit} of {order.product}</p>
          <p className="text-sm text-gray-600">Pickup {order.location} · requested {formatDate(order.created_at)}</p>
        </div>
        {order.total_kes ? <p className="text-right font-bold text-brand-700">{formatKes(order.total_kes)}</p> : null}
      </div>

      {cancelled ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-red-800">This request was cancelled. Contact us if you think this is a mistake.</p>
      ) : (
        <ol className="mt-8">
          {STEPS.map((s, i) => {
            const done = i <= current;
            return (
              <li key={s.key} className="relative flex gap-4 pb-8 last:pb-0">
                {i < STEPS.length - 1 && <span className={`absolute left-[15px] top-8 h-full w-0.5 ${i < current ? "bg-brand-700" : "bg-gray-200"}`} />}
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-brand-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                  {done ? <CheckIcon className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </span>
                <div className="pt-1">
                  <p className={`font-semibold ${done ? "" : "text-gray-400"}`}>{s.label}</p>
                  {i === current && <p className="text-sm text-gray-600">{s.hint}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <Link href="/listings" className="btn-ghost mt-8 w-full justify-center py-3">Browse more produce</Link>
      <WhatsAppFab phone={stats.agent_phone} />
    </div>
  );
}
