import { ActionForm } from "@/components/ActionForm";
import { SubmitButton } from "@/components/SubmitButton";
import { displayPhone, formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { Farmer } from "@/lib/types";
import { createFarmer } from "../actions";

export default async function FarmersPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("farmers").select("id, full_name, phone, ward, village, group_name, created_at")
    .order("created_at", { ascending: false }).limit(200);
  const farmers = (data ?? []) as Farmer[];

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <ActionForm action={createFarmer} className="card h-fit space-y-3">
        <h2 className="font-semibold">Register farmer</h2>
        <div><label className="label" htmlFor="full_name">Full name</label><input className="input" id="full_name" name="full_name" required /></div>
        <div><label className="label" htmlFor="phone">Phone (M-Pesa)</label><input className="input" id="phone" name="phone" type="tel" inputMode="tel" placeholder="0712 345 678" required /></div>
        <div><label className="label" htmlFor="ward">Ward</label><input className="input" id="ward" name="ward" placeholder="e.g. Kabarnet, Kapropita, Ewalel Chapchap" required /></div>
        <div><label className="label" htmlFor="village">Village</label><input className="input" id="village" name="village" /></div>
        <div><label className="label" htmlFor="group_name">Group / co-op</label><input className="input" id="group_name" name="group_name" /></div>
        <div><label className="label" htmlFor="notes">Notes</label><textarea className="input" id="notes" name="notes" rows={2} placeholder="Crops, hive count, acreage…" /></div>
        <SubmitButton className="btn w-full">Save farmer</SubmitButton>
      </ActionForm>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Farmers ({farmers.length})</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-2">Name</th><th>Phone</th><th>Ward</th><th>Group</th><th>Joined</th></tr></thead>
          <tbody className="divide-y">
            {farmers.map((f) => (
              <tr key={f.id}>
                <td className="py-2 font-medium">{f.full_name}</td>
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
  );
}
