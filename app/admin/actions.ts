"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { formatKes, orderRef } from "@/lib/format";
import { notifyAgent, siteUrl, tgEscape } from "@/lib/telegram";
import { PHOTO_PATH_RE } from "@/lib/photos";
import { GRADES } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import type { FormState } from "@/lib/types";
import {
  ValidationError, listingStatus, num, optionalInt, orderStatus, phone, str, unit, uuid,
} from "@/lib/validation";

/** Defence in depth: RLS already enforces this, but fail fast with a clear error. */
function optionalPhoto(fd: FormData): string | null {
  const v = String(fd.get("photo_path") ?? "").trim();
  if (!v) return null;
  if (!PHOTO_PATH_RE.test(v)) throw new ValidationError("Invalid photo.");
  return v;
}

function optionalGrade(fd: FormData) {
  const v = String(fd.get("grade") ?? "");
  if (!v) return null;
  if (!(GRADES as readonly string[]).includes(v)) throw new ValidationError("Invalid grade.");
  return v;
}

async function requireOwner() {
  const supabase = await requireAdmin();
  const { data } = await supabase.rpc("is_owner");
  if (!data) throw new ValidationError("Only the owner can do this.");
  return supabase;
}

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const { data: isAdmin } = await supabase.rpc("is_admin");
  if (!isAdmin) throw new Error("Not authorised");
  return supabase;
}

async function run(fn: () => Promise<string>): Promise<FormState> {
  try {
    return { ok: true, message: await fn() };
  } catch (e) {
    if (e instanceof ValidationError) return { ok: false, message: e.message };
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate key") && msg.includes("phone")) return { ok: false, message: "A farmer with this phone already exists." };
    if (msg.includes("USER_NOT_FOUND")) return { ok: false, message: "No user with that email. Create them first in Supabase → Authentication → Users." };
    if (msg.includes("INSUFFICIENT_STOCK")) return { ok: false, message: "Not enough stock left on this listing to confirm this order." };
    console.error(e);
    return { ok: false, message: "Could not save. Please try again." };
  }
}

export async function createFarmer(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const row = {
      full_name: str(fd, "full_name", { min: 2, max: 120 }),
      phone: phone(fd, "phone"),
      ward: str(fd, "ward", { min: 2, max: 80 }),
      village: str(fd, "village", { max: 80, required: false }),
      group_name: str(fd, "group_name", { max: 120, required: false }),
      notes: str(fd, "notes", { max: 1000, required: false }),
      consent_at: fd.get("consent") === "on" ? new Date().toISOString() : null,
    };
    if (!row.consent_at) throw new ValidationError("Ask the farmer for permission to keep their details, then tick the box.");
    const supabase = await requireAdmin();
    const { error } = await supabase.from("farmers").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/farmers");
    return `${row.full_name} registered.`;
  });
}

