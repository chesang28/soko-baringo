import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { OrderBalance } from "@/lib/types";

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? "" : String(v);
  // Quote everything; neutralise spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s;
  return `"${safe.replace(/"/g, '""')}"`;
};

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!user || !isAdmin) return new NextResponse("Forbidden", { status: 403 });

  const { data, error } = await supabase.from("order_balances").select("*").order("created_at").limit(10000);
  if (error) return new NextResponse("Export failed", { status: 500 });
  const rows = (data ?? []) as OrderBalance[];
  const cols: (keyof OrderBalance)[] = ["order_id", "created_at", "confirmed_at", "delivered_at", "status", "product", "quantity", "unit",
    "buyer_name", "buyer_org", "buyer_phone", "farmer_name", "farmer_phone", "total_kes", "commission_kes", "farmer_share_kes",
    "delivery_fee_kes", "received_kes", "paid_out_kes", "buyer_owes_kes", "farmer_owed_kes"];
  const body = [cols.join(","), ...rows.map((r) => cols.map((c) => csvCell(r[c])).join(","))].join("\n");
  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="soko-baringo-orders-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
