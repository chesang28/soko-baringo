import { RevenueChart } from "@/components/RevenueChart";
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
    cashOut: balances.reduce((s, b) => s + b.paid_out_kes, 0),
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
  const farmers = new Map<string, { name: string; phone: string; owed: number; orders: number }>();
  for (const b of balances) {
    if (b.buyer_owes_kes > 0) {
      const g = buyers.get(b.buyer_phone) ?? { name: b.buyer_name, phone: b.buyer_phone, owes: 0, orders: 0 };
      g.owes += b.buyer_owes_kes; g.orders += 1; buyers.set(b.buyer_phone, g);
    }
    if (b.farmer_owed_kes > 0) {
      const g = farmers.get(b.farmer_id) ?? { name: b.farmer_name, phone: b.farmer_phone, owed: 0, orders: 0 };
      g.owed += b.farmer_owed_kes; g.orders += 1; farmers.set(b.farmer_id, g);
    }
  }
  const owedToMe = [...buyers.values()].sort((a, b) => b.owes - a.owes);
  const iOwe = [...farmers.values()].sort((a, b) => b.owed - a.owed);
  const totalOwedToMe = owedToMe.reduce((s, b) => s + b.owes, 0);
  const totalIOwe = iOwe.reduce((s, f) => s + f.owed, 0);
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
          <p className="text-sm text-gray-500">You owe farmers</p>
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

      <p className="-mt-3 text-xs text-gray-500">Your income = commission + delivery fees − truck costs (before paying agents their share). &ldquo;All time&rdquo; truck costs cover the last 12 months.</p>
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
          <h2 className="mb-3 font-semibold">Farmers you owe</h2>
          {iOwe.length === 0 ? <p className="text-sm text-gray-500">All farmers are paid up.</p> : (
            <ul className="divide-y">
              {iOwe.map((f) => (
                <li key={f.phone} className="flex items-center justify-between gap-2 py-2 text-sm">
                  <div><p className="font-medium">{f.name}</p><p className="text-xs text-gray-500">{displayPhone(f.phone)} · {f.orders} order{f.orders > 1 ? "s" : ""}</p></div>
                  <span className="font-bold text-orange-700">{formatKes(f.owed)}</span>
                </li>
              ))}
            </ul>
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
                    <td>{inbound ? `From ${b?.buyer_name ?? "buyer"}` : `To ${b?.farmer_name ?? "farmer"}`}</td>
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