export async function createListing(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const row = {
      farmer_id: uuid(fd, "farmer_id"),
      product_id: num(fd, "product_id", { integer: true, max: 32767 }),
      quantity: num(fd, "quantity", { max: 1_000_000 }),
      unit: unit(fd, "unit"),
      price_per_unit_kes: num(fd, "price_per_unit_kes", { integer: true, max: 10_000_000 }),
      location: str(fd, "location", { min: 2, max: 120 }),
      available_from: str(fd, "available_from", { min: 10, max: 10 }),
      description: str(fd, "description", { max: 1000, required: false }),
      photo_path: optionalPhoto(fd),
      grade: optionalGrade(fd),
    };
    const supabase = await requireAdmin();
    const { data: created, error } = await supabase.from("listings").insert(row).select("id, products(name)").single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/listings");
    revalidatePath("/listings");

    // Matching: open buyer requests and waiting buyers for this product.
    const today = new Date().toISOString().slice(0, 10);
    const [needsRes, waitRes] = await Promise.all([
      supabase.from("buyer_needs").select("quantity, unit, needed_by, location, buyer_name, buyer_org, max_price_kes")
        .eq("product_id", row.product_id).eq("status", "open").gte("needed_by", today).order("needed_by").limit(10),
      supabase.from("stock_alerts").select("id", { count: "exact", head: true }).eq("product_id", row.product_id).is("notified_at", null),
    ]);
    const needs = (needsRes.data ?? []) as { quantity: number; unit: string; needed_by: string; location: string; buyer_name: string; buyer_org: string | null; max_price_kes: number | null }[];
    const waiting = waitRes.count ?? 0;
    const product = (created as unknown as { products: { name: string } | null }).products?.name ?? "produce";
    if (needs.length || waiting) {
      after(() => notifyAgent([
        `🎯 <b>Match found for new ${tgEscape(product)} listing</b> (${row.quantity} ${row.unit} @ ${formatKes(row.price_per_unit_kes)})`,
        ...needs.map((n) => `• ${tgEscape(n.buyer_org ?? n.buyer_name)} needs ${n.quantity} ${n.unit} in ${tgEscape(n.location)} by ${n.needed_by}${n.max_price_kes ? ` (max ${formatKes(n.max_price_kes)})` : ""}`),
        waiting ? `🔔 ${waiting} buyer(s) asked to be notified when ${tgEscape(product)} is in stock` : "",
        `\n<a href="${siteUrl()}/admin/${needs.length ? "needs" : "customers"}">Contact them now</a>`,
      ].filter(Boolean).join("\n")));
    }
    const hints = [needs.length ? `${needs.length} buyer request${needs.length > 1 ? "s" : ""} match` : "", waiting ? `${waiting} buyer${waiting > 1 ? "s are" : " is"} waiting for it (see Customers)` : ""].filter(Boolean);
    return `Listing published.${hints.length ? ` 🎯 ${hints.join(" · ")}.` : ""}`;
  });
}

export async function updateListing(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const patch = { status: listingStatus(fd, "status"), quantity: num(fd, "quantity", { max: 1_000_000 }), grade: optionalGrade(fd) };
  const supabase = await requireAdmin();
  const { error } = await supabase.from("listings").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/listings");
  revalidatePath("/listings");
}

export async function updateOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "id");
    const patch = {
      status: orderStatus(fd, "status"),
      agreed_total_kes: optionalInt(fd, "agreed_total_kes"),
      commission_kes: optionalInt(fd, "commission_kes"), // blank → auto-calculated by DB trigger
      delivery_fee_kes: optionalInt(fd, "delivery_fee_kes") ?? 0,
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/listings");
    revalidatePath("/admin");
    revalidatePath("/listings");
    return "Saved.";
  });
}

export async function setListingPhoto(listingId: string, path: string): Promise<{ ok: boolean; message: string }> {
  const fd = new FormData(); fd.set("id", listingId); fd.set("photo_path", path);
  return (await run(async () => {
    const id = uuid(fd, "id");
    const photo_path = optionalPhoto(fd);
    const supabase = await requireAdmin();
    const { error } = await supabase.from("listings").update({ photo_path }).eq("id", id);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/listings"); revalidatePath("/listings"); revalidatePath("/");
    return "Photo updated.";
  }))!;
}

export async function updateSettings(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const percent = num(fd, "commission_percent", { min: -0.0001, max: 50 });
    const rawPhone = String(fd.get("agent_phone") ?? "").trim();
    const agent_phone = rawPhone ? phone(fd, "agent_phone") : null;
    const supabase = await requireOwner();
    const { error } = await supabase
      .from("settings")
      .update({ commission_rate: Math.round(percent * 100) / 10000, agent_phone, min_commission_kes: optionalInt(fd, "min_commission_kes") ?? 0 })
      .eq("id", true);
    if (error) throw new Error(error.message);
    revalidatePath("/", "layout");
    return "Settings saved.";
  });
}

const DIRECTIONS = ["from_buyer", "to_farmer", "to_driver"] as const;
const METHODS = ["mpesa", "cash", "bank", "other"] as const;

export async function recordPayment(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const direction = String(fd.get("direction"));
    const method = String(fd.get("method"));
    if (!(DIRECTIONS as readonly string[]).includes(direction)) throw new ValidationError("Choose who paid.");
    if (!(METHODS as readonly string[]).includes(method)) throw new ValidationError("Choose a payment method.");
    const row = {
      order_id: uuid(fd, "order_id"),
      direction,
      method,
      amount_kes: num(fd, "amount_kes", { integer: true, max: 100_000_000 }),
      reference: str(fd, "reference", { max: 60, required: false })?.toUpperCase() ?? null,
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("payments").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/orders");
    revalidatePath("/admin/money");
    revalidatePath("/admin");
    revalidatePath("/admin/customers");
    return `Recorded KES ${row.amount_kes.toLocaleString("en-KE")} ${direction === "from_buyer" ? "received from buyer" : direction === "to_farmer" ? "paid to farmer" : "paid to driver"}.`;
  });
}

