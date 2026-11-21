import { PostNeedForm, RespondForm } from "@/components/NeedForms";
import { WhatsAppFab } from "@/components/WhatsAppFab";
import { formatDate, formatKes, formatQty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { productVisual } from "@/lib/products";
import { getProducts, getSiteStats } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { OpenNeed } from "@/lib/types";

export const metadata = { title: "Buyer requests", description: "Buyers looking for Baringo produce, including pre-harvest bookings. Farmers can respond with offers." };

export default async function NeedsPage() {
  const supabase = await createClient();
  const [{ t }, products, stats, { data }] = await Promise.all([getDict(), getProducts(), getSiteStats(), supabase.rpc("open_needs")]);
  const needs = (data ?? []) as OpenNeed[];
  const n = t.needs;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold">{n.title}</h1>
        <p className="mt-1 max-w-2xl text-gray-600">{n.sub}</p>
      </div>

      {needs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">{n.none}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {needs.map((x) => {
            const v = productVisual(x.product);
            return (
              <article key={x.id} className="rounded-2xl border border-gray-200 bg-white p-5">
                <div className="flex items-start gap-4">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ${v.tint}`} aria-hidden="true">{v.emoji}</span>
                  <div className="flex-1">
                    <h2 className="text-lg font-bold">{formatQty(x.quantity)} {x.unit} · {x.product}</h2>
                    <p className="text-sm text-gray-600">
                      {n.needed} <b>{formatDate(x.needed_by)}</b> · {n.in} {x.location}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {x.max_price_kes ? <>{n.upTo} <b>{formatKes(x.max_price_kes)}</b>/{x.unit} · </> : null}
                      {x.buyer_type === "Business" ? n.business_ : n.individual} · {x.responses} {n.offers}
                    </p>
                  </div>
                </div>
                <details className="mt-3">
                  <summary className="btn-ghost cursor-pointer list-none justify-center">{n.supply}</summary>
                  <RespondForm needId={x.id} unit={x.unit} t={n} />
                </details>
              </article>
            );
          })}
        </div>
      )}

      <section id="post" className="scroll-mt-24 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
        <h2 className="text-2xl font-bold">{n.post}</h2>
        <p className="mb-5 mt-1 text-gray-600">{t.bulk.body}</p>
        <PostNeedForm products={products} t={n} />
      </section>
      <WhatsAppFab phone={stats.agent_phone} label={t.chat} />
    </div>
  );
}
