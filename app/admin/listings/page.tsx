import { ActionForm } from "@/components/ActionForm";
import { StatusBadge } from "@/components/StatusBadge";
import { SubmitButton } from "@/components/SubmitButton";
import { formatKes } from "@/lib/format";
import { getProducts } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import { LISTING_STATUSES, UNITS, type Listing } from "@/lib/types";
import { createListing, updateListing } from "../actions";

type Row = Listing & { farmers: { full_name: string } | null };

export default async function AdminListingsPage() {
  const supabase = await createClient();
  const [products, farmersRes, listingsRes] = await Promise.all([
    getProducts(),
    supabase.from("farmers").select("id, full_name, ward").order("full_name"),
    supabase.from("listings")
      .select("id, quantity, unit, price_per_unit_kes, location, status, products(name), farmers(full_name)")
      .order("created_at", { ascending: false }).limit(200),
  ]);
  const farmers = farmersRes.data ?? [];
  const listings = (listingsRes.data ?? []) as unknown as Row[];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
      <ActionForm action={createListing} className="card h-fit space-y-3">
        <h2 className="font-semibold">Add produce</h2>
        {farmers.length === 0 && <p className="text-sm text-red-600">Register a farmer first.</p>}
        <div>
          <label className="label" htmlFor="farmer_id">Farmer</label>
          <select className="input" id="farmer_id" name="farmer_id" required>
            {farmers.map((f) => <option key={f.id} value={f.id}>{f.full_name} — {f.ward}</option>)}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="product_id">Product</label>
          <select className="input" id="product_id" name="product_id" required>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className="label" htmlFor="quantity">Quantity</label><input className="input" id="quantity" name="quantity" type="number" min="0.01" step="0.01" required /></div>
          <div>
            <label className="label" htmlFor="unit">Unit</label>
            <select className="input" id="unit" name="unit">{UNITS.map((u) => <option key={u}>{u}</option>)}</select>
          </div>
        </div>
        <div><label className="label" htmlFor="price_per_unit_kes">Price per unit (KES)</label><input className="input" id="price_per_unit_kes" name="price_per_unit_kes" type="number" min="1" step="1" required /></div>
        <div><label className="label" htmlFor="location">Pickup area (public)</label><input className="input" id="location" name="location" placeholder="e.g. Kabartonjo" required /></div>
        <div><label className="label" htmlFor="available_from">Ready from</label><input className="input" id="available_from" name="available_from" type="date" defaultValue={today} required /></div>
        <div><label className="label" htmlFor="description">Description</label><textarea className="input" id="description" name="description" rows={2} placeholder="Variety, grade, packaging…" /></div>
        <SubmitButton className="btn w-full">Publish listing</SubmitButton>
      </ActionForm>

      <div className="card overflow-x-auto">
        <h2 className="mb-3 font-semibold">Listings</h2>
        <table className="w-full text-left text-sm">
          <thead className="text-gray-500"><tr><th className="py-2">Product</th><th>Farmer</th><th>Price</th><th>Status</th><th>Update</th></tr></thead>
          <tbody className="divide-y">
            {listings.map((l) => (
              <tr key={l.id}>
                <td className="py-2 font-medium">{l.products?.name}<div className="text-xs text-gray-500">{l.location}</div></td>
                <td>{l.farmers?.full_name}</td>
                <td>{formatKes(l.price_per_unit_kes)}/{l.unit}</td>
                <td><StatusBadge status={l.status} /></td>
                <td>
                  <form action={updateListing} className="flex gap-1">
                    <input type="hidden" name="id" value={l.id} />
                    <input className="input w-20 py-1 text-sm" name="quantity" type="number" step="0.01" min="0.01" defaultValue={Number(l.quantity)} aria-label="Quantity" />
                    <select className="input w-28 py-1 text-sm" name="status" defaultValue={l.status} aria-label="Status">
                      {LISTING_STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <SubmitButton className="btn-ghost">Save</SubmitButton>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