export async function setLeadHandled(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("farmer_leads").update({ handled: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/farmers");
  revalidatePath("/admin");
}

// ─── Buyer needs ────────────────────────────────────────────────────────
const NEED_STATUSES = ["open", "matched", "closed"] as const;
export async function updateNeedStatus(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const status = String(fd.get("status"));
  if (!(NEED_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("buyer_needs").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/needs"); revalidatePath("/needs");
}

export async function markResponseHandled(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("need_responses").update({ handled: true }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/needs");
}

// ─── Agents ─────────────────────────────────────────────────────────────
export async function addAgent(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const email = str(fd, "email", { min: 5, max: 200 })!;
    const share = num(fd, "share_percent", { min: -0.0001, max: 100 });
    const supabase = await requireOwner();
    const { error } = await supabase.rpc("add_agent", {
      p_email: email, p_name: str(fd, "full_name", { min: 2, max: 120 }), p_ward: str(fd, "ward", { max: 80, required: false }) ?? "",
      p_share: Math.round(share * 10) / 1000,
    });
    if (error) throw new Error(error.message);
    revalidatePath("/admin/agents");
    return "Agent saved. They can now sign in.";
  });
}

export async function updateAgent(fd: FormData): Promise<void> {
  const id = uuid(fd, "agent_id");
  const share = num(fd, "share_percent", { min: -0.0001, max: 100 });
  const supabase = await requireOwner();
  const { error } = await supabase.from("admins")
    .update({ commission_share: Math.round(share * 10) / 1000, active: fd.get("active") === "on" })
    .eq("user_id", id).eq("role", "agent");
  if (error) throw new Error(error.message);
  revalidatePath("/admin/agents");
}

export async function payAgent(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const method = String(fd.get("method"));
    if (!(METHODS as readonly string[]).includes(method)) throw new ValidationError("Choose a payment method.");
    const row = {
      agent_id: uuid(fd, "agent_id"),
      amount_kes: num(fd, "amount_kes", { integer: true, max: 100_000_000 }),
      method,
      reference: str(fd, "reference", { max: 60, required: false })?.toUpperCase() ?? null,
    };
    const supabase = await requireOwner();
    const { error } = await supabase.from("agent_payouts").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/agents"); revalidatePath("/admin/money");
    return `Recorded KES ${row.amount_kes.toLocaleString("en-KE")} paid to agent.`;
  });
}

// ─── Delivery runs ──────────────────────────────────────────────────────
const RUN_STATUSES = ["planned", "on_route", "done"] as const;
export async function createRun(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const driverPhone = String(fd.get("driver_phone") ?? "").trim();
    const row = {
      run_date: str(fd, "run_date", { min: 10, max: 10 }),
      route: str(fd, "route", { min: 2, max: 120 }),
      vehicle: str(fd, "vehicle", { max: 60, required: false }),
      driver_name: str(fd, "driver_name", { max: 120, required: false }),
      driver_phone: driverPhone ? phone(fd, "driver_phone") : null,
      cost_kes: optionalInt(fd, "cost_kes") ?? 0,
    };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("delivery_runs").insert(row);
    if (error) throw new Error(error.message);
    revalidatePath("/admin/runs");
    return "Run planned.";
  });
}

export async function updateRun(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const status = String(fd.get("status"));
  if (!(RUN_STATUSES as readonly string[]).includes(status)) throw new Error("Invalid status");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("delivery_runs").update({ status, cost_kes: optionalInt(fd, "cost_kes") ?? 0 }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${id}`); revalidatePath("/admin/runs"); revalidatePath("/admin/money");
}

export async function assignToRun(fd: FormData): Promise<void> {
  const runId = uuid(fd, "run_id");
  const ids = fd.getAll("order_id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const fee = optionalInt(fd, "delivery_fee_kes");
  if (!ids.length) return;
  const supabase = await requireAdmin();
  const patch: { run_id: string; delivery_fee_kes?: number } = { run_id: runId };
  if (fee !== null) patch.delivery_fee_kes = fee;
  const { error } = await supabase.from("orders").update(patch).in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${runId}`); revalidatePath("/admin/runs"); revalidatePath("/admin/orders");
}

