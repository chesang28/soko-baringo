import Link from "next/link";
import { OrderCard, currentStep } from "@/components/OrderCard";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance } from "@/lib/types";

const TABS = [["todo", "To do"], ["done", "Completed"], ["cancelled", "Cancelled"], ["all", "All"]] as const;

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ tab?: string; filter?: string }> }) {
  const { tab: rawTab, filter } = await searchParams;
  const tab = filter === "overdue" ? "todo" : (TABS.find(([k]) => k === rawTab)?.[0] ?? "todo");
  const supabase = await createClient();
  const { data } = await supabase.from("order_balances").select("*").order("created_at", { ascending: false }).limit(300);
  const all = (data ?? []) as OrderBalance[];

  const withStep = all.map((b) => ({ b, step: currentStep(b) }));
  const counts = {
    todo: withStep.filter((x) => x.step !== "done" && x.step !== "cancelled").length,
    done: withStep.filter((x) => x.step === "done").length,
    cancelled: withStep.filter((x) => x.step === "cancelled").length,
    all: withStep.length,
  };
  const order = ["confirm", "deliver", "buyer", "farmer", "driver", "done", "cancelled"];
  const shown = withStep
    .filter((x) => tab === "all" || (tab === "todo" ? x.step !== "done" && x.step !== "cancelled" : x.step === tab))
    .sort((a, b) => (tab === "todo" ? order.indexOf(a.step) - order.indexOf(b.step) : 0));

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Orders</h1>
      <div className="flex gap-1 overflow-x-auto">
        {TABS.map(([k, label]) => (
          <Link key={k} href={`/admin/orders?tab=${k}`}
                className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium ${tab === k ? "bg-brand-700 text-white" : "bg-white ring-1 ring-gray-200 hover:bg-gray-50"}`}>
            {label} <span className="opacity-70">({counts[k]})</span>
          </Link>
        ))}
      </div>
      {tab === "todo" && counts.todo > 0 && <p className="text-xs text-gray-500">Each order shows just its next step, so work from top to bottom.</p>}
      {shown.length === 0 && <p className="card text-gray-600">{tab === "todo" ? "🎉 Nothing to do. All orders are complete." : "No orders here."}</p>}
      {shown.map(({ b }) => <OrderCard key={b.order_id} b={b} />)}
    </div>
  );
}
