import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { formatKes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { AgentEarning } from "@/lib/types";
import { addAgent, payAgent, updateAgent } from "../actions";

export const metadata = { title: "Agents" };

export default async function AgentsPage() {
  const supabase = await createClient();
  const [{ data }, { data: owner }, { data: rate }] = await Promise.all([
    supabase.from("agent_earnings").select("*"),
    supabase.rpc("is_owner"),
    supabase.from("settings").select("commission_rate").maybeSingle(),
  ]);
  const rows = ((data ?? []) as AgentEarning[]).sort((a, b) => b.sales_kes - a.sales_kes || b.farmers - a.farmers);
  const ratePct = Number(rate?.commission_rate ?? 0.05) * 100;

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Agents leaderboard</h1>
      <p className="text-sm text-gray-600">
        Each agent earns a share of the {ratePct}% commission on delivered sales from farmers <i>they registered</i>.
        For example, a 40% share means they earn {(ratePct * 0.4).toFixed(1)}% of each sale.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-2">#</th><th>Agent</th><th>Farmers</th><th>Sales</th><th>Commission</th><th>Share</th><th>Earned</th><th>Paid</th><th>Owed</th>{owner && <th>Manage</th>}</tr></thead>
          <tbody className="divide-y">
            {rows.map((a, i) => (
              <tr key={a.agent_id} className={a.active ? "" : "opacity-50"}>
                <td className="py-2">{i === 0 && a.sales_kes > 0 ? "🏆" : i + 1}</td>
                <td><b>{a.full_name ?? (a.role === "owner" ? "Owner" : "—")}</b><div className="text-xs text-gray-500">{a.role}{a.ward ? ` · ${a.ward}` : ""}</div></td>
                <td>{a.farmers}</td>
                <td>{formatKes(a.sales_kes)}</td>
                <td>{formatKes(a.commission_kes)}</td>
                <td>{Math.round(a.commission_share * 100)}%</td>
                <td className="font-semibold text-brand-700">{formatKes(a.earned_kes)}</td>
                <td>{formatKes(a.paid_kes)}</td>
                <td className={a.earned_kes - a.paid_kes > 0 ? "font-semibold text-orange-700" : ""}>{formatKes(Math.max(a.earned_kes - a.paid_kes, 0))}</td>
                {owner && (
                  <td>
                    {a.role === "agent" && (
                      <form action={updateAgent} className="flex items-center gap-1">
                        <input type="hidden" name="agent_id" value={a.agent_id} />
                        <input className="input w-16 py-1 text-sm" name="share_percent" type="number" min="0" max="100" step="1" defaultValue={Math.round(a.commission_share * 100)} aria-label="Share %" />
                        <label className="flex items-center gap-1 text-xs"><input type="checkbox" name="active" defaultChecked={a.active} />active</label>
                        <SubmitButton className="btn-ghost px-2 py-1 text-xs">Save</SubmitButton>
                      </form>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {owner ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <ActionForm action={addAgent} className="card space-y-3">
            <h2 className="font-semibold">Add a ward agent</h2>
            <p className="text-xs text-gray-500">First create their login in Supabase → Authentication → Users → Add user (tick Auto Confirm). Then enter the same email here.</p>
            <div><label className="label" htmlFor="a-email">Email</label><input className="input" id="a-email" name="email" type="email" required /></div>
            <div><label className="label" htmlFor="a-name">Full name</label><input className="input" id="a-name" name="full_name" required /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><label className="label" htmlFor="a-ward">Ward</label><input className="input" id="a-ward" name="ward" /></div>
              <div><label className="label" htmlFor="a-share">Share of commission (%)</label><input className="input" id="a-share" name="share_percent" type="number" min="0" max="100" defaultValue={40} /></div>
            </div>
            <SubmitButton className="btn w-full">Save agent</SubmitButton>
          </ActionForm>
          <ActionForm action={payAgent} className="card space-y-3">
            <h2 className="font-semibold">Record a payout to an agent</h2>
            <div>
              <label className="label" htmlFor="p-agent">Agent</label>
              <select className="input" id="p-agent" name="agent_id" required>
                {rows.filter((a) => a.role === "agent").map((a) => <option key={a.agent_id} value={a.agent_id}>{a.full_name} (owed {formatKes(Math.max(a.earned_kes - a.paid_kes, 0))})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className="label" htmlFor="p-amt">Amount</label><input className="input" id="p-amt" name="amount_kes" type="number" min="1" required /></div>
              <div><label className="label" htmlFor="p-method">Via</label><select className="input" id="p-method" name="method"><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank">Bank</option></select></div>
              <div><label className="label" htmlFor="p-ref">Code</label><input className="input" id="p-ref" name="reference" maxLength={60} /></div>
            </div>
            <SubmitButton className="btn w-full">Record payout</SubmitButton>
          </ActionForm>
        </div>
      ) : (
        <p className="text-sm text-gray-500">Only the owner can add agents and record payouts.</p>
      )}
    </div>
  );
}