export async function removeFromRun(fd: FormData): Promise<void> {
  const id = uuid(fd, "order_id");
  const runId = uuid(fd, "run_id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update({ run_id: null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/runs/${runId}`);
}

// ─── Step-by-step order flow ────────────────────────────────────────────
const revalidateOrders = () => {
  ["/admin/orders", "/admin/money", "/admin", "/admin/customers", "/admin/listings", "/listings"].forEach((p) => revalidatePath(p));
};

export async function confirmOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "id");
    const patch = {
      status: "confirmed",
      agreed_total_kes: optionalInt(fd, "agreed_total_kes"),
      delivery_fee_kes: optionalInt(fd, "delivery_fee_kes") ?? 0,
      deposit_required_kes: optionalInt(fd, "deposit_required_kes") ?? 0,
    };
    if (patch.agreed_total_kes === null) throw new ValidationError("Enter the agreed price.");
    if (patch.deposit_required_kes > patch.agreed_total_kes + patch.delivery_fee_kes) throw new ValidationError("Deposit can't be more than the order total.");
    const supabase = await requireAdmin();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateOrders();
    return "Order confirmed.";
  });
}

export async function markDelivered(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "id");
    const hired = fd.get("delivery_method") === "hired";
    const driverPhone = String(fd.get("driver_phone") ?? "").trim();
    const patch = hired
      ? {
          status: "delivered", delivery_method: "hired",
          driver_name: str(fd, "driver_name", { min: 2, max: 120 }),
          driver_phone: driverPhone ? phone(fd, "driver_phone") : null,
          transport_cost_kes: optionalInt(fd, "transport_cost_kes") ?? 0,
        }
      : { status: "delivered", delivery_method: "pickup", driver_name: null, driver_phone: null, transport_cost_kes: 0 };
    const supabase = await requireAdmin();
    const { error } = await supabase.from("orders").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    revalidateOrders();
    return "Marked as delivered.";
  });
}

export async function cancelOrder(fd: FormData): Promise<void> {
  const id = uuid(fd, "id");
  const supabase = await requireAdmin();
  const { error } = await supabase.from("orders").update({ status: "cancelled" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidateOrders();
}

/** Pay a farmer once for everything they're owed; the amount is split across their orders, oldest first. */
export async function payFarmer(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const farmerId = uuid(fd, "farmer_id");
    let amount = num(fd, "amount_kes", { integer: true, max: 100_000_000 });
    const method = String(fd.get("method"));
    if (!(METHODS as readonly string[]).includes(method)) throw new ValidationError("Choose a payment method.");
    const reference = str(fd, "reference", { max: 60, required: false })?.toUpperCase() ?? null;
    const supabase = await requireAdmin();
    const { data, error } = await supabase.from("order_balances")
      .select("order_id, farmer_owed_kes, delivered_at").eq("farmer_id", farmerId).gt("farmer_owed_kes", 0).order("delivered_at");
    if (error) throw new Error(error.message);
    const owed = (data ?? []) as { order_id: string; farmer_owed_kes: number }[];
    const total = owed.reduce((s, o) => s + o.farmer_owed_kes, 0);
    if (amount > total) throw new ValidationError(`That's more than you owe this farmer (KES ${total.toLocaleString("en-KE")}).`);
    const paid = amount;
    const rows = [];
    for (const o of owed) {
      if (amount <= 0) break;
      const part = Math.min(amount, o.farmer_owed_kes);
      rows.push({ order_id: o.order_id, direction: "to_farmer", amount_kes: part, method, reference });
      amount -= part;
    }
    const { error: insErr } = await supabase.from("payments").insert(rows);
    if (insErr) throw new Error(insErr.message);
    revalidateOrders();
    return `Paid KES ${paid.toLocaleString("en-KE")} to farmer, covering ${rows.length} order${rows.length > 1 ? "s" : ""}.`;
  });
}

