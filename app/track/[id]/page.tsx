import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckIcon } from "@/components/Icons";
import { ReviewForm } from "@/components/ReviewForm";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty, isUuid, orderRef } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { productVisual } from "@/lib/products";
import { getSiteStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export const metadata = { title: "Track your request", robots: { index: false } };

const STEP_KEYS: OrderStatus[] = ["new", "contacted", "confirmed", "delivered", "paid"];
type Tracked = { status: OrderStatus; product: string; quantity: number; unit: string; location: string; total_kes: number | null; created_at: string; reviewed: boolean };

export default async function TrackPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const supabase = await createClient();
  const [{ t }, { data }, stats] = await Promise.all([getDict(), supabase.rpc("track_order", { p_id: id }), getSiteStats()]);
  const order = (data as Tracked[] | null)?.[0];
  if (!order) notFound();

  const current = STEP_KEYS.indexOf(order.status);
  const cancelled = order.status === "cancelled";
  const canReview = (order.status === "delivered" || order.status === "paid") && !order.reviewed;
  const v = productVisual(order.product);

  return (
    <div className="mx-auto max-w-lg">
      <p className="text-sm text-gray-500">{t.track.ref}</p>
      <h1 className="font-mono text-2xl font-bold">{orderRef(id)}</h1>
      <div className="mt-4 flex items-center gap-4 rounded-2xl bg-white p-4 ring-1 ring-gray-200">
        <span className={`flex h-14 w-14 items-center justify-center rounded-xl text-3xl ${v.tint}`} aria-hidden="true">{v.emoji}</span>
        <div className="flex-1">
          <p className="font-semibold">{formatQty(order.quantity)} {order.unit} · {order.product}</p>
          <p className="text-sm text-gray-600">{t.track.pickup} {order.location} · {t.track.requested} {formatDate(order.created_at)}</p>
        </div>
        {order.total_kes ? <p className="text-right font-bold text-brand-700">{formatKes(order.total_kes)}</p> : null}
      </div>

      {cancelled ? (
        <p className="mt-6 rounded-2xl bg-red-50 p-4 text-red-800">{t.track.cancelled}</p>
      ) : (
        <ol className="mt-8">
          {t.track.steps.map(([label, hint], i) => {
            const done = i <= current;
            return (
              <li key={label} className="relative flex gap-4 pb-8 last:pb-0">
                {i < t.track.steps.length - 1 && <span className={`absolute left-[15px] top-8 h-full w-0.5 ${i < current ? "bg-brand-700" : "bg-gray-200"}`} />}
                <span className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${done ? "bg-brand-700 text-white" : "bg-gray-200 text-gray-400"}`}>
                  {done ? <CheckIcon className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                </span>
                <div className="pt-1">
                  <p className={`font-semibold ${done ? "" : "text-gray-400"}`}>{label}</p>
                  {i === current && <p className="text-sm text-gray-600">{hint}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      {canReview && <div className="mt-8"><ReviewForm orderId={id} t={t.track} /></div>}
      <Link href="/listings" className="btn-ghost mt-8 w-full justify-center py-3">{t.order.more}</Link>
      <WhatsAppFab phone={stats.agent_phone} label={t.chat} />
    </div>
  );
}
