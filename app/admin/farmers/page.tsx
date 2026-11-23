import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate, whatsappLink } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Farmer } from "@/lib/types";
import { createFarmer, setLeadHandled } from "../actions";

export default async function FarmersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("farmers").select("id, full_name, phone, ward, village, group_name, created_at")
    .order("created_at", { ascending: false }).limit(200);
  const farmers = (data ?? []) as Farmer[];
  const { data: leadRows } = await supabase
    .from("farmer_leads").select("id, full_name, phone, ward, produce, created_at")
    .eq("handled", false).order("created_at", { ascending: false }).limit(100);
  const leads = (leadRows ?? []) as { id: string; full_name: string; phone: string; ward: string; produce: string | null; created_at: string }[];

  return (
    <div className="space-y-6">
    {leads.length > 0 && (
      <div className="card border-honey-400 bg-amber-50">
        <h2 className="mb-2 font-semibold">🌱 Farmers asking to join ({leads.length})</h2>
        <ul className="divide-y divide-amber-200">
          {leads.map((l) => (
            <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <div>
                <p className="font-medium">{l.full_name} · {l.ward}</p>
                <p className="text-xs text-gray-600">{l.produce ?? "Produce not stated"} · {formatDate(l.created_at)}</p>
              </div>
              <div className="flex items-center gap-2">
                <a className="btn-ghost bg-white" href={`tel:+${l.phone}`}>Call {displayPhone(l.phone)}</a>
                <a className="btn-ghost bg-white" target="_blank" rel="noopener noreferrer"
                   href={whatsappLink(l.phone, `Hello ${l.full_name}, this is Soko Baringo. Thank you for your interest! When can our agent visit you in ${l.ward}?`)}>WhatsApp</a>
                <form action={setLeadHandled}><input type="hidden" name="id" value={l.id} /><SubmitButton className="btn-ghost bg-white">Done ✓</SubmitButton></form>
              </div>
            </li>
          ))}
        </ul>
      </div>
    )}
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <ActionForm action={createFarmer} className="card h-fit space-y-3">
        <h2 className="font-semibold">Register farmer</h2>
        <div><label className="label" htmlFor="full_name">Full name</label><input className="input" id="full_name" name="full_name" required /></div>
        <div><label className="label" htmlFor="phone">Phone (M-Pesa)</label><input className="input" id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
        <div><label className="label" htmlFor="ward">Ward</label><input className="input" id="ward" name="ward" placeholder="e.g. Kabarnet, Kapropita, Ewalel Chapchap" required /></div>
        <div><label className="label" htmlFor="village">Village</label><input className="input" id="village" name="village" /></div>
        <div><label className="label" htmlFor="group_name">Group / co-op</label><input className="input" id="group_name" name="group_name" /></div>
        <div><label className="label" htmlFor="notes">Notes</label><textarea className="input" id="notes" name="notes" rows={2} placeholder="Crops, hive count, acreage…" /></div>
        <label className="flex items-start gap-2 text-xs text-gray-600">
          <input type="checkbox" name="consent" required className="mt-0.5 h-4 w-4 accent-brand-700" />
          <span>The farmer agreed that Soko Baringo may keep their name and phone number to sell their produce and pay them.</span>
        </label>
        <SubmitButton className="btn w-full">Save farmer</SubmitButton>
      </ActionForm>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Farmers ({farmers.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-2">Name</th><th>Phone</th><th>Ward</th><th>Group</th><th>Joined</th></tr></thead>
          <tbody className="divide-y">
            {farmers.map((f) => (
              <tr key={f.id}>
                <td className="py-2 font-medium"><a href={`/admin/farmers/${f.id}`} className="text-brand-700 hover:underline">{f.full_name}</a></td>
                <td><a className="text-brand-700" href={`tel:+${f.phone}`}>{displayPhone(f.phone)}</a></td>
                <td>{f.ward}{f.village ? ` · ${f.village}` : ""}</td>
                <td>{f.group_name ?? "—"}</td>
                <td className="text-gray-500">{formatDate(f.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
    </div>
  );
}