// ─── Waiting list ("notify me") ─────────────────────────────────────────
export async function markAlertNotified(fd: FormData): Promise<void> {
  const ids = fd.getAll("id").map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  if (!ids.length) return;
  const supabase = await requireAdmin();
  const { error } = await supabase.from("stock_alerts").update({ notified_at: new Date().toISOString() }).in("id", ids);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/customers");
}

// ─── Repeat order ───────────────────────────────────────────────────────
/** Re-creates a past order for the same buyer on the newest available listing of the same product. */
export async function repeatOrder(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "order_id");
    const supabase = await requireAdmin();
    const { data: prev, error: e1 } = await supabase.from("orders")
      .select("buyer_name, buyer_phone, buyer_org, quantity, note, listings(product_id, unit)").eq("id", id).single();
    if (e1 || !prev) throw new ValidationError("Order not found.");
    const p = prev as unknown as { buyer_name: string; buyer_phone: string; buyer_org: string | null; quantity: number; note: string | null; listings: { product_id: number; unit: string } };
    const { data: listing } = await supabase.from("listings").select("id, quantity, price_per_unit_kes, location")
      .eq("product_id", p.listings.product_id).eq("unit", p.listings.unit).eq("status", "available")
      .gte("quantity", p.quantity).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (!listing) throw new ValidationError(`No listing has ${p.quantity} ${p.listings.unit} in stock right now. Add a listing first.`);
    const { data: created, error } = await supabase.from("orders").insert({
      listing_id: listing.id, buyer_name: p.buyer_name, buyer_phone: p.buyer_phone, buyer_org: p.buyer_org,
      quantity: p.quantity, note: p.note,
    }).select("id").single();
    if (error) throw new Error(error.message);
    revalidatePath("/admin/orders"); revalidatePath("/admin");
    return `Repeat order ${orderRef(created.id)} created (${p.quantity} ${p.listings.unit} @ ${formatKes(listing.price_per_unit_kes)} from ${listing.location}). It's in Orders → To do.`;
  });
}

// ─── Turn a buyer-request match into an order ──────────────────────────
export async function createOrderFromNeed(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const needId = uuid(fd, "need_id");
    const listingId = uuid(fd, "listing_id");
    const quantity = num(fd, "quantity", { max: 10_000_000 });
    const supabase = await requireAdmin();
    const [{ data: need }, { data: listing }] = await Promise.all([
      supabase.from("buyer_needs").select("buyer_name, buyer_phone, buyer_org, quantity, unit, location, note, status").eq("id", needId).single(),
      supabase.from("listings").select("quantity, unit, status, price_per_unit_kes").eq("id", listingId).single(),
    ]);
    if (!need || need.status !== "open") throw new ValidationError("This buyer request is no longer open.");
    if (!listing || listing.status !== "available") throw new ValidationError("That listing is no longer available.");
    if (quantity > Number(listing.quantity)) throw new ValidationError(`Only ${listing.quantity} ${listing.unit} available on that listing.`);

    // Already-ordered quantity from this request (tracked via the note tag).
    const tag = `[need:${needId.slice(0, 8)}]`;
    const { data: prior } = await supabase.from("orders").select("quantity").like("note", `%${tag}%`).neq("status", "cancelled");
    const orderedBefore = (prior ?? []).reduce((s, o) => s + Number(o.quantity), 0);

    const note = [`Delivery to ${need.location}`, need.note, tag].filter(Boolean).join(" · ").slice(0, 500);
    const { data: created, error } = await supabase.from("orders").insert({
      listing_id: listingId, buyer_name: need.buyer_name, buyer_phone: need.buyer_phone, buyer_org: need.buyer_org, quantity, note,
    }).select("id").single();
    if (error) throw new Error(error.message);

    const covered = orderedBefore + quantity >= Number(need.quantity);
    if (covered) await supabase.from("buyer_needs").update({ status: "matched" }).eq("id", needId);

    revalidatePath("/admin/needs"); revalidatePath("/admin/orders"); revalidatePath("/admin"); revalidatePath("/needs");
    const remaining = Math.max(Number(need.quantity) - orderedBefore - quantity, 0);
    return `Order ${orderRef(created.id)} created for ${need.buyer_name}: ${quantity} ${listing.unit} @ ${formatKes(listing.price_per_unit_kes)}. ` +
      (covered ? "Request fully covered and marked matched ✓" : `${remaining} ${need.unit} still needed. The request stays open.`) +
      " Find it in Orders → To do.";
  });
}

