import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatKes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { createRun } from "../actions";

export const metadata = { title: "Truck runs" };
type Run = { id: string; run_date: string; route: string; vehicle: string | null; driver_name: string | null; cost_kes: number; status: string; orders: { delivery_fee_kes: number }[] };

export default async function RunsPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("delivery_runs")
    .select("id, run_date, route, vehicle, driver_name, cost_kes, status, orders(delivery_fee_kes)")
    .order("run_date", { ascending: false }).limit(100);
  const runs = (data ?? []) as Run[];
  const nextFriday = (() => { const d = new Date(); d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7 || 7)); return d.toISOString().slice(0, 10); })();

  return (
    <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
      <ActionForm action={createRun} className="card h-fit space-y-3">
        <h2 className="font-semibold">Plan a truck run</h2>
        <p className="text-xs text-gray-500">Group many orders into one trip (e.g. every Friday Kabarnet → Nakuru). Buyers share the transport cost through a delivery fee.</p>
        <div><label className="label" htmlFor="r-date">Date</label><input className="input" id="r-date" name="run_date" type="date" defaultValue={nextFriday} required /></div>
        <div><label className="label" htmlFor="r-route">Route</label><input className="input" id="r-route" name="route" placeholder="Kabarnet → Marigat → Nakuru" required /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="r-veh">Vehicle</label><input className="input" id="r-veh" name="vehicle" placeholder="KCX 123A" /></div>
          <div><label className="label" htmlFor="r-cost">Trip cost (KES)</label><input className="input" id="r-cost" name="cost_kes" type="number" min="0" placeholder="0" /></div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="r-drv">Driver</label><input className="input" id="r-drv" name="driver_name" /></div>
          <div><label className="label" htmlFor="r-dph">Driver phone</label><input className="input" id="r-dph" name="driver_phone" type="tel" /></div>
        </div>
        <SubmitButton className="btn w-full">Create run</SubmitButton>
      </ActionForm>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Runs</h2>
        {runs.length === 0 ? <p className="text-sm text-gray-500">No runs yet.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500"><tr><th className="py-2">Date</th><th>Route</th><th>Orders</th><th>Fees in</th><th>Cost</th><th>Profit</th><th>Status</th></tr></thead>
            <tbody className="divide-y">
              {runs.map((r) => {
                const fees = r.orders.reduce((s, o) => s + o.delivery_fee_kes, 0);
                return (
                  <tr key={r.id}>
                    <td className="py-2"><Link href={`/admin/runs/${r.id}`} className="font-semibold text-brand-700">{formatDate(r.run_date)}</Link></td>
                    <td>{r.route}<div className="text-xs text-gray-500">{[r.vehicle, r.driver_name].filter(Boolean).join(" · ")}</div></td>
                    <td>{r.orders.length}</td>
                    <td>{formatKes(fees)}</td>
                    <td>{formatKes(r.cost_kes)}</td>
                    <td className={fees - r.cost_kes >= 0 ? "text-brand-700" : "text-red-700"}>{formatKes(fees - r.cost_kes)}</td>
                    <td className="capitalize">{r.status.replace("_", " ")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
