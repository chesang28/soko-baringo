import { notFound } from "next/navigation";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { productVisual } from "@/lib/products";
import { getSiteStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Passbook", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

type Passbook = {
  name: string; ward: string; since: string; earned_kes: number; paid_kes: number; pending_kes: number;
  sales: { ref: string; at: string; product: string; quantity: number; unit: string; status: string; sale_kes: number; share_kes: number }[];
  payments: { at: string; amount_kes: number; method: string; reference: string | null; ref: string }[];
};

export default async function PassbookPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[0-9a-f]{64}$/.test(token)) notFound();
  const supabase = await createClient();
  const [{ t }, { data }, stats] = await Promise.all([getDict(), supabase.rpc("farmer_passbook", { p_token: token }), getSiteStats()]);
  const pb = data as Passbook | null;
  if (!pb) notFound();
  const p = t.passbook;
  const owed = Math.max(pb.earned_kes - pb.paid_kes, 0);
  const method = (m: string) => (m === "mpesa" ? "M-Pesa" : m);

  return (
    <div className="mx-auto max-w-lg space-y-5 pb-20">
      <div className="rounded-3xl bg-gradient-to-br from-brand-800 to-brand-700 p-6 text-white">
        <p className="text-sm text-brand-100">📒 {p.title}</p>
        <h1 className="mt-1 text-2xl font-bold">{p.hello} {pb.name}</h1>
        <p className="text-sm text-brand-100">{pb.ward} · {p.since} {formatDate(pb.since)}</p>
        <dl className="mt-5 grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/10 p-2"><dt className="text-[11px] text-brand-100">{p.earned}</dt><dd className="font-bold">{formatKes(pb.earned_kes)}</dd></div>
          <div className="rounded-xl bg-white/10 p-2"><dt className="text-[11px] text-brand-100">{p.paid}</dt><dd className="font-bold">{formatKes(pb.paid_kes)}</dd></div>
          <div className={`rounded-xl p-2 ${owed ? "bg-honey-400 text-gray-900" : "bg-white/10"}`}><dt className={`text-[11px] ${owed ? "" : "text-brand-100"}`}>{p.owed}</dt><dd className="font-bold">{formatKes(owed)}</dd></div>
        </dl>
        {pb.pending_kes > 0 && <p className="mt-3 text-xs text-brand-100">{p.pending}: {formatKes(pb.pending_kes)}</p>}
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <h2 className="font-semibold">💸 {p.payments}</h2>
        {pb.payments.length === 0 ? <p className="mt-2 text-sm text-gray-500">{p.none}</p> : (
          <ul className="mt-2 divide-y text-sm">
            {pb.payments.map((x, i) => (
              <li key={i} className="flex items-center justify-between py-2">
                <span>{formatDate(x.at)} · {method(x.method)}{x.reference ? <span className="ml-1 font-mono text-xs text-gray-500">{x.reference}</span> : null}<span className="block text-xs text-gray-400">{p.ref} SB-{x.ref}</span></span>
                <span className="font-bold text-brand-700">+{formatKes(x.amount_kes)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-gray-200">
        <h2 className="font-semibold">🧺 {p.sales}</h2>
        {pb.sales.length === 0 ? <p className="mt-2 text-sm text-gray-500">{p.none}</p> : (
          <ul className="mt-2 divide-y text-sm">
            {pb.sales.map((x) => (
              <li key={x.ref + x.at} className="flex items-center justify-between gap-2 py-2 pr-14 sm:pr-0">
                <span><span aria-hidden="true">{productVisual(x.product).emoji}</span> {formatQty(x.quantity)} {x.unit} {x.product}
                  <span className="block text-xs text-gray-400">{formatDate(x.at)} · {p.ref} SB-{x.ref} · {x.status}</span></span>
                <span className="text-right"><span className="block font-semibold">{formatKes(x.share_kes)}</span><span className="text-[11px] text-gray-400">{p.share}</span></span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-center text-xs text-gray-500">{p.note}<br />{p.help}</p>
      <WhatsAppFab phone={stats.agent_phone} label={t.chat} />
    </div>
  );
}