// ─── Crop focus ─────────────────────────────────────────────────────────
export async function setCropActive(fd: FormData): Promise<void> {
  const id = num(fd, "product_id", { integer: true, max: 32767 });
  const supabase = await requireOwner();
  const { error } = await supabase.from("products").update({ active: fd.get("active") === "true" }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/", "layout");
}

// ─── Rejections ─────────────────────────────────────────────────────────
const COST_BY = ["farmer", "transporter", "soko"] as const;
/**
 * Buyer refused part of a delivery. The buyer only pays for what they accepted.
 *  - farmer bears it:      farmer is paid only for accepted produce.
 *  - transporter bears it: farmer is paid in full; the value is deducted from the driver's fee.
 *  - Soko bears it:        farmer is paid in full; the loss comes out of your income.
 */
export async function recordRejection(_prev: FormState, fd: FormData): Promise<FormState> {
  return run(async () => {
    const id = uuid(fd, "id");
    const rejected = num(fd, "rejected_qty", { max: 10_000_000 });
    const costBy = String(fd.get("rejection_cost_by"));
    if (!(COST_BY as readonly string[]).includes(costBy)) throw new ValidationError("Choose who bears the loss.");
    const photo = String(fd.get("rejection_photo_path") ?? "").trim();
    if (photo && !/^rejections\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(photo)) throw new ValidationError("Invalid photo.");
    const note = str(fd, "rejection_note", { max: 500, required: false });

    const supabase = await requireAdmin();
    const { data: o, error: e1 } = await supabase.from("orders")
      .select("status, quantity, agreed_total_kes, commission_kes, transport_cost_kes, delivery_method, rejected_qty").eq("id", id).single();
    if (e1 || !o) throw new ValidationError("Order not found.");
    if (!["delivered", "paid"].includes(o.status)) throw new ValidationError("Mark the order delivered first.");
    if (Number(o.rejected_qty) > 0) throw new ValidationError("A rejection is already recorded for this order.");
    if (rejected > Number(o.quantity)) throw new ValidationError(`Only ${o.quantity} were delivered.`);
    if (costBy === "transporter" && o.delivery_method !== "hired") throw new ValidationError("No hired transporter on this order.");

    const oldTotal = o.agreed_total_kes ?? 0;
    const oldShare = oldTotal - (o.commission_kes ?? 0);
    const value = Math.round((oldTotal / Number(o.quantity)) * rejected);
    const newTotal = oldTotal - value;

    // Commission is recalculated by the DB trigger from the new total.
    const { data: upd, error: e2 } = await supabase.from("orders")
      .update({ agreed_total_kes: newTotal, rejected_qty: rejected, rejection_value_kes: value, rejection_cost_by: costBy,
                rejection_note: note, rejection_photo_path: photo || null })
      .eq("id", id).select("agreed_total_kes, commission_kes").single();
    if (e2 || !upd) throw new Error(e2?.message ?? "update failed");

    const newShare = (upd.agreed_total_kes ?? 0) - (upd.commission_kes ?? 0);
    const extra = costBy === "farmer" ? 0 : Math.max(oldShare - newShare, 0);
    const deduction = costBy === "transporter" ? Math.min(value, o.transport_cost_kes) : 0;
    const { error: e3 } = await supabase.from("orders").update({ farmer_extra_kes: extra, driver_deduction_kes: deduction }).eq("id", id);
    if (e3) throw new Error(e3.message);
    await supabase.rpc("orders_auto_paid", { p_order_id: id }); // buyer may now have paid in full

    revalidateOrders();
    const who = costBy === "farmer" ? "The farmer's payment is reduced."
      : costBy === "transporter" ? `KES ${deduction.toLocaleString("en-KE")} is deducted from the driver's fee${value > deduction ? ` (KES ${(value - deduction).toLocaleString("en-KE")} more than his fee: collect it from him separately)` : ""}. The farmer is paid in full.`
      : "The farmer is paid in full and the loss comes out of your income.";
    return `Rejection recorded: ${rejected} worth KES ${value.toLocaleString("en-KE")}. The buyer now pays KES ${newTotal.toLocaleString("en-KE")}. ${who}`;
  });
}
