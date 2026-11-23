import { ActionForm } from "@/components/ActionForm";
import { RevenueChart } from "@/components/RevenueChart";
import { SubmitButton } from "@/components/SubmitButton";
import { payFarmer } from "../actions";
import { siteUrl } from "@/lib/site";
import { displayPhone, formatDate, formatKes, orderRef, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { DailyRevenue, OrderBalance, Payment } from "@/lib/types";

export const metadata = { title: "Money" };

type Totals = { sales: number; commission: number; cashIn: number; cashOut: number; fees: number; transport: number };
const ZERO: Totals = { sales: 0, commission: 0, cashIn: 0, cashOut: 0, fees: 0, transport: 0 };
const sum = (rows: DailyRevenue[]): Totals => rows.reduce(
  (t, d) => ({
    sales: t.sales + Number(d.sales_kes), commission: t.commission + Number(d.commission_kes),
    cashIn: t.cashIn + Number(d.cash_in_kes), cashOut: t.cashOut + Number(d.cash_out_kes),
    fees: t.fees + Number(d.delivery_fees_kes), transport: t.transport + Number(d.transport_cost_kes),
  }), ZERO);
const income = (t: Totals) => t.commission + t.fees - t.transport;

export default async function MoneyPage() {
  const supabase = await createClient();
  const [rev, bal, pay, agents, allRev] = await Promise.all([
    supabase.rpc("daily_revenue", { p_days: 62 }),
    supabase.from("order_balances").select("*").limit(2000),
    supabase.from("payments").select("id, order_id, direction, amount_kes, method, reference, paid_at").order("paid_at", { ascending: false }).limit(25),
    supabase.from("agent_earnings").select("earned_kes, paid_kes"),
    supabase.rpc("daily_revenue", { p_days: 400 }),
  ]);
  const agentEarned = ((agents.data ?? []) as { earned_kes: number; paid_kes: number }[]).reduce((s, a) => s + a.earned_kes, 0);
  const agentPaid = ((agents.data ?? []) as { earned_kes: number; paid_kes: number }[]).reduce((s, a) => s + a.paid_kes, 0);
  const days = ((rev.data ?? []) as DailyRevenue[]).map((d) => ({ ...d, sales_kes: Number(d.sales_kes), commission_kes: Number(d.commission_kes) }));
  const balances = (bal.data ?? []) as OrderBalance[];
  const payments = (pay.data ?? []) as Payment[];

  // Periods in Kenya time; the SQL function already returns Nairobi calendar days.
  const today = days.at(-1)?.day ?? "";
  const dow = today ? (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7 : 0; // Monday = 0
  const weekStart = days.at(-1 - dow)?.day ?? today;
  const monthStart = today.slice(0, 8) + "01";

  const committed = balances.filter((b) => ["confirmed", "delivered", "paid"].includes(b.status));
  const yearTransport = sum((allRev.data ?? []) as DailyRevenue[]).transport;
  const allTime: Totals = {
    sales: committed.reduce((s, b) => s + b.total_kes, 0),
    commission: committed.reduce((s, b) => s + b.commission_kes, 0),
    cashIn: balances.reduce((s, b) => s + b.received_kes, 0),
    cashOut: balances.reduce((s, b) => s + b.paid_out_kes + (b.driver_paid_kes ?? 0), 0),
    fees: committed.reduce((s, b) => s + b.delivery_fee_kes, 0),
    transport: yearTransport,
  };
  const periods: [string, Totals][] = [
    ["Today", sum(days.filter((d) => d.day === today))],
    ["This week", sum(days.filter((d) => d.day >= weekStart))],
    ["This month", sum(days.filter((d) => d.day >= monthStart))],
    ["All time", allTime],
  ];

  // Group balances by person.
  const buyers = new Map<string, { name: string; phone: string; owes: number; orders: number }>();
  const farmers = new Map<string, { id: string; name: string; phone: string; owed: number; orders: number; token: string }>();
  const drivers = new Map<string, { name: string; phone: string | null; owed: number; orders: number }>();
  for (const b of balances) {
    if (b.buyer_owes_kes > 0) {
      const g = buyers.get(b.buyer_phone) ?? { name: b.buyer_name, phone: b.buyer_phone, owes: 0, orders: 0 };
      g.owes += b.buyer_owes_kes; g.orders += 1; buyers.set(b.buyer_phone, g);
    }
    if (b.farmer_owed_kes > 0) {
      const g = farmers.get(b.farmer_id) ?? { id: b.farmer_id, name: b.farmer_name, phone: b.farmer_phone, owed: 0, orders: 0, token: b.passbook_token };
      g.owed += b.farmer_owed_kes; g.orders += 1; farmers.set(b.farmer_id, g);
    }
    if (b.driver_owed_kes > 0) {
      const k = b.driver_phone ?? b.driver_name ?? "driver";
      const g = drivers.get(k) ?? { name: b.driver_name ?? "Driver", phone: b.driver_phone, owed: 0, orders: 0 };
      g.owed += b.driver_owed_kes; g.orders += 1; drivers.set(k, g);
    }
  }
  const owedToMe = [...buyers.values()].sort((a, b) => b.owes - a.owes);
  const iOwe = [...farmers.values()].sort((a, b) => b.owed - a.owed);
  const totalOwedToMe = owedToMe.reduce((s, b) => s + b.owes, 0);
  const driversOwed = [...drivers.values()];
  const totalIOwe = iOwe.reduce((s, f) => s + f.owed, 0) + driversOwed.reduce((s, d) => s + d.owed, 0);
  const balanceByOrder = new Map(balances.map((b) => [b.order_id, b]));

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Money</h1>
        <a href="/admin/money/export" className="btn-ghost">⬇ Export CSV</a>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="card border-l-4 border-l-brand-700">
          <p className="text-sm text-gray-500">Buyers owe you</p>
          <p className="mt-1 text-3xl font-bold">{formatKes(totalOwedToMe)}</p>
        </div>
        <div className="card border-l-4 border-l-orange-500">
          <p className="text-sm text-gray-500">You owe farmers & drivers</p>
          <p className="mt-1 text-3xl font-bold">{formatKes(totalIOwe)}</p>
        </div>
        <div className="card border-l-4 border-l-gray-400">
          <p className="text-sm text-gray-500">Cash in hand (received − paid to farmers & agents)</p>
          <p className="mt-1 text-3xl font-bold">{formatKes(allTime.cashIn - allTime.cashOut - agentPaid)}</p>
          {agentEarned - agentPaid > 0 && <p className="text-xs text-orange-700">You owe agents {formatKes(agentEarned - agentPaid)}</p>}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {periods.map(([label, t]) => (
          <div key={label} className="card">
            <p className="text-sm font-semibold text-gray-500">{label}</p>
            <p className="mt-2 text-xs text-gray-500">Your income</p>
            <p className="text-2xl font-bold text-brand-700">{formatKes(income(t))}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
              <dt className="text-gray-500">Commission</dt><dd className="text-right font-medium">{formatKes(t.commission)}</dd>
              {(t.fees > 0 || t.transport > 0) && <><dt className="text-gray-500">Delivery fees</dt><dd className="text-right font-medium">{formatKes(t.fees)}</dd>
              <dt className="text-gray-500">Transport cost</dt><dd className="text-right font-medium">−{formatKes(t.transport)}</dd></>}
              <dt className="text-gray-500">Sales</dt><dd className="text-right font-medium">{formatKes(t.sales)}</dd>
              <dt className="text-gray-500">Cash in</dt><dd className="text-right font-medium">{formatKes(t.cashIn)}</dd>
              <dt className="text-gray-500">Paid out</dt><dd className="text-right font-medium">{formatKes(t.cashOut)}</dd>
            </dl>
          </div>
        ))}
      </div>

      <p className="-mt-3 text-xs text-gray-500">Your income = commission + delivery fees − what you pay drivers (before paying agents their share).</p>
      <div className="card">
        <h2 className="font-semibold">Daily sales, last 30 days</h2>
        <p className="mb-3 text-xs text-gray-500">Counted on the day an order is confirmed. Hover a bar for details.</p>
        <RevenueChart days={days.slice(-30)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 font-semibold">Buyers who owe you</h2>
          {owedToMe.length === 0 ? <p className="text-sm text-gray-500">Nobody owes you. 🎉</p> : (
            <ul className="divide-y">
              {owedToMe.map((b) => (
                <li key={b.phone} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div><p className="font-medium">{b.name}</p><p className="text-xs text-gray-500">{displayPhone(b.phone)} · {b.orders} order{b.orders > 1 ? "s" : ""}</p></div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold">{formatKes(b.owes)}</span>
                    <a className="btn-ghost px-2 py-1 text-xs" target="_blank" rel="noopener noreferrer"
                       href={whatsappLink(b.phone, `Hello ${b.name}, a friendly reminder from Soko Baringo: KES ${b.owes.toLocaleString("en-KE")} is outstanding for your order. Thank you!`)}>Remind</a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="card">
          <h2 className="mb-1 font-semibold">Farmers you owe</h2>
          <p className="mb-2 text-xs text-gray-500">Tap Pay to record one payment covering all of a farmer&apos;s orders.</p>
          {iOwe.length === 0 ? <p className="text-sm text-gray-500">All farmers are paid up.</p> : (
            <ul className="divide-y">
              {iOwe.map((f) => (
                <li key={f.id} className="py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <div><p className="font-medium">{f.name}</p><p className="text-xs text-gray-500">{displayPhone(f.phone)} · {f.orders} order{f.orders > 1 ? "s" : ""}</p></div>
                    <span className="font-bold text-orange-700">{formatKes(f.owed)}</span>
                  </div>
                  <details className="mt-1">
                    <summary className="btn-ghost cursor-pointer list-none px-3 py-1 text-xs">💸 Pay {f.name.split(" ")[0]}</summary>
                    <ActionForm action={payFarmer} className="mt-2 flex flex-wrap items-end gap-2">
                      <input type="hidden" name="farmer_id" value={f.id} />
                      <label className="flex flex-col gap-1 text-xs text-gray-600">Amount<input className="input w-28 py-1 text-sm" name="amount_kes" type="number" min="1" max={f.owed} defaultValue={f.owed} required /></label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">Via<select className="input py-1 text-sm" name="method"><option value="mpesa">M-Pesa</option><option value="cash">Cash</option><option value="bank">Bank</option></select></label>
                      <label className="flex flex-col gap-1 text-xs text-gray-600">M-Pesa code<input className="input w-28 py-1 text-sm" name="reference" maxLength={60} /></label>
                      <SubmitButton className="btn px-3 py-1.5 text-sm">Record</SubmitButton>
                    </ActionForm>
                    <a className="mt-1 inline-block text-xs text-brand-700 underline" target="_blank" rel="noopener noreferrer"
                       href={whatsappLink(f.phone, `Habari ${f.name.split(" ")[0]}! Soko Baringo has sent your payment. See all your sales and payments here: ${siteUrl()}/p/${f.token}`)}>📲 After paying, send receipt + passbook</a>
                  </details>
                </li>
              ))}
            </ul>
          )}
          {driversOwed.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-semibold">Drivers you owe</h3>
              <ul className="divide-y">
                {driversOwed.map((d) => (
                  <li key={d.name + d.phone} className="flex items-center justify-between py-2 text-sm">
                    <span><b>{d.name}</b>{d.phone ? ` · ${displayPhone(d.phone)}` : ""} · {d.orders} trip{d.orders > 1 ? "s" : ""}</span>
                    <span className="font-bold text-orange-700">{formatKes(d.owed)}</span>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-gray-500">Pay drivers from each order&apos;s step 5 on the Orders page.</p>
            </>
          )}
          <p className="mt-3 text-xs text-gray-500">A farmer is owed once their order is marked delivered: the agreed total minus your commission.</p>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Recent payments</h2>
        {payments.length === 0 ? <p className="text-sm text-gray-500">No payments recorded yet. Record them on the Orders page.</p> : (
          <table className="w-full text-left text-sm">
            <thead className="text-gray-500"><tr><th className="py-1">Date</th><th>Order</th><th>Who</th><th>Method</th><th>Ref</th><th className="text-right">Amount</th></tr></thead>
            <tbody className="divide-y">
              {payments.map((p) => {
                const b = balanceByOrder.get(p.order_id);
                const inbound = p.direction === "from_buyer";
                return (
                  <tr key={p.id}>
                    <td className="py-2">{formatDate(p.paid_at)}</td>
                    <td className="font-mono text-xs">{orderRef(p.order_id)}</td>
                    <td>{inbound ? `From ${b?.buyer_name ?? "buyer"}` : p.direction === "to_driver" ? `To driver ${b?.driver_name ?? ""}` : `To ${b?.farmer_name ?? "farmer"}`}</td>
                    <td className="capitalize">{p.method === "mpesa" ? "M-Pesa" : p.method}</td>
                    <td className="font-mono text-xs">{p.reference ?? "—"}</td>
                    <td className={`text-right font-semibold ${inbound ? "text-brand-700" : "text-orange-700"}`}>{inbound ? "+" : "−"}{formatKes(p.amount_kes)}</td>
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
