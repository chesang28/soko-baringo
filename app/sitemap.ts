import type { MetadataRoute } from "next";
import { createClient } from "@supabase/supabase-js";
import { siteUrl } from "@/lib/site";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const pages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "daily", priority: 1 },
    { url: `${base}/listings`, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/needs`, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/prices`, changeFrequency: "weekly", priority: 0.7 },
  ];
  try {
    // Cookie-less client: sitemap is static-ish and public.
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
    const [{ data: listings }, { data: products }] = await Promise.all([
      supabase.from("listings").select("id, created_at").eq("status", "available").limit(1000),
      supabase.from("products").select("id"),
    ]);
    for (const p of products ?? []) pages.push({ url: `${base}/listings?product=${p.id}`, changeFrequency: "daily", priority: 0.6 });
    for (const l of listings ?? []) pages.push({ url: `${base}/listings/${l.id}`, lastModified: l.created_at, changeFrequency: "weekly", priority: 0.8 });
  } catch (e) {
    console.error("sitemap listings failed", e);
  }
  return pages;
}
