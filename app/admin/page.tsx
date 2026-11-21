import Link from "next/link";
import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { formatDate, formatKes } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Order } from "@/lib/types";
import { updateSettings } from "./actions";

export default async function AdminHome() {
  const supabase = await createClient();
  const head = { count: "exact", head: true } as const;
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [farmers, listings, newOrders, overdue, earnings, settings, recent, leads] = await Promise.all([
    supabase.from("farmers").select("id", head),
    supabase.from("listings").select("id", head).eq("status", "available"),
    supabase.from("orders").select("id", head).eq("status", "new"),
    supabase.from("orders").select("id", head).eq("status", "new").lt("created_at", dayAgo),
    supabase.from("orders").select("commission_kes").eq("status", "paid"),
    supabase.from("settings").select("commission_rate, agent_phone").maybeSingle(),
    supabase.from("orders")
      .select("id, buyer_name, quantity, status, created_at, listings(unit, products(name))")
      .order("created_at", { ascending: false }).limit(8),
    supabase.from("farmer_leads").select("id", head).eq("handled", false),
  ]);

  const earned = (earnings.data ?? []).reduce((s, o) => s + (o.commission_kes ?? 0), 0);
  const ratePercent = Number(settings.data?.commission_rate ?? 0.05) * 100;
  const overdueCount = overdue.count ?? 0;

  const stats = [
    ["Farmers", farmers.count ?? 0],
    ["Live listings", listings.count ?? 0],
    ["New requests", newOrders.count ?? 0],
    ["Commission collected", formatKes(earned)],
  ] as const;

  return (
    <div className="space-y-6">
      {overdueCount > 0 && (
        <Link href="/admin/orders?filter=overdue" className="card block border-red-400 bg-red-50 font-medium text-red-800">
          ⚠ {overdueCount} buy request{overdueCount > 1 ? "s have" : " has"} waited over 24 hours. Call them now →
        </Link>
      )}

      {(leads.count ?? 0) > 0 && (
        <Link href="/admin/farmers" className="card block border-honey-400 bg-amber-50 font-medium text-amber-900">
          🌱 {leads.count} farmer{leads.count === 1 ? "" : "s"} asked to join. Call them →
        </Link>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map(([label, value]) => (
          <div key={label} className="card">
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-bold">{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Link href="/admin/farmers" className="btn">+ Register farmer</Link>
        <Link href="/admin/listings" className="btn">+ Add produce</Link>
        <Link href="/admin/money" className="btn-ghost">💰 Money & revenue</Link>
      </div>

      <div className="card">
        <h2 className="mb-3 font-semibold">Latest buy requests</h2>
        <ul className="divide-y">
          {((recent.data ?? []) as unknown as Order[]).map((o) => (
            <li key={o.id} className="flex items-center justify-between py-2 text-sm">
              <span>{o.buyer_name} · {o.quantity} {o.listings?.unit} {o.listings?.products?.name}</span>
              <span className="flex items-center gap-2 text-gray-500">{formatDate(o.created_at)} <StatusBadge status={o.status} /></span>
            </li>
          ))}
          {!recent.data?.length && <li className="py-2 text-sm text-gray-500">No requests yet.</li>}
        </ul>
      </div>

      <ActionForm action={updateSettings} resetOnSuccess={false} className="card max-w-md space-y-3">
        <h2 className="font-semibold">Settings</h2>
        <div>
          <label className="label" htmlFor="commission_percent">Commission rate (%)</label>
          <input className="input" id="commission_percent" name="commission_percent" type="number" min="0" max="50" step="0.1" defaultValue={ratePercent} />
        </div>
        <div>
          <label className="label" htmlFor="agent_phone">Public WhatsApp number</label>
          <input className="input" id="agent_phone" name="agent_phone" type="tel" placeholder="0712 345 678"
                 defaultValue={settings.data?.agent_phone ? `0${String(settings.data.agent_phone).slice(3)}` : ""} />
          <p className="mt-1 text-xs text-gray-500">Shown as a &ldquo;Chat with us&rdquo; button on the public site. Leave blank to hide.</p>
        </div>
        <SubmitButton>Save settings</SubmitButton>
      </ActionForm>
    </div>
  );
}
