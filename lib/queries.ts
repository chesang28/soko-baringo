import { createClient } from "@/lib/supabase/server";
import type { Listing, Product } from "@/lib/types";

const LISTING_COLUMNS =
  "id, farmer_id, product_id, quantity, unit, price_per_unit_kes, location, description, available_from, status, created_at, photo_path, grade, products(name)";

export async function getProducts(): Promise<Product[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").select("id, name, default_unit").order("name");
  if (error) throw error;
  return data as Product[];
}

export async function getAvailableListings({ productId, limit = 60 }: { productId?: number; limit?: number } = {}) {
  const supabase = await createClient();
  let q = supabase
    .from("listings")
    .select(LISTING_COLUMNS)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (productId) q = q.eq("product_id", productId);
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as Listing[];
}

export async function getListing(id: string): Promise<Listing | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("listings").select(LISTING_COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as unknown as Listing | null;
}

export async function getSiteStats(): Promise<import("@/lib/types").SiteStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("site_stats");
  if (error) {
    console.error("site_stats failed", error);
    return { farmers: 0, wards: 0, listings: 0, deliveries: 0, open_needs: 0, avg_rating: null, review_count: 0, agent_phone: null };
  }
  return data as import("@/lib/types").SiteStats;
}
