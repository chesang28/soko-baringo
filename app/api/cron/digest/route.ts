import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { formatKes } from "@/lib/format";
import { notifyAgent, siteUrl } from "@/lib/telegram";

export const dynamic = "force-dynamic";

type Digest = {
  yesterday: { sales: number; commission: number; orders: number };
  week: { sales: number; commission: number; orders: number };
  new_requests: number; overdue_requests: number; open_needs: number; new_leads: number;
  buyers_owe: number; farmers_owed: number; expiring_soon: number;
};

/** Daily 08:00 EAT summary to Telegram. Called by Vercel Cron with CRON_SECRET. */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supabase.rpc("agent_digest", { p_secret: secret });
  if (error || !data) {
    console.error("digest failed", error);
    return NextResponse.json({ error: "digest failed" }, { status: 500 });
  }
  const d = data as Digest;
  const isMonday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "Africa/Nairobi" }) === "Monday";
  const todo = [
    d.overdue_requests ? `⚠️ ${d.overdue_requests} buy request(s) waiting over 24h` : "",
    d.new_requests ? `🛒 ${d.new_requests} new buy request(s) to call` : "",
    d.open_needs ? `📋 ${d.open_needs} open buyer request(s) to fill` : "",
    d.new_leads ? `🌱 ${d.new_leads} farmer(s) waiting for a visit` : "",
    d.expiring_soon ? `⏰ ${d.expiring_soon} listing(s) expire within 2 days` : "",
  ].filter(Boolean);

  const lines = [
    `☀️ <b>Good morning! Soko Baringo daily summary</b>`,
    `Yesterday: ${d.yesterday.orders} order(s) · sales ${formatKes(d.yesterday.sales)} · commission ${formatKes(d.yesterday.commission)}`,
    isMonday ? `\n📊 <b>Last 7 days:</b> ${d.week.orders} order(s) · sales ${formatKes(d.week.sales)} · commission ${formatKes(d.week.commission)}` : "",
    `\n💰 Buyers owe you ${formatKes(d.buyers_owe)} · you owe farmers ${formatKes(d.farmers_owed)}`,
    todo.length ? `\n<b>To do today</b>\n${todo.join("\n")}` : "\n✅ Nothing urgent today.",
    `\n<a href="${siteUrl()}/admin">Open dashboard</a>`,
  ];
  await notifyAgent(lines.filter(Boolean).join("\n"));
  return NextResponse.json({ ok: true });
}
