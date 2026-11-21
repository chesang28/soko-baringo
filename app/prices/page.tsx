import { formatKes, formatQty } from "@/lib/format";
import { getDict } from "@/lib/i18n";
import { productVisual } from "@/lib/products";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Produce prices", description: "Live produce prices in Baringo County: mangoes, honey and more." };

type Row = { product: string; unit: string; listings: number; min_listed: number | null; avg_listed: number | null; max_listed: number | null;
             avg_sold_30d: number | null; avg_sold_prev_30d: number | null; sold_qty_30d: number };

export default async function PricesPage() {
  const supabase = await createClient();
  const [{ t }, { data }] = await Promise.all([getDict(), supabase.rpc("price_board")]);
  const rows = (data ?? []) as Row[];
  const p = t.prices;

  const trend = (cur: number | null, prev: number | null) => {
    if (!cur || !prev) return <span className="text-gray-400">—</span>;
    const pct = Math.round(((cur - prev) / prev) * 100);
    if (pct === 0) return <span className="text-gray-500">→ 0%</span>;
    return <span className={pct > 0 ? "text-brand-700" : "text-red-700"}>{pct > 0 ? "▲" : "▼"} {Math.abs(pct)}%</span>;
  };

  return (
    <div>
      <h1 className="text-3xl font-extrabold">{p.title}</h1>
      <p className="mt-1 max-w-2xl text-gray-600">{p.sub}</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white p-8 text-center text-gray-600">{p.none}</p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200 bg-white">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr><th className="px-4 py-3">{p.product}</th><th>{p.listedNow}</th><th>{p.range}</th><th>{p.sold30}</th><th>{p.trend}</th><th className="pr-4 text-right">{p.volume}</th></tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={`${r.product}-${r.unit}`}>
                  <td className="px-4 py-3 font-semibold"><span aria-hidden="true">{productVisual(r.product).emoji}</span> {r.product} <span className="font-normal text-gray-500">{p.per} {r.unit}</span></td>
                  <td className="font-bold text-brand-700">{r.avg_listed ? formatKes(r.avg_listed) : "—"}</td>
                  <td className="text-gray-600">{r.min_listed && r.max_listed && r.min_listed !== r.max_listed ? `${formatKes(r.min_listed)} – ${formatKes(r.max_listed)}` : "—"}</td>
                  <td>{r.avg_sold_30d ? formatKes(r.avg_sold_30d) : "—"}</td>
                  <td>{trend(r.avg_sold_30d, r.avg_sold_prev_30d)}</td>
                  <td className="pr-4 text-right">{Number(r.sold_qty_30d) ? `${formatQty(r.sold_qty_30d)} ${r.unit}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
